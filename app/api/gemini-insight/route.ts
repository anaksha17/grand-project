// app/api/gemini-insight/route.ts
import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
      return NextResponse.json({ error: "MongoDB URI not configured" }, { status: 500 });
    }

    const client = new MongoClient(uri);
    try {
      await client.connect();
      const db = client.db('mental_health_tracker');
      const moodsCollection = db.collection('moods');
      const recentMoods = await moodsCollection
        .find({ userId })
        .sort({ timestamp: -1 })
        .limit(7)
        .toArray();

      if (!recentMoods.length) {
        return NextResponse.json({ insight: "No recent moods found." });
      }

      const moodData = recentMoods.map((entry) => ({
        mood: entry.moodState,
        day: new Date(entry.timestamp).toLocaleDateString("en-US", { weekday: "long" }),
        hour: new Date(entry.timestamp).getHours(),
        text_length: entry.moodText?.length || 0,
      }));

      const prompt = `You are an AI psychologist analyzing mood patterns. Based on this 7-day mood history, provide a brief insight or recommendation:

MOOD DATA:
${moodData
  .map((entry) => `${entry.day}: ${entry.mood} (hour: ${entry.hour}, text_length: ${entry.text_length})`)
  .join("\n")}

Return a concise response (max 100 words).`;

      const hfApiKey = process.env.HUGGINGFACE_API_KEY;
      if (!hfApiKey) {
        return NextResponse.json({ error: "Hugging Face API key missing" }, { status: 500 });
      }

      const response = await fetch(
        'https://api-inference.huggingface.co/models/j-hartmann/emotion-english-distilroberta-base', // Updated model
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${hfApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputs: prompt, options: { wait_for_model: true } }),
        }
      );

      if (!response.ok) throw new Error(`Hugging Face API error - Status: ${response.status}`);
      const hfData = await response.json();
      const dominantEmotion = hfData[0]?.[0]?.label || 'neutral'; // Get the top emotion
      const sentiment = dominantEmotion === 'joy' ? 'Happy' : dominantEmotion === 'sadness' ? 'Sad' : 'Stressed';
      const insight = `Insight: Your mood leans toward ${sentiment}. Consider ${sentiment === 'Happy' ? 'maintaining' : 'improving'} it with self-care.`;

      return NextResponse.json({ insight });
    } finally {
      await client.close();
    }
  } catch (error: unknown) {
  console.error("Gemini insight error:", error instanceof Error ? error.message : String(error));
  return NextResponse.json({ error: "Unable to fetch insights" }, { status: 500 });
  }
}