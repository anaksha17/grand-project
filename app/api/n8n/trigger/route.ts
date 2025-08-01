// app/api/n8n/trigger/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

interface N8nTriggerRequest {
  userId: string;
  moodText: string;
  moodState: 'Happy' | 'Sad' | 'Stressed';
  sentiment?: string;
  timestamp: string;
  userEmail?: string;
  userName?: string;
}
interface MoodEntry {
  timestamp: string | Date;
  moodState: string;
  [key: string]: unknown;
}
// Enhanced n8n response interface
interface N8nResponse {
  status?: string;
  recommendations?: string[] | boolean;
  supportSent?: boolean;
  aiInsights?: {
    riskLevel: 'low' | 'medium' | 'high';
    suggestions: string[];
    nextCheckIn?: string;
  };
  notifications?: {
    emailSent: boolean;
    pushSent: boolean;
    inAppSent: boolean;
  };
  workflowId?: string;
  executionId?: string;
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  console.log('=== n8n Trigger API called ===');
  
  try {
    const body: N8nTriggerRequest = await request.json();
    const { userId, moodText, moodState, sentiment, timestamp, userEmail, userName } = body;
    
    // Enhanced validation
    if (!userId || !moodText || !moodState) {
      return NextResponse.json({ 
        error: 'Missing required fields: userId, moodText, moodState',
        received: { userId: !!userId, moodText: !!moodText, moodState: !!moodState }
      }, { status: 400 });
    }

    // Validate moodState enum
    if (!['Happy', 'Sad', 'Stressed'].includes(moodState)) {
      return NextResponse.json({ 
        error: 'Invalid moodState. Must be: Happy, Sad, or Stressed',
        received: moodState
      }, { status: 400 });
    }

    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/mood-webhook';
    
    console.log(`Triggering n8n workflow at: ${n8nWebhookUrl}`);
    
    // Calculate consecutive sad days with better error handling
    const consecutiveSadDays = await calculateConsecutiveSadDays(userId);
    const moodHistory = await getMoodHistory(userId, 7); // Last 7 days
    
    // Enhanced payload with more context for n8n
    const n8nPayload = {
      userId,
      moodText,
      moodState,
      sentiment: sentiment || detectSentiment(moodText),
      timestamp,
      userEmail: userEmail || `user-${userId}@example.com`,
      userName: userName || `User ${userId.substring(0, 8)}`,
      consecutiveSadDays,
      moodHistory,
      riskFactors: {
        consecutiveSadDays,
        hasStressPattern: moodHistory.filter(m => m.moodState === 'Stressed').length >= 3,
        moodVariability: calculateMoodVariability(moodHistory),
        lastHappyMood: moodHistory.find(m => m.moodState === 'Happy')?.timestamp || null
      },
      triggerSource: 'mental-health-tracker',
      workflowVersion: 'v1.2',
      serverTimestamp: new Date().toISOString()
    };

    console.log('Sending payload to n8n:', JSON.stringify(n8nPayload, null, 2));

    // Enhanced n8n request with timeout and retries
    const n8nResponse = await fetchWithRetry(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mental-Health-Tracker/1.2',
        'X-Request-ID': `mht-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      },
      body: JSON.stringify(n8nPayload),
    }, 3);

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error('n8n webhook error:', {
        status: n8nResponse.status,
        statusText: n8nResponse.statusText,
        body: errorText
      });
      
      // Still return success to user but log the automation failure
      return NextResponse.json({
        success: true,
        message: 'Mood logged successfully (automation service temporarily unavailable)',
        n8nStatus: 'failed',
        n8nError: {
          status: n8nResponse.status,
          message: errorText.substring(0, 200) // Truncate error message
        },
        fallbackExecuted: true
      }, { status: 200 });
    }

    // Parse n8n response with better error handling
    let n8nResult: N8nResponse = {};
    try {
      const responseText = await n8nResponse.text();
      if (responseText.trim()) {
        n8nResult = JSON.parse(responseText);
      } else {
        n8nResult = { status: 'workflow_executed', message: 'No response body' };
      }
    } catch (parseError) {
      console.error('Failed to parse n8n response:', parseError);
      n8nResult = { status: 'parse_error', message: 'Workflow executed but response malformed' };
    }

    console.log('n8n workflow triggered successfully:', n8nResult);

    // Enhanced response with more detailed automation status
    return NextResponse.json({
      success: true,
      message: 'Mood logged and automation triggered successfully',
      n8nStatus: 'success',
      automation: {
        workflowExecuted: true,
        recommendationsGenerated: Array.isArray(n8nResult.recommendations) ? n8nResult.recommendations.length > 0 : !!n8nResult.recommendations,
        supportSent: n8nResult.supportSent || false,
        riskLevel: n8nResult.aiInsights?.riskLevel || 'unknown',
        notificationsSent: n8nResult.notifications || { emailSent: false, pushSent: false, inAppSent: false },
        workflowId: n8nResult.workflowId || 'mental-health-automation-v1.2',
        executionId: n8nResult.executionId || `exec-${Date.now()}`
      },
      analytics: {
        consecutiveSadDays,
        moodTrend: analyzeMoodTrend(moodHistory),
        riskFactors: n8nPayload.riskFactors
      },
      n8nResponse: n8nResult
    }, { status: 200 });

  } catch (error: unknown) {
  console.error('=== n8n Trigger Error ===', error);
  
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  
  // Enhanced error response
  return NextResponse.json({
    success: true, // Still success for the user
    message: 'Mood logged successfully (automation service temporarily unavailable)',
    n8nStatus: 'error',
    error: {
      message: errorMessage,
      type: errorName,
      timestamp: new Date().toISOString()
    },
    fallbackExecuted: true
  }, { status: 200 });
  }
}

// Enhanced consecutive sad days calculation
async function calculateConsecutiveSadDays(userId: string): Promise<number> {
  let client: MongoClient | null = null;
  
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    client = new MongoClient(uri);
    
    await client.connect();
    const db = client.db('mental_health_tracker');
    const moodsCollection = db.collection('moods');
    
    const recentMoods = await moodsCollection
      .find({ userId: userId })
      .sort({ timestamp: -1 })
      .limit(30) // Increased limit for better analysis
      .toArray();
    
    if (recentMoods.length === 0) return 0;
    
    let consecutiveDays = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

 interface MoodEntry {
  timestamp?: string | Date;
  moodState?: string;
  [key: string]: unknown;
}

const moodsByDate = new Map<string, MoodEntry[]>();
    recentMoods.forEach(mood => {
      const dateKey = new Date(mood.timestamp).toISOString().split('T')[0];
      if (!moodsByDate.has(dateKey)) {
        moodsByDate.set(dateKey, []);
      }
     moodsByDate.get(dateKey)!.push(mood as MoodEntry);
    });
    
    // Check consecutive sad days from today backwards
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateKey = checkDate.toISOString().split('T')[0];
      
      const dayMoods = moodsByDate.get(dateKey) || [];
      
      if (dayMoods.length === 0) {
        // No mood entries for this day, continue checking
        continue;
      }
      
      // Check if the predominant mood for the day was sad
      const sadMoods = dayMoods.filter(m => m.moodState === 'Sad');
      const isDaySad = sadMoods.length > dayMoods.length / 2;
      
      if (isDaySad) {
        consecutiveDays++;
      } else {
        break; // Break the streak
      }
    }
    
    return consecutiveDays;
    
  } catch (error) {
    console.error('Error calculating consecutive sad days:', error);
    return 0;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// New function to get mood history
async function getMoodHistory(userId: string, days: number): Promise<MoodEntry[]> {
  let client: MongoClient | null = null;
  
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    client = new MongoClient(uri);
    
    await client.connect();
    const db = client.db('mental_health_tracker');
    const moodsCollection = db.collection('moods');
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const moodHistory = await moodsCollection
      .find({ 
        userId: userId,
        timestamp: { $gte: startDate.toISOString() }
      })
      .sort({ timestamp: -1 })
      .toArray();
    
    return moodHistory as unknown as MoodEntry[];
    
  } catch (error) {
    console.error('Error fetching mood history:', error);
    return [];
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Simple sentiment detection
function detectSentiment(text: string): string {
  const positiveWords = ['happy', 'good', 'great', 'awesome', 'wonderful', 'amazing', 'fantastic'];
  const negativeWords = ['sad', 'bad', 'terrible', 'awful', 'horrible', 'depressed', 'anxious'];
  
  const lowerText = text.toLowerCase();
  const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

// Calculate mood variability
function calculateMoodVariability(moodHistory: MoodEntry[]): number {
  if (moodHistory.length < 2) return 0;
  
  const moodValues = { 'Happy': 3, 'Stressed': 2, 'Sad': 1 };
  const values = moodHistory.map(m => moodValues[m.moodState as keyof typeof moodValues] || 2);
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
  
  return Math.round(Math.sqrt(variance) * 100) / 100;
}

// Analyze mood trend
function analyzeMoodTrend(moodHistory: MoodEntry[]): string {
  if (moodHistory.length < 3) return 'insufficient_data';
  
  const moodValues = { 'Happy': 3, 'Stressed': 2, 'Sad': 1 };
  const recentAvg = moodHistory.slice(0, 3).reduce((acc, m) => 
    acc + (moodValues[m.moodState as keyof typeof moodValues] || 2), 0) / 3;
  const olderAvg = moodHistory.slice(-3).reduce((acc, m) => 
    acc + (moodValues[m.moodState as keyof typeof moodValues] || 2), 0) / 3;
  
  if (recentAvg > olderAvg + 0.3) return 'improving';
  if (recentAvg < olderAvg - 0.3) return 'declining';
  return 'stable';
}

// Fetch with retry logic
async function fetchWithRetry(url: string, options: RequestInit, retries: number): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response;
      
    } catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  console.log(`Fetch attempt ${i + 1} failed:`, errorMessage);
    }
  }
  
  throw new Error('All retry attempts failed');
}

// Enhanced health check
export async function GET() {
  try {
    const n8nUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/mood-webhook';
    const baseUrl = n8nUrl.replace('/webhook/mood-webhook', '');
    const healthCheckUrl = `${baseUrl}/healthz`;
    
    console.log(`Checking n8n health at: ${healthCheckUrl}`);
    
    const response = await fetch(healthCheckUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mental-Health-Tracker-HealthCheck/1.0'
      }
    });

    const isHealthy = response.ok;
    
    // Also test webhook endpoint
    let webhookTest = false;
    try {
      const testResponse = await fetch(n8nUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true, timestamp: new Date().toISOString() })
      });
      webhookTest = testResponse.status !== 404; // 404 means endpoint doesn't exist
    } catch (error) {
      console.log('Webhook test failed:', error);
    }
    
    return NextResponse.json({
      n8nStatus: isHealthy ? 'healthy' : 'unhealthy',
      webhookStatus: webhookTest ? 'accessible' : 'inaccessible',
      baseUrl,
      webhookUrl: n8nUrl,
      lastChecked: new Date().toISOString(),
      version: '1.2'
    }, { status: 200 });
    
  } catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  return NextResponse.json({
    n8nStatus: 'unreachable',
    error: errorMessage,
    lastChecked: new Date().toISOString(),
    version: '1.2'
  }, { status: 200 });

  }
}