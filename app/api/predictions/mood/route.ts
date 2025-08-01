import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

interface MoodEntry {
  moodState: 'Happy' | 'Sad' | 'Stressed';
  timestamp: Date;
  moodText: string;
  sentiment?: string;
}

interface PredictionResult {
  tomorrowMood: {
    predicted: string;
    confidence: number;
    probability_distribution: { [key: string]: number };
  };
  patterns: {
    weeklyTrend: string;
    timeOfDayPattern: string;
    moodStability: number;
    riskFactors: string[];
  };
  insights: {
    dominant_emotion_week: string;
    mood_volatility: 'low' | 'medium' | 'high';
    recommendation: string;
  };
}

export async function POST(request: NextRequest) {
  console.log('=== ML Mood Prediction API called ===');
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }

    const moodHistory = await fetchMoodHistory(userId);

    if (moodHistory.length < 3) {
      return NextResponse.json({
        success: true,
        prediction: getFallbackPrediction(),
        message: 'Need at least 3 mood entries for accurate predictions'
      }, { status: 200 });
    }

    const statisticalPrediction = calculateStatisticalPrediction(moodHistory);
    const hfInsights = await analyzeWithHuggingFace(moodHistory);

    return NextResponse.json({
      success: true,
      prediction: {
        tomorrowMood: statisticalPrediction.tomorrowMood,
        patterns: {
          ...statisticalPrediction.patterns,
          ...hfInsights.patterns,
        },
        insights: {
          ...statisticalPrediction.insights,
          ...hfInsights.insights,
        },
      },
      metadata: {
        analyzed_entries: moodHistory.length,
        prediction_date: new Date().toISOString(),
        model: 'statistical+huggingface',
      }
    }, { status: 200 });
  } catch (error: unknown) {
    console.error('=== Mood Prediction Error ===', error);
    return NextResponse.json({
      success: false,
      error: 'Prediction service temporarily unavailable',
      prediction: getFallbackPrediction()
    }, { status: 200 });
  }
}

async function fetchMoodHistory(userId: string): Promise<MoodEntry[]> {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('mental_health_tracker');
    const moodsCollection = db.collection('moods');
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const moods = await moodsCollection
      .find({ userId, timestamp: { $gte: sevenDaysAgo } })
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();
    return moods.map(mood => ({
      moodState: mood.moodState,
      timestamp: new Date(mood.timestamp),
      moodText: mood.moodText,
      sentiment: mood.sentiment
    }));
  } finally {
    await client.close(); // Ensure connection closes gracefully
    console.log('MongoDB connection closed');
  }
}

function calculateStatisticalPrediction(moodHistory: MoodEntry[]): PredictionResult {
  if (moodHistory.length < 5) {
    return getFallbackPrediction();
  }

  const moodToNumber = { Happy: 3, Stressed: 2, Sad: 1 };
  const weights = [0.4, 0.3, 0.2, 0.1];
  let weightedSum = 0;
  let totalWeight = 0;
  const moodCounts = { Happy: 0, Sad: 0, Stressed: 0 };

  const recentEntries = moodHistory.slice(-7).slice(-4);
  recentEntries.forEach((entry, index) => {
    if (index < weights.length) {
      weightedSum += moodToNumber[entry.moodState] * weights[index];
      totalWeight += weights[index];
    }
    moodCounts[entry.moodState]++;
  });

  const avgMood = weightedSum / totalWeight;
  const predictedMood = avgMood >= 2.5 ? 'Happy' : avgMood >= 1.5 ? 'Stressed' : 'Sad';
  const confidence = Math.min(0.9, Math.max(0.5, Math.abs(avgMood - Math.round(avgMood)) * 2 + 0.1));

  const total = moodHistory.length;
  const stability = calculateStability(moodHistory);
  const dominantMood = Object.entries(moodCounts).sort(([,a], [,b]) => b - a)[0][0] as string;

  return {
    tomorrowMood: {
      predicted: predictedMood,
      confidence,
      probability_distribution: {
        Happy: moodCounts.Happy / total,
        Sad: moodCounts.Sad / total,
        Stressed: moodCounts.Stressed / total
      }
    },
    patterns: {
      weeklyTrend: stability > 0.7 ? 'stable' : stability > 0.4 ? 'variable' : 'volatile',
      timeOfDayPattern: analyzeTimePattern(moodHistory),
      moodStability: stability,
      riskFactors: stability < 0.4 ? ['High mood volatility'] : []
    },
    insights: {
      dominant_emotion_week: dominantMood,
      mood_volatility: stability > 0.7 ? 'low' : stability > 0.4 ? 'medium' : 'high',
      recommendation: stability < 0.4 ? 'Consider consulting a professional due to mood swings.' : 'Maintain current mood tracking.'
    }
  };
}

function analyzeTimePattern(moodHistory: MoodEntry[]): string {
  const hourGroups = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  moodHistory.forEach(entry => {
    const hour = entry.timestamp.getHours();
    if (hour < 6) hourGroups.night++;
    else if (hour < 12) hourGroups.morning++;
    else if (hour < 18) hourGroups.afternoon++;
    else hourGroups.evening++;
  });
  const total = moodHistory.length;
  const maxGroup = Object.entries(hourGroups).sort(([,a], [,b]) => b - a)[0][0];
  return maxGroup === 'morning' ? 'morning_low' :
         maxGroup === 'afternoon' ? 'afternoon_peak' :
         maxGroup === 'evening' ? 'evening_high' : 'night_increase';
}

function calculateStability(moodData: MoodEntry[]): number {
  if (moodData.length < 2) return 0.5;
  let changes = 0;
  for (let i = 1; i < moodData.length; i++) {
    if (moodData[i].moodState !== moodData[i - 1].moodState) {
      const timeDiff = (moodData[i].timestamp.getTime() - moodData[i - 1].timestamp.getTime()) / (1000 * 60 * 60);
      changes += timeDiff < 24 ? 0.5 : 1;
    }
  }
  return Math.max(0, 1 - (changes / (moodData.length - 1)));
}

async function analyzeWithHuggingFace(moodHistory: MoodEntry[]): Promise<Partial<PredictionResult>> {
  const hfApiKey = process.env.HUGGINGFACE_API_KEY;
  if (!hfApiKey) {
    console.warn('Hugging Face API key not found');
    return {
      insights: {
        dominant_emotion_week: 'Unknown',
        mood_volatility: 'medium',
        recommendation: 'Hugging Face API key missing; rely on statistical data.'
      },
      patterns: { weeklyTrend: 'stable', timeOfDayPattern: 'consistent', moodStability: 0.5, riskFactors: [] }
    };
  }

  const recentMoods = moodHistory.slice(0, 7).map(entry => ({
    mood: entry.moodState,
    text: entry.moodText.substring(0, 20),
  }));

  const prompt = recentMoods.map(entry => `${entry.mood}: "${entry.text}"`).join('\n');
  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/j-hartmann/emotion-english-distilroberta-base',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: prompt, options: { wait_for_model: true } }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hugging Face API error:', errorText);
      throw new Error('Hugging Face API failed');
    }

    const hfData = await response.json();
    console.log('Hugging Face response:', hfData);
    const emotions = hfData[0]?.[0]?.label || 'neutral'; // Access the first emotion's label
    const confidence = hfData[0]?.[0]?.score || 0.5;

    const hfDominantEmotion = emotions === 'joy' ? 'Happy' : emotions === 'sadness' ? 'Sad' : 'Stressed';
    const volatility = confidence > 0.7 ? 'low' : confidence > 0.4 ? 'medium' : 'high';

    // Only override dominant_emotion_week if Hugging Face confidence is high
    const useHfEmotion = confidence > 0.8; // Threshold for overriding statistical data

    return {
      patterns: {
        weeklyTrend: confidence > 0.6 ? 'stable' : 'variable',
        timeOfDayPattern: analyzeTimePattern(moodHistory),
        moodStability: Math.min(0.8, confidence + 0.2),
        riskFactors: confidence < 0.5 ? ['Low confidence in emotion detection'] : []
      },
      insights: {
        dominant_emotion_week: useHfEmotion ? hfDominantEmotion : 'Unknown', // Fallback to statistical if low confidence
        mood_volatility: volatility,
        recommendation: `Focus on ${hfDominantEmotion === 'Happy' ? 'maintaining' : hfDominantEmotion === 'Sad' ? 'seeking support' : 'managing stress'} with self-care.`
      }
    };
  } catch (error) {
    console.error('Hugging Face error details:', error);
    return {
      insights: {
        dominant_emotion_week: 'Unknown',
        mood_volatility: 'medium',
        recommendation: 'Hugging Face API unavailable; rely on statistical data.'
      },
      patterns: { weeklyTrend: 'stable', timeOfDayPattern: 'consistent', moodStability: 0.5, riskFactors: [] }
    };
  }
} 
function getFallbackPrediction(): PredictionResult {
  return {
    tomorrowMood: {
      predicted: 'Happy',
      confidence: 0.5,
      probability_distribution: { Happy: 0.4, Sad: 0.3, Stressed: 0.3 }
    },
    patterns: {
      weeklyTrend: 'insufficient_data',
      timeOfDayPattern: 'need_more_entries',
      moodStability: 0.5,
      riskFactors: ['Limited historical data']
    },
    insights: {
      dominant_emotion_week: 'Unknown',
      mood_volatility: 'medium',
      recommendation: 'Continue logging moods regularly.'
    }
  };
}