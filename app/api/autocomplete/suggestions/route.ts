// File: app/api/autocomplete/suggestions/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface AutoCompleteRequest {
  text: string;
  currentMood: 'Happy' | 'Sad' | 'Stressed';
  context?: string[];
}

interface GeminiResponse {
  candidates: Array<{
    content: { parts: Array<{ text: string }> };
    finishReason: string;
  }>;
}

 
function createAutoCompletePrompt(text: string, mood: string, context: string[]): string {
  const contextInfo = context.length > 0 
    ? `Recent context: ${context.join(', ')}` 
    : 'No recent context';
    
  return `You are an AI assistant helping someone express their feelings. The user is currently feeling ${mood} and has started typing: "${text}"

${contextInfo}

Please suggest 5-8 SHORT, natural completions or related phrases that would help them express their emotions better. Focus on:
- Emotional vocabulary that matches their mood
- Natural, conversational phrases
- Helpful expressions for mental health tracking
- Avoid clinical/medical language

Return ONLY the suggestions, one per line, without numbering or extra formatting. Keep each suggestion under 6 words.

Examples for "feeling overwhelmed":
burnt out from work
exhausted and drained
stressed about everything
can't handle pressure
need a break desperately`;
}

function parseSuggestions(response: string): string[] {
  // Parse the Gemini response into clean suggestions
  const lines = response
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.match(/^\d+\./) && line.length < 50)
    .slice(0, 8); // Limit to 8 suggestions
    
  return lines.length > 0 ? lines : getFallbackSuggestions('', 'Happy');
}

 

function getFallbackSuggestions(text: string, mood: string): string[] {
  const textLower = text.toLowerCase();
  const suggestionMaps = {
    Happy: [
      'feeling joyful today',
      'grateful for small wins',
      'energized and optimistic',
      'content with life',
      'excited for tomorrow',
      'happy and relaxed'
    ],
    Sad: [
      'feeling a bit down',
      'struggling with emotions',
      'need some comfort',
      'having a tough day',
      'feeling isolated',
      'seeking some hope'
    ],
    Stressed: [
      'overwhelmed with work',
      'feeling anxious now',
      'need to unwind',
      'pressure is building',
      'stressed and tired',
      'seeking calm'
    ]
  };

  const keywordSuggestions: { [key: string]: string[] } = {
    'work': ['work is overwhelming', 'work-life balance issues', 'job stress', 'workplace tension'],
    'family': ['family concerns', 'family support needed', 'family conflicts', 'missing family time'],
    'sleep': ['trouble sleeping', 'restless nights', 'need better sleep', 'sleep deprivation'],
    'happy': ['feeling truly happy', 'joyful moments', 'grateful and happy', 'happiness boost'],
    'tired': ['mentally exhausted', 'physically drained', 'low energy', 'need rest']
  };

  // Check for keyword matches
  for (const [keyword, suggestions] of Object.entries(keywordSuggestions)) {
    if (textLower.includes(keyword)) {
      return suggestions.slice(0, 5);
    }
  }

  // Return mood-specific suggestions with randomization for variety
  const moodSuggestions = suggestionMaps[mood as keyof typeof suggestionMaps] || suggestionMaps.Happy;
  return moodSuggestions.sort(() => Math.random() - 0.5).slice(0, 5);
}

export async function POST(request: NextRequest) {
  console.log('=== Smart AutoComplete API called ===');
  try {
    const { text, currentMood, context = [] }: AutoCompleteRequest = await request.json();
    
    if (!text || text.trim().length < 2) {
      return NextResponse.json({ 
        suggestions: [],
        message: 'Type at least 2 characters for suggestions'
      }, { status: 200 });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json({ 
        suggestions: getFallbackSuggestions(text, currentMood),
        fallback: true
      }, { status: 200 });
    }

    const prompt = createAutoCompletePrompt(text, currentMood, context);
    const geminiResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + geminiApiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 200, topP: 0.9 }
        }),
      }
    );

    if (!geminiResponse.ok) {
      console.error('Gemini API error:', await geminiResponse.text());
      return NextResponse.json({
        suggestions: getFallbackSuggestions(text, currentMood),
        fallback: true
      }, { status: 200 });
    }

    const geminiData: GeminiResponse = await geminiResponse.json();
    const responseText = geminiData.candidates[0]?.content.parts[0]?.text || '';
    const suggestions = parseSuggestions(responseText);
    
    return NextResponse.json({
      suggestions,
      success: true,
      metadata: {
        model: 'gemini-1.5-flash',
        context_mood: currentMood,
        generated_at: new Date().toISOString()
      }
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('=== AutoComplete Error ===', error);
    const { text = '', currentMood = 'Happy' } = await request.json().catch(() => ({}));
    return NextResponse.json({
      suggestions: getFallbackSuggestions(text, currentMood),
      fallback: true,
      error: 'Suggestion service temporarily unavailable'
    }, { status: 200 });
  }
}