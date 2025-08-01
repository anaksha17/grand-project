// File: app/api/users/route.ts
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, userId, profile = {}, preferences = {} } = body;

    if (!email || !userId) {
      return NextResponse.json({ error: 'Email and userId are required' }, { status: 400 });
    }

    const db = await getDatabase();
    const usersCollection = db.collection('users');

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ userId });
    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 });
    }

    const userData = {
      email,
      userId,
      profile: {
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        age: profile.age || null,
        phoneNumber: profile.phoneNumber || '',
        bio: profile.bio || '',
        avatar: profile.avatar || '',
        timezone: profile.timezone || 'UTC',
        location: {
          city: profile.location?.city || '',
          country: profile.location?.country || ''
        }
      },
      preferences: {
        notifications: preferences.notifications ?? true,
        reminderTime: preferences.reminderTime || '09:00',
        theme: preferences.theme || 'auto'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await usersCollection.insertOne(userData);

    // Initialize user stats
    await db.collection('user_stats').insertOne({
      userId,
      currentStreak: 0,
      longestStreak: 0,
      totalMoodEntries: 0,
      thisWeekEntries: 0,
      weeklyStats: [],
      updatedAt: new Date()
    });

    return NextResponse.json({ 
      ...userData, 
      _id: result.insertedId,
      message: 'User created successfully' 
    }, { status: 201 });

  } catch (error: unknown) {
  console.error('user Details Error', error);
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  return NextResponse.json(
    { error: 'Failed to fetch user stats', details: errorMessage },
    { status: 500 }
  );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const db = await getDatabase();
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ userId });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user, { status: 200 });

  } catch (error: unknown) {
  console.error('Get user error:', error);
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  return NextResponse.json(
    { error: 'Failed to fetch user stats', details: errorMessage },
    { status: 500 }
  );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, profile, preferences } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const db = await getDatabase();
    const usersCollection = db.collection('users');

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    
    if (profile) {
      updateData['profile'] = profile;
    }
    
    if (preferences) {
      updateData['preferences'] = preferences;
    }

    const result = await usersCollection.updateOne(
      { userId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updatedUser = await usersCollection.findOne({ userId });

    return NextResponse.json({ 
      ...updatedUser,
      message: 'User updated successfully' 
    }, { status: 200 });

  } catch (error: unknown) {
  console.error('Get user update error:', error);
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  return NextResponse.json(
    { error: 'Failed to update user stats', details: errorMessage },
    { status: 500 }
  );
  }
}

// Add global type declaration
declare global {
  var _mongoClientPromise: Promise<MongoClient>;
}