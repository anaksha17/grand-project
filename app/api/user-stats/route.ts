import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);
const db = client.db('mental_health_tracker');
const statsCollection = db.collection('user_stats');
const moodsCollection = db.collection('moods');

interface UserStats {
  _id?: import('mongodb').ObjectId;
  userId: string;
  currentStreak: number;
  longestStreak: number;
  totalMoodEntries: number;
  thisWeekEntries: number;
weeklyStats: Array<Record<string, unknown>>; // You can refine this if weeklyStats structure is known
  updatedAt: Date;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    await client.connect();

    // Get or create user stats
    const foundStats = await statsCollection.findOne({ userId });
    let userStats: UserStats;

    if (!foundStats) {
      userStats = {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        totalMoodEntries: 0,
        thisWeekEntries: 0,
        weeklyStats: [],
        updatedAt: new Date(),
      };
      await statsCollection.insertOne(userStats);
    } else {
      userStats = foundStats as UserStats;
    }

    // Calculate real-time stats
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    // Get this week's entries
    const thisWeekEntries = await moodsCollection.countDocuments({
      userId,
      timestamp: { $gte: startOfWeek, $lt: endOfWeek },
    });

    // Get total entries
    const totalEntries = await moodsCollection.countDocuments({ userId });

    // Calculate streak
    const streak = await calculateStreak(userId);

    // Update stats in database
    const longestStreak = Math.max(streak.current, userStats.longestStreak || 0);

    await statsCollection.updateOne(
      { userId },
      {
        $set: {
          thisWeekEntries,
          totalMoodEntries: totalEntries,
          currentStreak: streak.current,
          longestStreak,
          updatedAt: new Date(),
        },
      }
    );

    const weekPercentage = Math.round((thisWeekEntries / 7) * 100);

    return NextResponse.json(
      {
        currentStreak: streak.current,
        longestStreak,
        totalMoodEntries: totalEntries,
        thisWeekEntries,
        weekPercentage,
        streakStartDate: streak.startDate,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
  console.error('Get user stats error:', error);
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  return NextResponse.json(
    { error: 'Failed to fetch user stats', details: errorMessage },
    { status: 500 }
  );
  } finally {
    await client.close();
  }
}

async function calculateStreak(userId: string) {
  try {
    const entries = await moodsCollection
      .find({ userId }, { projection: { timestamp: 1 } })
      .sort({ timestamp: -1 })
      .toArray();

    if (entries.length === 0) {
      return { current: 0, startDate: null };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const dateMap = new Map<string, boolean>();
    entries.forEach((entry) => {
      const date = new Date(entry.timestamp);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      dateMap.set(dateStr, true);
    });

    let streak = 0;
    let currentDate = new Date();

    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (dateMap.has(todayStr)) {
      currentDate = today;
    } else if (dateMap.has(yesterdayStr)) {
      currentDate = yesterday;
    } else {
      return { current: 0, startDate: null };
    }

    let streakStartDate = new Date(currentDate);
    while (true) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (dateMap.has(dateStr)) {
        streak++;
        streakStartDate = new Date(currentDate);
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return { current: streak, startDate: streakStartDate };
  } catch (error) {
    console.error('Error calculating streak:', error);
    return { current: 0, startDate: null };
  }
}
