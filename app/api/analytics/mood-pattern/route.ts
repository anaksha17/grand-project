import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

interface MoodPatternRequest {
  userId: string;
  timeRange?: number; // days
  analysisType?: 'basic' | 'detailed' | 'ai_enhanced';
  includeRecommendations?: boolean;
}

interface MoodPattern {
  date: string;
  mood: string;
  frequency: number;
  timeOfDay?: string;
  sentiment?: string;
}

interface PatternAnalysis {
  userId: string;
  timeRange: number;
  patterns: MoodPattern[];
  insights: {
    dominantMood: string;
    moodStability: number;
    riskLevel: 'low' | 'medium' | 'high';
    trendDirection: 'improving' | 'declining' | 'stable';
    criticalPatterns: string[];
  };
  recommendations?: string[];
  generatedAt: string;
}

 

interface MoodData {
  timestamp: string;
  moodState: string;
  sentiment?: string;
  userId: string;
}

export async function POST(request: NextRequest) {
  console.log('=== Mood Pattern Analysis API called ===');
  
  try {
    const body: MoodPatternRequest = await request.json();
    const { userId, timeRange = 30, analysisType = 'detailed', includeRecommendations = true } = body;
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'userId is required for pattern analysis',
        success: false 
      }, { status: 400 });
    }

    console.log(`Analyzing mood patterns for user: ${userId}, timeRange: ${timeRange} days`);
    
    const analysis = await analyzeMoodPatterns(userId, timeRange, analysisType);
    
    if (includeRecommendations) {
      analysis.recommendations = generatePatternRecommendations(analysis);
    }
    
    await saveAnalysisResults(analysis);
    
    console.log('Pattern analysis completed:', {
      userId: analysis.userId,
      patternsFound: analysis.patterns.length,
      riskLevel: analysis.insights.riskLevel,
      dominantMood: analysis.insights.dominantMood
    });

    return NextResponse.json({ 
      success: true, 
      analysis,
      message: 'Mood pattern analysis completed successfully'
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('Pattern analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ 
      success: false, 
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

async function analyzeMoodPatterns(userId: string, timeRange: number, analysisType: string): Promise<PatternAnalysis> {
  let client: MongoClient | null = null;
  
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db('mental_health_tracker');
    const moodsCollection = db.collection('moods');
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeRange);
    
    const moodData = await moodsCollection
      .find({
        userId,
        timestamp: { $gte: startDate.toISOString() }
      })
      .sort({ timestamp: 1 })
      .toArray();
    
  
    const typedMoodData = moodData.map(doc => ({
  timestamp: doc.timestamp as string,
  moodState: doc.moodState as string,
  sentiment: doc.sentiment as string | undefined,
  userId: doc.userId as string
}));
const patterns = groupMoodsByDate(typedMoodData);
const insights = generateInsights(typedMoodData);
    
    return {
      userId,
      timeRange,
      patterns,
      insights,
      generatedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error analyzing mood patterns:', error);
    throw error;
  } finally {
    if (client) await client.close();
  }
}

function groupMoodsByDate(moodData: MoodData[]): MoodPattern[] {
  const dateGroups: { [key: string]: MoodData[] } = {};
  
  moodData.forEach(mood => {
    const date = new Date(mood.timestamp).toISOString().split('T')[0];
    if (!dateGroups[date]) dateGroups[date] = [];
    dateGroups[date].push(mood);
  });
  
  return Object.entries(dateGroups).flatMap(([date, moods]) => {
    const moodCounts: { [key: string]: number } = {};
    moods.forEach(mood => {
      moodCounts[mood.moodState] = (moodCounts[mood.moodState] || 0) + 1;
    });
    
    return Object.entries(moodCounts).map(([mood, frequency]) => ({
      date,
      mood,
      frequency,
      timeOfDay: getMostCommonTimeOfDay(moods.filter(m => m.moodState === mood)),
      sentiment: getAverageSentiment(moods.filter(m => m.moodState === mood))
    }));
  });
}

function getMostCommonTimeOfDay(moods: MoodData[]): string {
  const timeSlots: { [key: string]: number } & { morning: number; afternoon: number; evening: number; night: number } = {
    morning: 0,
    afternoon: 0,
    evening: 0,
    night: 0,
  };

  moods.forEach(mood => {
    const hour = new Date(mood.timestamp).getHours();
    if (hour >= 6 && hour < 12) timeSlots.morning++;
    else if (hour >= 12 && hour < 18) timeSlots.afternoon++;
    else if (hour >= 18 && hour < 22) timeSlots.evening++;
    else timeSlots.night++;
  });

  const maxEntry = Object.entries(timeSlots).reduce((max, current) => 
    timeSlots[max[0] as keyof typeof timeSlots] > timeSlots[current[0] as keyof typeof timeSlots] ? max : current
  );

  return maxEntry[0];
}

function getAverageSentiment(moods: MoodData[]): string {
  if (moods.length === 0) return 'neutral';
  
  const sentiments = moods.map(m => m.sentiment || 'neutral');
  const positive = sentiments.filter(s => s === 'positive').length;
  const negative = sentiments.filter(s => s === 'negative').length;
  
  if (positive > negative) return 'positive';
  if (negative > positive) return 'negative';
  return 'neutral';
}

function generateInsights(moodData: MoodData[]): PatternAnalysis['insights'] {
  if (moodData.length === 0) {
    return {
      dominantMood: 'No data',
      moodStability: 0,
      riskLevel: 'low',
      trendDirection: 'stable',
      criticalPatterns: ['Insufficient data for analysis']
    };
  }
  
  const moodCounts = moodData.reduce((acc, mood) => {
    acc[mood.moodState] = (acc[mood.moodState] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const dominantMood = Object.entries(moodCounts)
    .sort(([,a], [,b]) => (b as number) - (a as number))[0][0];
  
  const moodValues = { 'Happy': 3, 'Stressed': 2, 'Sad': 1 };
  const values = moodData.map(m => moodValues[m.moodState as keyof typeof moodValues] || 2);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
  const moodStability = Math.round((1 / (Math.sqrt(variance) + 0.1)) * 100) / 100;
  
  const sadPercentage = (moodCounts['Sad'] || 0) / moodData.length;
  const stressedPercentage = (moodCounts['Stressed'] || 0) / moodData.length;
  const consecutiveSad = calculateMaxConsecutiveSad(moodData);
  
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (consecutiveSad >= 7 || sadPercentage > 0.7) riskLevel = 'high';
  else if (consecutiveSad >= 3 || sadPercentage > 0.4 || stressedPercentage > 0.6) riskLevel = 'medium';
  
  const recentData = moodData.slice(-7);
  const olderData = moodData.slice(-14, -7);
  const recentAvg = recentData.reduce((acc, m) => acc + (moodValues[m.moodState as keyof typeof moodValues] || 2), 0) / recentData.length;
  const olderAvg = olderData.length > 0 ? olderData.reduce((acc, m) => acc + (moodValues[m.moodState as keyof typeof moodValues] || 2), 0) / olderData.length : recentAvg;
  
  let trendDirection: 'improving' | 'declining' | 'stable' = 'stable';
  if (recentAvg > olderAvg + 0.3) trendDirection = 'improving';
  else if (recentAvg < olderAvg - 0.3) trendDirection = 'declining';
  
  const criticalPatterns = [];
  if (consecutiveSad >= 5) criticalPatterns.push(`${consecutiveSad} consecutive sad days detected`);
  if (stressedPercentage > 0.5) criticalPatterns.push('High stress frequency detected');
  if (moodStability < 0.3) criticalPatterns.push('High mood volatility detected');
  if (moodData.length < 7) criticalPatterns.push('Limited data available for comprehensive analysis');
  
  return {
    dominantMood,
    moodStability,
    riskLevel,
    trendDirection,
    criticalPatterns
  };
}

function calculateMaxConsecutiveSad(moodData: MoodData[]): number {
  let maxConsecutive = 0;
  let currentConsecutive = 0;
  
  const sortedData = [...moodData].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  for (const mood of sortedData) {
    if (mood.moodState === 'Sad') {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 0;
    }
  }
  
  return maxConsecutive;
}

function generatePatternRecommendations(analysis: PatternAnalysis): string[] {
  const recommendations = [];
  const { insights } = analysis;
  
  if (insights.riskLevel === 'high') {
    recommendations.push('Consider reaching out to a mental health professional immediately');
    recommendations.push('Contact a crisis helpline if you need immediate support');
    recommendations.push('Inform a trusted friend or family member about how you&apos;re feeling');
  } else if (insights.riskLevel === 'medium') {
    recommendations.push('Schedule a check-in with a counselor or therapist');
    recommendations.push('Increase self-care activities and stress management techniques');
    recommendations.push('Consider joining a support group or mental health community');
  }
  
  if (insights.trendDirection === 'declining') {
    recommendations.push('Focus on identifying and addressing recent stressors');
    recommendations.push('Implement daily mindfulness or meditation practices');
    recommendations.push('Ensure you&apos;re maintaining healthy sleep and eating habits');
  } else if (insights.trendDirection === 'improving') {
    recommendations.push('Continue with current coping strategies that are working');
    recommendations.push('Document positive activities to repeat them');
    recommendations.push('Consider gradually increasing social activities');
  }
  
  if (insights.dominantMood === 'Stressed') {
    recommendations.push('Practice stress-reduction techniques like deep breathing');
    recommendations.push('Evaluate and potentially reduce sources of stress in your environment');
    recommendations.push('Consider time management and organizational strategies');
  }
  
  if (insights.moodStability < 0.5) {
    recommendations.push('Work on establishing consistent daily routines');
    recommendations.push('Track potential mood triggers in your environment');
    recommendations.push('Consider mood stabilization techniques with a professional');
  }
  
  return recommendations.slice(0, 6);
}

async function saveAnalysisResults(analysis: PatternAnalysis): Promise<void> {
  let client: MongoClient | null = null;
  
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db('mental_health_tracker');
    const analysisCollection = db.collection('mood_analysis');
    
    await analysisCollection.insertOne({
      ...analysis,
      createdAt: new Date()
    });
    
  } catch (error) {
    console.error('Error saving analysis results:', error);
  } finally {
    if (client) await client.close();
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '5');
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'userId is required',
        success: false 
      }, { status: 400 });
    }
    
    let client: MongoClient | null = null;
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db('mental_health_tracker');
    const analysisCollection = db.collection('mood_analysis');
    
    const analyses = await analysisCollection
      .find({ userId })
      .sort({ generatedAt: -1 })
      .limit(limit)
      .toArray();
    
    await client.close();
    
    return NextResponse.json({
      success: true,
      analyses,
      count: analyses.length
    });
    
  } catch (error: unknown) {
    console.error('Error retrieving analyses:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}