// File: app/api/moods/raw/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';

// Database connection utility
async function getDatabase() {
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }
  
  const client = await global._mongoClientPromise;
  return client.db('mental_health_tracker');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 401 });
    }

    // Get database connection
    const db = await getDatabase();
    const moodsCollection = db.collection('moods');

    // Fetch raw mood entries sorted by timestamp (most recent first)
    const moods = await moodsCollection
      .find({ userId: userId })
      .sort({ timestamp: -1 })
      .limit(50) // Limit to last 50 entries for performance
      .toArray();

    return NextResponse.json(moods, { status: 200 });
  } catch (error: unknown) {
  console.error('Server error fetching raw moods:', error instanceof Error ? error.message : String(error));
  return NextResponse.json({ error: "Unable to fetch insights" }, { status: 500 });
  }
  // Note: No client.close() here - keep connection alive for reuse
}

// Add global type declaration
declare global {
  var _mongoClientPromise: Promise<MongoClient>;
}