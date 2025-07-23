import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { supabaseClient } from '../../../utils/supabase/server';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is not defined in .env.local');

const client = new MongoClient(uri);

export async function POST(request: Request) {
  try {
    const { moodText, moodState, userId, timestamp } = await request.json();
    if (!moodText || !moodState || !userId) throw new Error('Missing required fields');

    await client.connect();
    const database = client.db('mental-health');
    const collection = database.collection('moodLogs');
    await collection.insertOne({ moodText, moodState, userId, timestamp });

    return NextResponse.json({ message: 'Mood saved successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    await client.close();
  }
}