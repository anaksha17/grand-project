// app/api/ai/recommendations/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { moodState} = body;
    
    console.log('AI Recommendations request:', JSON.stringify(body, null, 2));
    
    // Generate recommendations based on mood state
    let recommendations = [];
    
    if (moodState === 'Sad') {
      recommendations = [
        "Take a 10-minute walk in nature",
        "Call a friend or family member",
        "Practice gratitude - write 3 things you're thankful for",
        "Listen to uplifting music"
      ];
    } else if (moodState === 'Stressed') {
      recommendations = [
        "Try 4-7-8 breathing technique",
        "Take a 5-minute meditation break",
        "Organize your workspace",
        "Drink water and stretch"
      ];
    } else {
      recommendations = [
        "Keep up the good work!",
        "Consider journaling about your day",
        "Share positive energy with others"
      ];
    }
    
    const response = {
      success: true,
      recommendations: recommendations,
      aiRecommendations: recommendations.join(', '),
      message: 'AI recommendations generated'
    };
    
    return NextResponse.json(response, { status: 200 });

  } catch (error: unknown) {
    console.error('AI Recommendations error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}