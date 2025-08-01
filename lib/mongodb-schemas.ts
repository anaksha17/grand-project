// MongoDB Collections Schema Setup
// File: lib/mongodb-schemas.ts
import { Db } from 'mongodb';
export interface User {
  _id?: string;
  email: string;
  userId: string; // From auth system
  profile: {
    firstName?: string;
    lastName?: string;
    age?: number;
    phoneNumber?: string;
    bio?: string;
    avatar?: string;
    timezone?: string;
    location?: {
      city?: string;
      country?: string;
    };
  };
  preferences: {
    notifications: boolean;
    reminderTime?: string;
    theme?: 'light' | 'dark' | 'auto';
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface MoodEntry {
  _id?: string;
  moodText: string;
  moodState: "Happy" | "Sad" | "Stressed";
  userId: string;
  timestamp: Date;
  sentiment?: string;
  createdAt: Date;
}

export interface WellnessGoal {
  _id?: string;
  userId: string;
  title: string;
  description?: string;
  category: 'daily' | 'weekly' | 'monthly';
  targetValue?: number;
  currentProgress?: number;
  isCompleted: boolean;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface UserStats {
  _id?: string;
  userId: string;
  currentStreak: number;
  longestStreak: number;
  totalMoodEntries: number;
  thisWeekEntries: number;
  lastEntryDate?: Date;
  streakStartDate?: Date;
  weeklyStats: {
    week: string; // ISO week format: 2024-W01
    entriesCount: number;
    dominantMood: string;
  }[];
  updatedAt: Date;
}

// Database initialization script
export const initializeCollections = async (db: Db) => {
  try {
    // Create indexes for better performance
    await db.collection('users').createIndex({ userId: 1 }, { unique: true });
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    
    await db.collection('moods').createIndex({ userId: 1 });
    await db.collection('moods').createIndex({ timestamp: -1 });
    await db.collection('moods').createIndex({ userId: 1, timestamp: -1 });
    
    await db.collection('wellness_goals').createIndex({ userId: 1 });
    await db.collection('wellness_goals').createIndex({ userId: 1, category: 1 });
    await db.collection('wellness_goals').createIndex({ dueDate: 1 });
    
    await db.collection('user_stats').createIndex({ userId: 1 }, { unique: true });
    
    console.log('MongoDB collections and indexes created successfully');
  } catch (error) {
    console.error('Error initializing collections:', error);
  }
};