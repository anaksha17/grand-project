// File: app/api/wellness-goals/route.ts
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
    const { userId, title, description, category, targetValue, dueDate } = body;

    if (!userId || !title || !category) {
      return NextResponse.json({ 
        error: 'userId, title, and category are required' 
      }, { status: 400 });
    }

    const db = await getDatabase();
    const goalsCollection = db.collection('wellness_goals');

    const goalData = {
      userId,
      title,
      description: description || '',
      category,
      targetValue: targetValue || 1,
      currentProgress: 0,
      isCompleted: false,
      dueDate: dueDate ? new Date(dueDate) : null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await goalsCollection.insertOne(goalData);

    return NextResponse.json({
      ...goalData,
      _id: result.insertedId,
      message: 'Goal created successfully'
    }, { status: 201 });

  } catch (error: unknown) {
  console.error('Goal Error:', error);
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  return NextResponse.json(
    { error: 'Failed to create the goal', details: errorMessage },
    { status: 500 }
  );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const category = searchParams.get('category');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const db = await getDatabase();
    const goalsCollection = db.collection('wellness_goals');

    const filter: Record<string, unknown> = { userId };
    if (category) {
      filter.category = category;
    }

    const goals = await goalsCollection.find(filter).sort({ createdAt: -1 }).toArray();

    return NextResponse.json(goals, { status: 200 });

  }catch (error: unknown) {
  console.error('Get goals error:', error);
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  return NextResponse.json({ 
    error: 'Failed to fetch goals', 
    details: errorMessage 
  }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { goalId, currentProgress, isCompleted, title, description } = body;

    if (!goalId) {
      return NextResponse.json({ error: 'goalId is required' }, { status: 400 });
    }

    const db = await getDatabase();
    const goalsCollection = db.collection('wellness_goals');

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (currentProgress !== undefined) updateData.currentProgress = currentProgress;
    if (isCompleted !== undefined) {
      updateData.isCompleted = isCompleted;
      if (isCompleted) updateData.completedAt = new Date();
    }
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;

    const result = await goalsCollection.updateOne(
      { _id: goalId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Goal updated successfully' }, { status: 200 });

  }  catch (error: unknown) {
  console.error('Goal update error:', error);
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  return NextResponse.json({ 
    error: 'Failed to update goal', 
    details: errorMessage 
  }, { status: 500 });
  }
}

// Add global type declaration
declare global {
  var _mongoClientPromise: Promise<MongoClient>;
}