// File: app/api/moods/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);
const db = client.db('mental_health_tracker');
const moodsCollection = db.collection('moods');

// Create Supabase client for server-side0.
function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function POST(request: NextRequest) {
  console.log('=== POST /api/moods called ===');
  
  try {
    const body = await request.json();
    console.log('Request body received:', body);
    
    const { moodText, moodState, userId, timestamp, sentiment } = body;
    
    // Check if all required fields are present
    if (!moodText || !moodState || !userId) {
      console.log('Missing required fields:', { moodText: !!moodText, moodState: !!moodState, userId: !!userId });
      return NextResponse.json({ 
        error: 'Missing required fields',
        received: { moodText: !!moodText, moodState: !!moodState, userId: !!userId }
      }, { status: 400 });
    }

    const moodData = { 
      moodText, 
      moodState, 
      userId: userId,
      timestamp: new Date(timestamp),
      sentiment: sentiment || null,
      createdAt: new Date()
    };
    
    console.log('Prepared mood data for MongoDB:', moodData);
    
    // Connect to MongoDB and save
    await client.connect();
    console.log('Connected to MongoDB');
    
    const result = await moodsCollection.insertOne(moodData);
    console.log('MongoDB insert result:', result);
    
    const savedData = {
      ...moodData, 
      _id: result.insertedId,
      message: 'Mood saved successfully'
    };
    
    console.log('=== Success: Mood saved ===');
    return NextResponse.json(savedData, { status: 201 });
    
  } catch (error: any) {
    console.error('=== POST Error ===', error);
    return NextResponse.json({ 
      error: 'Server error while saving mood', 
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  } finally {
    // Close MongoDB connection
    try {
      await client.close();
      console.log('MongoDB connection closed');
    } catch (e) {
      console.warn('Failed to close MongoDB connection:', e);
    }
  }
}

export async function GET(request: NextRequest) {
  console.log('=== GET /api/moods called ===');
  
  try {
    // Get userId from query params
    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get('userId');
    
    console.log('GET request userId from params:', userIdParam);
    
    if (!userIdParam) {
      console.log('No userId in query params');
      return NextResponse.json({ error: 'User ID required in query params' }, { status: 400 });
    }

    console.log('Fetching moods for user:', userIdParam);
    
    // Connect to MongoDB and fetch
    await client.connect();
    console.log('Connected to MongoDB for GET request');
    
    const moods = await moodsCollection.find({ userId: userIdParam }).toArray();
    console.log('Raw moods found:', moods.length);
    
    // Aggregate mood data by state
    const aggregated = Object.entries(
      moods.reduce((acc: { [key: string]: number }, curr: any) => {
        acc[curr.moodState] = (acc[curr.moodState] || 0) + 1;
        return acc;
      }, {})
    ).map(([state, count]) => ({ state, count }));
    
    console.log('Aggregated data to return:', aggregated);
    console.log('=== GET Success ===');
    
    return NextResponse.json(aggregated, { status: 200 });
    
  } catch (error: any) {
    console.error('=== GET Error ===', error);
    return NextResponse.json({ 
      error: 'Failed to fetch moods', 
      details: error.message 
    }, { status: 500 });
  } finally {
    try {
      await client.close();
      console.log('MongoDB connection closed for GET');
    } catch (e) {
      console.warn('Failed to close MongoDB connection:', e);
    }
  }
}