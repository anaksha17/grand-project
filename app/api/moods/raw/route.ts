// File: app/api/moods/raw/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);
const db = client.db('mental_health_tracker');
const moodsCollection = db.collection('moods');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 401 });
    }

    await client.connect();
    // Fetch raw mood entries sorted by timestamp (most recent first)
    const moods = await moodsCollection
      .find({ userId: userId })
      .sort({ timestamp: -1 })
      .limit(50) // Limit to last 50 entries for performance
      .toArray();

    return NextResponse.json(moods, { status: 200 });
  } catch (error: any) {
    console.error('Server error fetching raw moods:', error.message);
    return NextResponse.json({ error: 'Failed to fetch raw mood data' }, { status: 500 });
  } finally {
    try {
      await client.close();
    } catch (e) {
      console.warn('Failed to close MongoDB connection:', e);
    }
  }
}