// File: app/api/emotions/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
interface EmotionResult {
  label: string;
  score: number;
}

interface AnalysisResult {
  emotions: EmotionResult[];
  dominantEmotion: string;
  emotionIntensity: number;
  confidenceScore: number;
  riskAssessment: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    recommendation: string;
  };
}

 
interface MoodHistoryEntry {
  moodState: string;
  timestamp: string;
} 
function calculateConfidenceScore(emotions: EmotionResult[]): number {
  // Calculate confidence based on the gap between top emotions
  if (emotions.length < 2) return emotions[0]?.score || 0.5;
  
  const topScore = emotions[0].score;
  const secondScore = emotions[1].score;
  const gap = topScore - secondScore;
  
  // Higher gap = higher confidence
  return Math.min(topScore + gap, 1.0);
}
// File: app/api/emotions/analyze/route.ts
// ... (other imports remain the same)

function assessMentalHealthRisk(emotions: EmotionResult[], text: string, moodHistory: MoodHistoryEntry[] = []): {
  level: 'low' | 'medium' | 'high';
  factors: string[];
  recommendation: string;
} {
  const riskWords = [
    'suicide', 'kill', 'die', 'death', 'hurt', 'harm', 'hopeless', 
    'worthless', 'useless', 'burden', 'ending', 'give up', 'cant go on'
  ];
  const stressWords = [
    'overwhelmed', 'anxious', 'panic', 'stress', 'worried', 'scared',
    'pressure', 'exhausted', 'burnout', 'breakdown'
  ];

  const textLower = text.toLowerCase();
  const hasRiskWords = riskWords.some(word => textLower.includes(word));
  const hasStressWords = stressWords.some(word => textLower.includes(word));

  const sadnessScore = emotions.find(e => e.label === 'sadness')?.score || 0;
  const fearScore = emotions.find(e => e.label === 'fear')?.score || 0;
  const angerScore = emotions.find(e => e.label === 'anger')?.score || 0;

  // Calculate historical negative mood frequency
  const recentNegativeMoods = moodHistory.filter(m => ['Sad', 'Stressed'].includes(m.moodState)).length;
  const historyFactor = moodHistory.length > 0 ? recentNegativeMoods / moodHistory.length : 0;

  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  const factors: string[] = [];
  let recommendation = 'Continue monitoring your emotional well-being.';

  if (hasRiskWords && (sadnessScore > 0.6 || fearScore > 0.6)) {
    riskLevel = 'high';
    factors.push('Critical language detected', 'High emotional distress');
    recommendation = 'Please contact a mental health professional or crisis hotline immediately.';
  } else if ((sadnessScore > 0.65 || fearScore > 0.65 || angerScore > 0.65 || hasStressWords) && historyFactor > 0.5) {
    riskLevel = 'medium';
    factors.push('Elevated negative emotions', 'Recent negative mood pattern');
    recommendation = 'Consider discussing your feelings with a counselor or trusted friend.';
  } else if (sadnessScore > 0.45 || fearScore > 0.45 || historyFactor > 0.3) {
    riskLevel = 'medium';
    factors.push('Moderate emotional distress');
    recommendation = 'Try self-care practices like journaling or relaxation techniques.';
  } else {
    factors.push('Stable emotional indicators');
  }

  return {
    level: riskLevel,
    factors,
    recommendation
  };
}

async function fetchRecentMoods(userId: string): Promise<MoodHistoryEntry[]> {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('mental_health_tracker');
    const moodsCollection = db.collection('moods');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const documents = await moodsCollection
      .find({ userId, timestamp: { $gte: sevenDaysAgo } })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();

    // Map documents to MoodHistoryEntry
    return documents.map(doc => ({
      moodState: doc.moodState as string,
      timestamp: doc.timestamp instanceof Date ? doc.timestamp.toISOString() : doc.timestamp,
    }));
  } finally {
    await client.close();
  }
}
export async function POST(request: NextRequest) {
  console.log('=== Emotion Analysis API called ===');
  try {
    const { text, userId } = await request.json();
    
    if (!text || text.trim().length < 3) {
      return NextResponse.json({ 
        error: 'Text must be at least 3 characters long' 
      }, { status: 400 });
    }

    const hfApiKey = process.env.HUGGINGFACE_API_KEY;
    if (!hfApiKey) {
      return NextResponse.json({ 
        error: 'Missing HUGGINGFACE_API_KEY environment variable' 
      }, { status: 500 });
    }

    console.log('Analyzing emotions for text:', text.substring(0, 50) + '...');

    const response = await fetch(
      'https://api-inference.huggingface.co/models/j-hartmann/emotion-english-distilroberta-base',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: text,
          options: { wait_for_model: true }
        }),
      }
    );

    if (!response.ok) {
      console.error('HuggingFace API error:', await response.text());
      return NextResponse.json({
        success: true,
        analysis: getFallbackEmotionAnalysis(text),
        fallback: true
      }, { status: 200 });
    }

    const emotionData: EmotionResult[] = await response.json();
    const moodHistory = userId ? await fetchRecentMoods(userId) : [];
    const analysis = processEmotionData(emotionData, text, moodHistory);

    return NextResponse.json({
      success: true,
      analysis,
      metadata: {
        model: 'j-hartmann/emotion-english-distilroberta-base',
        analyzed_at: new Date().toISOString(),
        text_length: text.length
      }
    }, { status: 200 });

  }catch (error: unknown) {
    console.error('=== Emotion Analysis Error ===', error);
    return NextResponse.json({
      success: false,
      error: 'Emotion analysis service temporarily unavailable',
      analysis: getFallbackEmotionAnalysis(''),
      fallback: true
    }, { status: 200 });
  }
}

function processEmotionData(emotions: EmotionResult[], text: string, moodHistory: MoodHistoryEntry[]): AnalysisResult {
  const sortedEmotions = emotions
    .sort((a, b) => b.score - a.score)
    .map(emotion => ({
      label: emotion.label,
      score: Math.round(emotion.score * 100) / 100,
      percentage: Math.round(emotion.score * 100)
    }));

  const dominantEmotion = sortedEmotions[0];
  const emotionIntensity = dominantEmotion.score;
  const confidenceScore = calculateConfidenceScore(sortedEmotions);
  const riskAssessment = assessMentalHealthRisk(sortedEmotions, text, moodHistory);

  return {
    emotions: sortedEmotions,
    dominantEmotion: dominantEmotion.label,
    emotionIntensity,
    confidenceScore,
    riskAssessment
  };
}

function getFallbackEmotionAnalysis(text: string): AnalysisResult {
  // Simple keyword-based fallback
  const emotions = [
    { label: 'joy', score: 0.3, percentage: 30 },
    { label: 'sadness', score: 0.2, percentage: 20 },
    { label: 'fear', score: 0.2, percentage: 20 },
    { label: 'anger', score: 0.15, percentage: 15 },
    { label: 'surprise', score: 0.1, percentage: 10 },
    { label: 'disgust', score: 0.05, percentage: 5 }
  ];
  
  return {
    emotions,
    dominantEmotion: 'joy',
    emotionIntensity: 0.3,
    confidenceScore: 0.4,
    riskAssessment: {
      level: 'low',
      factors: ['Fallback analysis - limited accuracy'],
      recommendation: 'Try the emotion analysis again when the service is available.'
    }
  };
}