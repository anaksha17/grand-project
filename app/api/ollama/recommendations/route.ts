// app/api/ollama/recommendations/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface RecommendationRequest {
  moodText: string;
  moodState: 'Happy' | 'Sad' | 'Stressed';
  sentiment?: string; // Kept as part of the interface
  recentMoods?: string[];
}

interface HuggingFaceResponse {
  [0]: Array<{
    label: string;
    score: number;
  }>;
}

export async function POST(request: NextRequest) {
  console.log('=== Hugging Face Recommendations API called ===');

  let body: RecommendationRequest | null = null;

  try {
    body = await request.json();
    const { moodText, moodState, sentiment: detectedSentiment, recentMoods = [] } = body!; // Renamed sentiment to detectedSentiment
    
    if (!moodText || !moodState) {
      return NextResponse.json({ 
        error: 'Missing required fields: moodText and moodState' 
      }, { status: 400 });
    }

    // Create a comprehensive prompt for Hugging Face
    const contextualPrompt = createRecommendationPrompt(moodText, moodState, detectedSentiment, recentMoods);

    // Call Hugging Face API
    const hfApiKey = process.env.HUGGINGFACE_API_KEY;
    if (!hfApiKey) {
      return NextResponse.json({ 
        error: 'Missing HUGGINGFACE_API_KEY environment variable' 
      }, { status: 500 });
    }

    console.log('Calling Hugging Face API with prompt');
    
    const hfResponse = await fetch(
      'https://api-inference.huggingface.co/models/j-hartmann/emotion-english-distilroberta-base',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: contextualPrompt, options: { wait_for_model: true } }),
      }
    );

    if (!hfResponse.ok) {
      const errorText = await hfResponse.text();
      console.error('Hugging Face API error:', errorText);
      return NextResponse.json({ 
        error: 'Hugging Face service unavailable',
        details: errorText
      }, { status: 503 });
    }

    const hfData: HuggingFaceResponse = await hfResponse.json();
    const dominantEmotion = hfData[0][0]?.label || 'neutral'; // Get top emotion
    const sentiment = dominantEmotion === 'joy' ? 'Happy' : dominantEmotion === 'sadness' ? 'Sad' : 'Stressed';
    console.log('Hugging Face response received:', dominantEmotion);

    // Parse and structure the recommendation based on sentiment
    const recommendation = parseHuggingFaceResponse(contextualPrompt, sentiment, moodState);

    return NextResponse.json({
      success: true,
      recommendation,
      metadata: {
        model: 'j-hartmann/emotion-english-distilroberta-base',
        generated_at: new Date().toISOString(),
        input_mood: moodState,
        sentiment: sentiment
      }
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('=== Hugging Face Recommendations Error ===', error);
    
     
    // Fallback recommendations if Hugging Face API is unavailable
    const fallbackRecommendation = getFallbackRecommendation(body?.moodState || 'Happy');
    
    return NextResponse.json({
      success: false,
      error: 'AI service temporarily unavailable',
      recommendation: fallbackRecommendation,
      fallback: true
    }, { status: 200 });
}
}
function createRecommendationPrompt(
  moodText: string, 
  moodState: string, 
  detectedSentiment: string | undefined,
  recentMoods: string[]
): string {
  const moodContext = recentMoods.length > 0 
    ? `Recent mood pattern: ${recentMoods.slice(-5).join(', ')}` 
    : 'This is a new mood entry';
    
  return `You are a compassionate AI mental health assistant. A user has shared their current mood and feelings. Please provide personalized, actionable recommendations.

User's Current Mood: ${moodState}
User's Description: "${moodText}"
Sentiment Analysis: ${detectedSentiment || 'unknown'}
${moodContext}

Please provide recommendations in the following structure:
1. IMMEDIATE ACTION (1-2 activities for the next 30 minutes)
2. DAILY PRACTICE (1-2 sustainable daily habits)
3. MINDFULNESS TIP (a specific technique or breathing exercise)
4. AFFIRMATION (a positive, personalized affirmation)
5. PROFESSIONAL INSIGHT (when to consider talking to someone)

Keep recommendations:
- Practical and actionable
- Appropriate for the current mood state
- Evidence-based when possible
- Encouraging and non-judgmental
- Brief but meaningful (2-3 sentences per section)

Focus on immediate relief and long-term well-being. If the mood indicates distress, emphasize self-care and professional support options.`;
}

function parseHuggingFaceResponse(prompt: string, sentiment: string, moodState: string) {
  // Simulate parsing since Hugging Face provides emotion data, not structured text
  // Use sentiment to determine recommendations (simplified logic)
  const sections = {
    immediateAction: sentiment === 'Happy' ? 'Share your joy! Call a friend or write down three gratitudes.' :
                     sentiment === 'Sad' ? 'Take 5 deep breaths and listen to calming music.' :
                     'Pause and do the 5-4-3-2-1 grounding exercise.',
    dailyPractice: sentiment === 'Happy' ? 'Keep a joy journal and spend time outdoors.' :
                     sentiment === 'Sad' ? 'Set a gentle routine and connect with a friend.' :
                     'Break tasks into small steps and exercise daily.',
    mindfulness: sentiment === 'Happy' ? 'Practice loving-kindness meditation.' :
                     sentiment === 'Sad' ? 'Try the 4-7-8 breathing technique.' :
                     'Use progressive muscle relaxation.',
    affirmation: sentiment === 'Happy' ? 'I deserve this happiness and embrace it fully.' :
                     sentiment === 'Sad' ? 'It’s okay to feel this; I will heal with time.' :
                     'I am stronger than my stress and can overcome it.',
    professionalInsight: sentiment === 'Happy' ? 'Maintain this positivity with regular self-care.' :
                           sentiment === 'Sad' ? 'Seek help if sadness lasts over two weeks.' :
                           'Consider support if stress overwhelms you.'
  };

  return {
    mood: moodState,
    recommendations: sections,
    fullResponse: prompt, // Using prompt as fallback full response
    timestamp: new Date().toISOString()
  };
}

function getFallbackRecommendation(moodState: string) {
  const fallbacks = {
    Happy: {
      immediateAction: 'Share your positive energy! Call a friend or write down three things you\'re grateful for.',
      dailyPractice: 'Continue activities that bring you joy and consider helping others to amplify your positive mood.',
      mindfulness: 'Practice loving-kindness meditation: send good wishes to yourself and others.',
      affirmation: 'I deserve this happiness and I choose to embrace joy in my life.',
      professionalInsight: 'Maintain your positive mental health with regular check-ins and self-care practices.'
    },
    Sad: {
      immediateAction: 'Allow yourself to feel this emotion. Listen to calming music or take a gentle walk outside.',
      dailyPractice: 'Establish a comforting routine and reach out to supportive friends or family members.',
      mindfulness: 'Try body scan meditation to connect with your physical sensations and ground yourself.',
      affirmation: 'It\'s okay to feel sad. This feeling is temporary and I will get through this.',
      professionalInsight: 'If sadness persists for more than two weeks, consider speaking with a mental health professional.'
    },
    Stressed: {
      immediateAction: 'Stop what you\'re doing and practice the 5-4-3-2-1 grounding technique using your senses.',
      dailyPractice: 'Break large tasks into smaller steps and prioritize self-care activities like exercise or hobbies.',
      mindfulness: 'Use progressive muscle relaxation: tense and release each muscle group for 5 seconds.',
      affirmation: 'I can handle challenges one step at a time. I am stronger than my stress.',
      professionalInsight: 'Chronic stress can impact your health. Consider stress management techniques or counseling support.'
    }
  };

  return {
    mood: moodState,
    recommendations: fallbacks[moodState as keyof typeof fallbacks] || fallbacks.Happy,
    fullResponse: `Fallback recommendation for ${moodState} mood state.`,
    timestamp: new Date().toISOString(),
    fallback: true
  };
}