// File: app/api/moods/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);
const db = client.db('mental_health_tracker');
const moodsCollection = db.collection('moods');

 

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
    
    // ** IMPORTANT: Trigger n8n workflow after successful mood save **
    console.log('🚀 Triggering n8n workflow...');
    await triggerN8nWorkflow({
      userId,
      moodText,
      moodState,
      sentiment: sentiment || 'neutral',
      timestamp: timestamp || new Date().toISOString()
    });
    
    console.log('=== Success: Mood saved and n8n triggered ===');
    return NextResponse.json(savedData, { status: 201 });
    
  }catch (error: unknown) {
  console.error('=== POST Error ===', error);
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorStack = error instanceof Error ? error.stack : undefined;
  return NextResponse.json({ 
    error: 'Server error while saving mood', 
    details: errorMessage,
    stack: errorStack
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

// Function to trigger n8n workflow
async function triggerN8nWorkflow(moodData: {
  userId: string;
  moodText: string;
  moodState: string;
  sentiment: string;
  timestamp: string;
}) {
  try {
    console.log('Calling n8n trigger API...');
    
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/n8n/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(moodData),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ n8n workflow triggered successfully:', result);
    } else {
      const error = await response.text();
      console.warn('⚠️ n8n trigger failed (non-critical):', error);
    }
  } catch (error) {
    console.warn('⚠️ n8n trigger error (non-critical):', error);
    // Don't throw error - n8n failure shouldn't break mood logging
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
    
  }catch (error: unknown) {
  console.error('=== GET Error ===', error);
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  return NextResponse.json({ 
    error: 'Failed to fetch moods', 
    details: errorMessage 
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