'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

// Types
interface MoodData {
  state: string;
  count: number;
}
 
function debounce(func: (text: string) => void, wait: number): (text: string) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (text: string) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(text), wait);
  };
}
interface MoodEntry {
  _id?: string;
  moodText: string;
  moodState: "Happy" | "Sad" | "Stressed";
  userId: string;
  timestamp: Date;
  sentiment?: string;
}

interface UserProfile {
  _id?: string;
  email: string;
  userId: string;
  profile: {
    firstName?: string;
    lastName?: string;
    age?: string;
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
  createdAt?: Date;
  updatedAt?: Date;
}

interface WellnessGoal {
  _id?: string;
  userId: string;
  title: string;
  description?: string;
  category: 'daily' | 'weekly' | 'monthly';
  targetValue?: number;
  currentProgress?: number;
  isCompleted: boolean;
  dueDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserStats {
  currentStreak: number;
  longestStreak: number;
  totalMoodEntries: number;
  thisWeekEntries: number;
  weekPercentage: number;
  streakStartDate?: Date;
}

interface RecommendationResponse {
  success: boolean;
  recommendation: {
    mood: string;
    recommendations: {
      immediateAction: string;
      dailyPractice: string;
      mindfulness: string;
      affirmation: string;
      professionalInsight: string;
    };
    fullResponse: string;
    timestamp: string;
    fallback?: boolean;
  };
  metadata?: {
    model: string;
    generated_at: string;
    input_mood: string;
    sentiment: string;
  };
  error?: string;
}



export default function MoodLog() {
  // User and authentication state
  const [currentUserId] = useState<string>("user_123"); 
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
 const [moodText, setMoodText] = useState<string>("");
const [moodState, setMoodState] = useState<"Happy" | "Sad" | "Stressed">("Happy");
const [moodData, setMoodData] = useState<MoodData[]>([]);
const [rawMoodEntries, setRawMoodEntries] = useState<MoodEntry[]>([]);
const [geminiInsight, setGeminiInsight] = useState<string>(
  "Welcome to your mental health journey! 🌟\n\nStart by logging your mood to get personalized AI insights and recommendations."
);

  // Wellness goals state
  const [wellnessGoals, setWellnessGoals] = useState<WellnessGoal[]>([]);
  const [newGoal, setNewGoal] = useState({ title: '', description: '', category: 'daily' as 'daily' | 'weekly' | 'monthly' });
  const [isGoalsLoading, setIsGoalsLoading] = useState(false);


const [currentMonth, setCurrentMonth] = useState(new Date());
  // User stats state
  const [userStats, setUserStats] = useState<UserStats>({
    currentStreak: 0,
    longestStreak: 0,
    totalMoodEntries: 0,
    thisWeekEntries: 0,
    weekPercentage: 0
  });

  // UI state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
 
  // Refs
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
 

  // Load user data on component mount
  useEffect(() => {
    initializeUser();
    fetchUserStats();
    fetchMoodData();
    loadWellnessGoals();
  }, [currentUserId]);

  // Initialize or fetch user profile
  const initializeUser = async () => {
    try {
      setIsProfileLoading(true);
      
      // Try to fetch existing user
      const response = await fetch(`/api/users?userId=${currentUserId}`);
      
      if (response.ok) {
        const user = await response.json();
        setUserProfile(user);
      } else if (response.status === 404) {
        // User doesn't exist, create new user
        const createResponse = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            email: 'user@example.com', // This would come from your auth system
            profile: {},
            preferences: {}
          })
        });
        
        if (createResponse.ok) {
          const newUser = await createResponse.json();
          setUserProfile(newUser);
        }
      }
    } catch (error) {
      console.error('Error initializing user:', error);
    } finally {
      setIsProfileLoading(false);
    }
  };

  // Fetch user statistics
  const fetchUserStats = async () => {
    try {
      const response = await fetch(`/api/user-stats?userId=${currentUserId}`);
      if (response.ok) {
        const stats = await response.json();
        setUserStats(stats);
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const fetchMoodData = async () => {
  try {
    if (!currentUserId) {
      throw new Error('User ID is missing');
    }

    console.log('Fetching mood data for userId:', currentUserId);

    // Helper function to fetch with retry
    const fetchWithRetry = async (url: string, retries = 2): Promise<MoodEntry[]> => {
      for (let attempt = 1; attempt <= retries + 1; attempt++) {
        try {
          const response = await fetch(url, { cache: 'no-store' });
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Fetch failed with status ${response.status} on attempt ${attempt}/${retries + 1}:`, errorText);
            throw new Error(`HTTP error ${response.status}: ${errorText}`);
          }
          const data: MoodEntry[] = await response.json();
          console.log('Fetched raw mood data:', data);
          return data;
        } catch (error) {
          if (attempt <= retries) {
            console.warn(`Retrying fetch (attempt ${attempt}/${retries}) due to error:`, error);
            await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5s before retry
            continue;
          }
          throw error;
        }
      }
      throw new Error('Max retries reached');
    };

    // Fetch raw mood entries from /api/moods/raw
    const rawData: MoodEntry[] = await fetchWithRetry(`/api/moods/raw?userId=${currentUserId}`);
    console.log('Raw mood entries from /api/moods/raw:', rawData);
    setRawMoodEntries(rawData);

    // Process raw data for pie chart and moodData
    if (rawData && rawData.length > 0) {
      const moodCounts = rawData.reduce(
        (acc: Record<string, number>, entry: MoodEntry) => {
          acc[entry.moodState] = (acc[entry.moodState] || 0) + 1;
          return acc;
        },
        { Happy: 0, Sad: 0, Stressed: 0 }
      );

      setMoodData(
        Object.entries(moodCounts).map(([state, count]) => ({
          state,
          count: count as number,
        })) as MoodData[]
      );
    } else {
      console.log('No mood data available, setting default moodData');
      setMoodData([
        { state: 'Happy', count: 0 },
        { state: 'Sad', count: 0 },
        { state: 'Stressed', count: 0 }
      ]);
    }
  }  catch (error: unknown) {
  console.error('Error fetching mood data:', error instanceof Error ? error.message : 'Unknown error', error instanceof Error ? error.stack : '');
  setMoodData([
    { state: 'Happy', count: 0 },
    { state: 'Sad', count: 0 },
    { state: 'Stressed', count: 0 }
  ]);
  setRawMoodEntries([]);
  }
};


const drawMoodPieChart = useCallback(() => {
  if (!chartCanvasRef.current) return;
  
  const ctx = chartCanvasRef.current.getContext('2d');
  if (!ctx) return;
  
  const canvas = chartCanvasRef.current;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(centerX, centerY) - 40;
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Set canvas background
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  const labels = moodData.map((d) => d.state);
  const data = moodData.map((d) => d.count);
  const colors = [
    '#10B981', // Happy: Green
    '#EF4444', // Sad: Red  
    '#F59E0B', // Stressed: Orange
  ];
  
  // Calculate total
  const total = data.reduce((sum, value) => sum + value, 0);
  
  // If no data, show "No data" message
  if (total === 0) {
    ctx.fillStyle = '#6B7280';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('No mood data available', centerX, centerY - 10);
    ctx.font = '14px Arial';
    ctx.fillText('Log some moods to see your distribution!', centerX, centerY + 15);
    return;
  }
  
  let currentAngle = -Math.PI / 2; // Start from top
  
  // Draw pie slices
  data.forEach((value, index) => {
    if (value === 0) return; // Skip empty slices
    
    const sliceAngle = (value / total) * 2 * Math.PI;
    
    // Draw slice
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = colors[index];
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Draw label with percentage
    const labelAngle = currentAngle + sliceAngle / 2;
    const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
    const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);
    const percentage = Math.round((value / total) * 100);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${labels[index]}`, labelX, labelY - 8);
    ctx.font = '10px Arial';
    ctx.fillText(`${value} (${percentage}%)`, labelX, labelY + 8);
    
    currentAngle += sliceAngle;
  });
  
  // Draw title
  ctx.fillStyle = '#1F2937';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Mood Distribution (Last 30 Days)', centerX, 30);
  
  // Draw legend
  const legendY = canvas.height - 60;
  const legendSpacing = 120;
  const startX = centerX - (legendSpacing * (labels.length - 1)) / 2;
  
  labels.forEach((label, index) => {
    const legendX = startX + index * legendSpacing;
    
    // Draw color box
    ctx.fillStyle = colors[index];
    ctx.fillRect(legendX - 8, legendY - 8, 16, 16);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(legendX - 8, legendY - 8, 16, 16);
    
    // Draw text
    ctx.fillStyle = '#374151';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(label, legendX, legendY + 25);
    ctx.fillText(`${data[index]}`, legendX, legendY + 40);
  });
  
}, [moodData]);

useEffect(() => {
  if (activeTab === 'analytics') {
   
    const timer = setTimeout(() => {
      drawMoodPieChart();
       
    }, 200);
    return () => clearTimeout(timer);
  }
}, [activeTab, moodData, rawMoodEntries, drawMoodPieChart]);

 

const renderAnalyticsTab = () => (
  <div className="space-y-6">
    <div className="bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 rounded-3xl p-6 border border-purple-200/30">
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-400/80 to-indigo-500/80 rounded-2xl flex items-center justify-center shadow-inner">
          <span className="text-2xl text-white">📊</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Analytics & Insights</h2>
          <p className="text-gray-600">Deep dive into your mood patterns</p>
        </div>
      </div>
    </div>

    {/* Mood Distribution Pie Chart */}
    <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-2xl p-6 border border-emerald-200/50">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Mood Distribution</h3>
      {moodData.length > 0 ? (
        <canvas ref={chartCanvasRef} width={500} height={400} className="w-full h-auto max-w-full" />
      ) : (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-2">📊</div>
            <p>No mood data available</p>
            <p className="text-sm">Log some moods to see your distribution!</p>
          </div>
        </div>
      )}
    </div>

    {/* Analytics Stats Cards */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-blue-200/50">
        <div className="text-center">
          <div className="text-3xl font-bold text-blue-600">{rawMoodEntries.length}</div>
          <div className="text-sm text-gray-600">Total Entries</div>
        </div>
      </div>
      <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-green-200/50">
        <div className="text-center">
          <div className="text-3xl font-bold text-green-600">{userStats.thisWeekEntries}</div>
          <div className="text-sm text-gray-600">This Week</div>
        </div>
      </div>
      <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-purple-200/50">
        <div className="text-center">
          <div className="text-3xl font-bold text-purple-600">{userStats.currentStreak}</div>
          <div className="text-sm text-gray-600">Current Streak</div>
        </div>
      </div>
      <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-orange-200/50">
        <div className="text-center">
          <div className="text-3xl font-bold text-orange-600">
            {moodData.length > 0 ? moodData.reduce((max, mood) => mood.count > max.count ? mood : max, moodData[0]).state : 'N/A'}
          </div>
          <div className="text-sm text-gray-600">Dominant Mood</div>
        </div>
      </div>
    </div>

    {/* Mood Breakdown Table */}
    {moodData.length > 0 && (
      <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-2xl p-6 border border-gray-200/50">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Detailed Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-4 font-semibold text-gray-700">Mood</th>
                <th className="text-left py-2 px-4 font-semibold text-gray-700">Count</th>
                <th className="text-left py-2 px-4 font-semibold text-gray-700">Percentage</th>
                <th className="text-left py-2 px-4 font-semibold text-gray-700">Visual</th>
              </tr>
            </thead>
            <tbody>
              {moodData.map((mood, index) => {
                const total = moodData.reduce((sum, m) => sum + m.count, 0);
                const percentage = total > 0 ? Math.round((mood.count / total) * 100) : 0;
                return (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">
                          {mood.state === 'Happy' ? '😊' : mood.state === 'Stressed' ? '😰' : '😢'}
                        </span>
                        <span className="font-medium">{mood.state}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold">{mood.count}</td>
                    <td className="py-3 px-4">{percentage}%</td>
                    <td className="py-3 px-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            mood.state === 'Happy' ? 'bg-green-500' :
                            mood.state === 'Stressed' ? 'bg-orange-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>
);

 
const getMoodForDate = (date: Date) => {
  const dateString = date.toISOString().split('T')[0];

  const moodsForDate = rawMoodEntries.filter(entry => {
    // Check if timestamp exists and is valid
    if (!entry.timestamp || isNaN(new Date(entry.timestamp).getTime())) {
      console.warn(`Invalid timestamp for entry: ${JSON.stringify(entry)}`);
      return false; // Skip entries with invalid timestamps
    }

    const entryDate = new Date(entry.timestamp).toISOString().split('T')[0];
    return entryDate === dateString;
  });

  if (moodsForDate.length === 0) return null;

  // Get the most recent mood for that date
  const latestMood = moodsForDate.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];

  return latestMood.moodState;
};

const getMoodEmoji = (moodState: string) => {
  switch (moodState) {
    case 'Happy': return '😊';
    case 'Sad': return '😢';
    case 'Stressed': return '😰';
    default: return '';
  }
};

const getMoodColor = (moodState: string) => {
  switch (moodState) {
    case 'Happy': return 'bg-green-500';
    case 'Sad': return 'bg-red-500';
    case 'Stressed': return 'bg-orange-500';
    default: return 'bg-gray-300';
  }
};

const generateCalendarDays = () => {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());
  
  const days = [];
  const today = new Date();
  
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    
    const isCurrentMonth = date.getMonth() === month;
    const isToday = date.toDateString() === today.toDateString();
    const mood = getMoodForDate(date);
    
    days.push({
      date,
      day: date.getDate(),
      isCurrentMonth,
      isToday,
      mood
    });
  }
  
  return days;
};

const navigateMonth = (direction: 'prev' | 'next') => {
  setCurrentMonth(prev => {
    const newMonth = new Date(prev);
    if (direction === 'prev') {
      newMonth.setMonth(prev.getMonth() - 1);
    } else {
      newMonth.setMonth(prev.getMonth() + 1);
    }
    return newMonth;
  });
};

  // Load wellness goals
  const loadWellnessGoals = async () => {
    try {
      setIsGoalsLoading(true);
      const response = await fetch(`/api/wellness-goals?userId=${currentUserId}`);
      if (response.ok) {
        const goals = await response.json();
        setWellnessGoals(goals);
      }
    } catch (error) {
      console.error('Error loading wellness goals:', error);
    } finally {
      setIsGoalsLoading(false);
    }
  };

  // Create new wellness goal
  const createWellnessGoal = async () => {
    if (!newGoal.title.trim()) return;

    try {
      const response = await fetch('/api/wellness-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          ...newGoal
        })
      });

      if (response.ok) {
        setNewGoal({ title: '', description: '', category: 'daily' });
        loadWellnessGoals();
      }
    } catch (error) {
      console.error('Error creating wellness goal:', error);
    }
  };

  // Update goal progress
  const updateGoalProgress = async (goalId: string, isCompleted: boolean) => {
    try {
      const response = await fetch('/api/wellness-goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId, isCompleted })
      });

      if (response.ok) {
        loadWellnessGoals();
      }
    } catch (error) {
      console.error('Error updating goal:', error);
    }
  };

const updateUserProfile = async (profileData: Partial<UserProfile>) => {
  try {
    const response = await fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUserId,
        ...profileData
      })
    });

    if (response.ok) {
      const updatedUser: UserProfile = await response.json();
      setUserProfile(updatedUser);
      setIsEditingProfile(false);
    }
  } catch (error) {
    console.error('Error updating profile:', error);
  }
};
  // Existing functions (suggestions, charts, etc.)
  const getSuggestions = async (text: string) => {
    if (text.length >= 2) {
      setSuggestions([
        "I'm feeling grateful for the small moments today",
        "Today brought some challenges but I'm managing well",
        "I notice I'm more anxious than usual, need to take breaks"
      ]);
      setShowSuggestions(true);
    }
  };

  const debouncedGetSuggestions = useCallback(
  debounce((text: string) => {
    if (text.length >= 2) {
      getSuggestions(text);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, 300),
  []
);

  useEffect(() => {
    debouncedGetSuggestions(moodText);
  }, [moodText, debouncedGetSuggestions]);

  

  const selectSuggestion = (suggestion: string) => {
    setMoodText(suggestion);
    setShowSuggestions(false);
    setSuggestions([]);
  };


    

  
const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setIsLoading(true);

  try {
    // Save mood to MongoDB
    const moodResponse = await fetch('/api/moods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moodText,
        moodState,
        userId: currentUserId,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!moodResponse.ok) {
      throw new Error('Failed to save mood');
    }

    // Fetch AI recommendations from /api/ollama/recommendations
    const recommendationResponse = await fetch('/api/ollama/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moodText,
        moodState,
        recentMoods: rawMoodEntries.slice(-5).map((entry) => entry.moodState),
      }),
    });

    if (!recommendationResponse.ok) {
      throw new Error('Failed to fetch recommendations');
    }

    const recommendationData: RecommendationResponse = await recommendationResponse.json();

    if (recommendationData.success) {
      // Format the recommendation for display
      const { recommendations } = recommendationData.recommendation;
      const insightText = `**Immediate Action**: ${recommendations.immediateAction}\n` +
        `**Daily Practice**: ${recommendations.dailyPractice}\n` +
        `**Mindfulness Tip**: ${recommendations.mindfulness}\n` +
        `**Affirmation**: ${recommendations.affirmation}\n` +
        `**Professional Insight**: ${recommendations.professionalInsight}`;
      setGeminiInsight(insightText);
    } else {
      console.error('Recommendation error:', recommendationData.error);
      setGeminiInsight(
        recommendationData.recommendation?.recommendations
          ? `**Fallback Recommendation**:\n` +
            Object.entries(recommendationData.recommendation.recommendations)
              .map(([key, value]) => `**${key.replace(/([A-Z])/g, ' $1').trim()}: ${value}`)
              .join('\n')
          : 'Unable to generate recommendations at this time.'
      );
    }

    // Refresh data
    setMoodText('');
    setMoodState('Happy');
    setShowSuggestions(false);
    fetchMoodData();
    fetchUserStats();

    alert('Mood saved and recommendations generated successfully!');
  } catch (error) {
    console.error('Error in handleSubmit:', error);
    setGeminiInsight('Error generating recommendations. Please try again.');
    alert('Error saving mood or generating recommendations. Please try again.');
  } finally {
    setIsLoading(false);
  }
};
  // Tab configuration
  const tabs = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '🏠',
      description: 'Overview & Today\'s Mood'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: '📊',
      description: 'Charts & Insights'
    },
    {
      id: 'calendar',
      label: 'Calendar',
      icon: '📅',
      description: 'Timeline & Patterns'
    },
    {
      id: 'wellness',
      label: 'Wellness',
      icon: '🎯',
      description: 'Goals & Resources'
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: '👤',
      description: 'Account & Settings'
    }
  ];

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-cyan-500/10 rounded-3xl p-6 border border-teal-200/30">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}! 👋
                  </h2>
                  <p className="text-gray-600">Ready to check in with your mental health today?</p>
                </div>
                <div className="hidden md:flex items-center space-x-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-teal-600">{userStats.currentStreak}</div>
                    <div className="text-xs text-gray-500">Day Streak</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-600">{userStats.weekPercentage}%</div>
                    <div className="text-xs text-gray-500">This Week</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Left Column - Mood Logging */}
              <div className="xl:col-span-2 space-y-6">
                {/* Mood Logging Section */}
                <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-2xl p-8 border border-emerald-200/50">
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-teal-400/80 to-emerald-500/80 rounded-2xl flex items-center justify-center shadow-inner">
                      <span className="text-2xl text-white">📝</span>
                    </div>
                    <h2 className="text-2xl font-extrabold text-gray-800">Log Your Mood</h2>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="relative">
                      <label htmlFor="moodText" className="block text-sm font-medium text-gray-700 mb-2">
                        How are you feeling today?
                      </label>
                      <textarea
                        id="moodText"
                        value={moodText}
                        onChange={(e) => setMoodText(e.target.value)}
                        placeholder="Describe your thoughts and feelings... AI will provide personalized insights!"
                        className="w-full px-4 py-4 bg-gray-50/70 border border-gray-200/50 rounded-2xl focus:ring-2 focus:ring-teal-400/50 focus:border-transparent transition-all duration-300 placeholder-gray-400 text-gray-700 resize-y min-h-[120px] max-h-[300px] shadow-md"
                        required
                      />

                      {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white/80 backdrop-blur-md border-2 border-teal-200/50 rounded-2xl shadow-lg z-50 max-h-48 overflow-y-auto">
                          <div className="p-3 border-b border-teal-100/50 text-sm text-teal-700 font-medium">
                            💡 Smart suggestions based on your mood
                          </div>
                          {suggestions.map((suggestion, index) => (
                            <div
                              key={index}
                              onClick={() => selectSuggestion(suggestion)}
                              className="p-4 cursor-pointer hover:bg-teal-50/50 transition-colors duration-300 border-b border-gray-100/50 last:border-b-0"
                            >
                              <p className="text-gray-700 text-sm">{suggestion}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="moodState" className="block text-sm font-medium text-gray-700">
                        Current Mood
                      </label>
                      <select
                        id="moodState"
                        value={moodState}
                        onChange={(e) => setMoodState(e.target.value as "Happy" | "Sad" | "Stressed")}
                        className="w-full px-4 py-4 bg-gray-50/70 border border-gray-200/50 rounded-2xl focus:ring-2 focus:ring-teal-400/50 focus:border-transparent transition-all duration-300 text-gray-700 shadow-md"
                      >
                        <option value="Happy">😊 Happy - Feeling positive and upbeat</option>
                        <option value="Sad">😢 Sad - Feeling down or melancholy</option>
                        <option value="Stressed">😰 Stressed - Feeling overwhelmed or anxious</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || !moodText.trim()}
                      className="w-full bg-gradient-to-r from-teal-500/80 to-emerald-500/80 hover:from-teal-600/80 hover:to-emerald-600/80 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl focus:ring-2 focus:ring-teal-400/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
                    >
                      {isLoading ? (
                        <>
                          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Analyzing with AI...</span>
                        </>
                      ) : (
                        <>
                          <span>Save & Analyze Mood</span>
                          <span className="text-xl">🤖</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>

              {/* Right Column - Stats & Quick Actions */}
              <div className="space-y-6">
                {/* Today's Mood Stats */}
                <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-2xl p-6 border border-emerald-200/50">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-8 h-8 bg-gradient-to-br from-teal-400/80 to-emerald-500/80 rounded-xl flex items-center justify-center">
                      <span className="text-lg text-white">📊</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">Today's Overview</h3>
                  </div>
                  
                  <div className="space-y-4">
                    {moodData.map((mood, index) => (
                      <div key={index} className={`flex items-center justify-between p-3 rounded-xl ${
                        mood.state === 'Happy' ? 'bg-green-50/50' :
                        mood.state === 'Stressed' ? 'bg-orange-50/50' : 'bg-red-50/50'
                      }`}>
                        <div className="flex items-center space-x-2">
                          <span className="text-2xl">
                            {mood.state === 'Happy' ? '😊' : mood.state === 'Stressed' ? '😰' : '😢'}
                          </span>
                          <span className="text-sm font-medium text-gray-700">{mood.state}</span>
                        </div>
                        <span className={`text-lg font-bold ${
                          mood.state === 'Happy' ? 'text-green-600' :
                          mood.state === 'Stressed' ? 'text-orange-600' : 'text-red-600'
                        }`}>{mood.count}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200/50">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-teal-600">{userStats.totalMoodEntries}</div>
                      <div className="text-xs text-gray-500">Total Entries</div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-2xl p-6 border border-purple-200/50">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-400/80 to-indigo-500/80 rounded-xl flex items-center justify-center">
                      <span className="text-lg text-white">⚡</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">Quick Actions</h3>
                  </div>
                  
                  <div className="space-y-3">
                    <button 
                      onClick={() => setActiveTab('wellness')}
                      className="w-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 hover:from-blue-500/20 hover:to-purple-500/20 text-gray-700 font-medium py-3 px-4 rounded-xl transition-all duration-300 text-left flex items-center space-x-3"
                    >
                      <span className="text-xl">🎯</span>
                      <span>Set Daily Goal</span>
                    </button>
                    
                    <button className="w-full bg-gradient-to-r from-green-500/10 to-teal-500/10 hover:from-green-500/20 hover:to-teal-500/20 text-gray-700 font-medium py-3 px-4 rounded-xl transition-all duration-300 text-left flex items-center space-x-3">
                      <span className="text-xl">🧘</span>
                      <span>Meditation</span>
                    </button>
                    
                    <button className="w-full bg-gradient-to-r from-orange-500/10 to-red-500/10 hover:from-orange-500/20 hover:to-red-500/20 text-gray-700 font-medium py-3 px-4 rounded-xl transition-all duration-300 text-left flex items-center space-x-3">
                      <span className="text-xl">📱</span>
                      <span>Emergency Help</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Insights Section */}
            {geminiInsight && (
              <div className="bg-gradient-to-br from-teal-50/70 to-emerald-50/70 rounded-3xl shadow-2xl p-8 border border-teal-200/50">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-teal-400/80 to-emerald-500/80 rounded-2xl flex items-center justify-center shadow-inner">
                    <span className="text-2xl text-white">🤖</span>
                  </div>
                  <h2 className="text-2xl font-extrabold text-gray-800">AI-Powered Insights</h2>
                </div>
                <div className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-teal-100/50">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-line">{geminiInsight}</p>
                </div>
              </div>
            )}
          </div>
        );
 
case 'analytics':
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 rounded-3xl p-6 border border-purple-200/30">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-400/80 to-indigo-500/80 rounded-2xl flex items-center justify-center shadow-inner">
            <span className="text-2xl text-white">📊</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Analytics & Insights</h2>
            <p className="text-gray-600">Deep dive into your mood patterns and trends</p>
          </div>
        </div>
      </div>

      {/* Centered Mood Distribution Pie Chart */}
      <div className="flex justify-center">
        <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-2xl p-8 border border-emerald-200/50 w-full max-w-2xl">
          <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">Mood Distribution</h3>
          {moodData.length > 0 ? (
            <div className="flex justify-center">
              <canvas ref={chartCanvasRef} width={500} height={400} className="max-w-full h-auto" />
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <div className="text-6xl mb-4">📊</div>
                <p className="text-lg font-medium">No mood data available</p>
                <p className="text-sm text-gray-400 mt-2">Log some moods to see your distribution!</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Analytics Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-blue-200/50">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{rawMoodEntries.length}</div>
            <div className="text-sm text-gray-600">Total Entries</div>
          </div>
        </div>
        
        <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-green-200/50">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{userStats.thisWeekEntries}</div>
            <div className="text-sm text-gray-600">This Week</div>
          </div>
        </div>
        
        <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-purple-200/50">
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">{userStats.currentStreak}</div>
            <div className="text-sm text-gray-600">Current Streak</div>
          </div>
        </div>
        
        <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-orange-200/50">
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600">
              {moodData.length > 0 ? moodData.reduce((max, mood) => mood.count > max.count ? mood : max, moodData[0]).state : 'N/A'}
            </div>
            <div className="text-sm text-gray-600">Dominant Mood</div>
          </div>
        </div>
      </div>

      {/* Mood Breakdown Table */}
      {moodData.length > 0 && (
        <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-2xl p-6 border border-gray-200/50">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Detailed Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-4 font-semibold text-gray-700">Mood</th>
                  <th className="text-left py-2 px-4 font-semibold text-gray-700">Count</th>
                  <th className="text-left py-2 px-4 font-semibold text-gray-700">Percentage</th>
                  <th className="text-left py-2 px-4 font-semibold text-gray-700">Visual</th>
                </tr>
              </thead>
              <tbody>
                {moodData.map((mood, index) => {
                  const total = moodData.reduce((sum, m) => sum + m.count, 0);
                  const percentage = total > 0 ? Math.round((mood.count / total) * 100) : 0;
                  
                  return (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">
                            {mood.state === 'Happy' ? '😊' : mood.state === 'Stressed' ? '😰' : '😢'}
                          </span>
                          <span className="font-medium">{mood.state}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold">{mood.count}</td>
                      <td className="py-3 px-4">{percentage}%</td>
                      <td className="py-3 px-4">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              mood.state === 'Happy' ? 'bg-green-500' :
                              mood.state === 'Stressed' ? 'bg-orange-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
   case 'calendar':
  const calendarDays = generateCalendarDays();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-orange-500/10 via-yellow-500/10 to-red-500/10 rounded-3xl p-6 border border-orange-200/30">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-400/80 to-red-500/80 rounded-2xl flex items-center justify-center shadow-inner">
            <span className="text-2xl text-white">📅</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Calendar View</h2>
            <p className="text-gray-600">Track your mood patterns over time</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-2xl p-8 border border-orange-200/50">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors duration-200"
          >
            <span className="text-2xl">←</span>
          </button>
          
          <div className="text-center">
            <h3 className="text-2xl font-bold text-gray-800">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Click on any date to see your mood entry
            </p>
          </div>
          
          <button
            onClick={() => navigateMonth('next')}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors duration-200"
          >
            <span className="text-2xl">→</span>
          </button>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-2 mb-4">
          {dayNames.map(day => (
            <div key={day} className="text-center py-2 text-sm font-semibold text-gray-600">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((calendarDay, index) => (
            <div
              key={index}
              className={`relative aspect-square flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer hover:scale-105 ${
                !calendarDay.isCurrentMonth 
                  ? 'text-gray-300 bg-gray-50/50' 
                  : calendarDay.isToday
                  ? 'bg-blue-100 border-2 border-blue-400 text-blue-700 font-bold'
                  : calendarDay.mood
                  ? `${getMoodColor(calendarDay.mood)}/10 border-2 ${getMoodColor(calendarDay.mood).replace('bg-', 'border-')} text-gray-800 hover:${getMoodColor(calendarDay.mood)}/20`
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-600'
              }`}
              title={calendarDay.mood ? `Mood: ${calendarDay.mood}` : 'No mood logged'}
            >
              {/* Date Number */}
              <span className={`text-sm font-medium ${!calendarDay.isCurrentMonth ? 'opacity-30' : ''}`}>
                {calendarDay.day}
              </span>
              
              {/* Mood Emoji */}
              {calendarDay.mood && calendarDay.isCurrentMonth && (
                <div className="absolute -top-1 -right-1 text-lg">
                  {getMoodEmoji(calendarDay.mood)}
                </div>
              )}
              
              {/* Today Indicator */}
              {calendarDay.isToday && (
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-500 rounded-full"></div>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-8 pt-6 border-t border-gray-200/50">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Legend</h4>
          <div className="flex flex-wrap gap-4 justify-center">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-green-500/20 border-2 border-green-500 rounded"></div>
              <span className="text-sm text-gray-600">😊 Happy</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-red-500/20 border-2 border-red-500 rounded"></div>
              <span className="text-sm text-gray-600">😢 Sad</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-orange-500/20 border-2 border-orange-500 rounded"></div>
              <span className="text-sm text-gray-600">😰 Stressed</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-blue-100 border-2 border-blue-400 rounded"></div>
              <span className="text-sm text-gray-600">Today</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gray-50 border-2 border-gray-200 rounded"></div>
              <span className="text-sm text-gray-600">No entry</span>
            </div>
          </div>
        </div>

        {/* Monthly Stats */}
        <div className="mt-8 pt-6 border-t border-gray-200/50">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">
            {monthNames[currentMonth.getMonth()]} Summary
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {(() => {
              const monthEntries = rawMoodEntries.filter(entry => {
                const entryDate = new Date(entry.timestamp);
                return entryDate.getMonth() === currentMonth.getMonth() && 
                       entryDate.getFullYear() === currentMonth.getFullYear();
              });
              
              const moodCounts = monthEntries.reduce((acc, entry) => {
                acc[entry.moodState] = (acc[entry.moodState] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);

              return [
                { label: 'Total Entries', value: monthEntries.length, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Happy Days', value: moodCounts.Happy || 0, color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'Sad Days', value: moodCounts.Sad || 0, color: 'text-red-600', bg: 'bg-red-50' },
                { label: 'Stressed Days', value: moodCounts.Stressed || 0, color: 'text-orange-600', bg: 'bg-orange-50' }
              ].map((stat, index) => (
                <div key={index} className={`text-center p-4 ${stat.bg} rounded-xl`}>
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    </div>
  );
      case 'wellness':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-green-500/10 via-teal-500/10 to-blue-500/10 rounded-3xl p-6 border border-green-200/30">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-400/80 to-teal-500/80 rounded-2xl flex items-center justify-center shadow-inner">
                  <span className="text-2xl text-white">🎯</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Wellness Goals</h2>
                  <p className="text-gray-600">Set and track your mental health goals</p>
                </div>
              </div>
            </div>

            {/* Goal Creation */}
            <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-2xl p-8 border border-green-200/50">
              <h3 className="text-xl font-bold text-gray-800 mb-6">Create New Goal</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <input
                  type="text"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal({...newGoal, title: e.target.value})}
                  placeholder="Goal title..."
                  className="px-4 py-3 bg-gray-50/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-green-400/50 focus:border-transparent"
                />
                <select
                  value={newGoal.category}
                  onChange={(e) => setNewGoal({...newGoal, category: e.target.value as 'daily' | 'weekly' | 'monthly'})}
                  className="px-4 py-3 bg-gray-50/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-green-400/50 focus:border-transparent"
                >
                  <option value="daily">Daily Goal</option>
                  <option value="weekly">Weekly Goal</option>
                  <option value="monthly">Monthly Goal</option>
                </select>
                <button
                  onClick={createWellnessGoal}
                  disabled={!newGoal.title.trim()}
                  className="bg-gradient-to-r from-green-500/80 to-teal-500/80 hover:from-green-600/80 hover:to-teal-600/80 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 disabled:opacity-50"
                >
                  Add Goal
                </button>
              </div>
              <textarea
                value={newGoal.description}
                onChange={(e) => setNewGoal({...newGoal, description: e.target.value})}
                placeholder="Goal description (optional)..."
                className="w-full px-4 py-3 bg-gray-50/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-green-400/50 focus:border-transparent resize-none"
                rows={3}
              />
            </div>

            {/* Goals List */}
            <div className="space-y-4">
              {['daily', 'weekly', 'monthly'].map(category => (
                <div key={category} className="bg-white/70 backdrop-blur-md rounded-3xl shadow-2xl p-6 border border-green-200/50">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 capitalize">
                    {category} Goals
                  </h3>
                  <div className="space-y-3">
                    {wellnessGoals.filter(goal => goal.category === category).map(goal => (
                      <div key={goal._id} className={`p-4 rounded-xl border transition-all duration-300 ${
                        goal.isCompleted 
                          ? 'bg-green-50/50 border-green-200/50' 
                          : 'bg-gray-50/50 border-gray-200/50'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => updateGoalProgress(goal._id!, !goal.isCompleted)}
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                                goal.isCompleted
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-gray-300 hover:border-green-400'
                              }`}
                            >
                              {goal.isCompleted && <span className="text-xs">✓</span>}
                            </button>
                            <div>
                              <p className={`font-medium ${goal.isCompleted ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                                {goal.title}
                              </p>
                              {goal.description && (
                                <p className="text-sm text-gray-600 mt-1">{goal.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            {goal.createdAt && new Date(goal.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                    {wellnessGoals.filter(goal => goal.category === category).length === 0 && (
                      <p className="text-gray-500 text-center py-4">No {category} goals yet. Create one above!</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'profile':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-indigo-500/10 rounded-3xl p-6 border border-blue-200/30">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400/80 to-purple-500/80 rounded-2xl flex items-center justify-center shadow-inner">
                  <span className="text-2xl text-white">👤</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">User Profile</h2>
                  <p className="text-gray-600">Manage your account and preferences</p>
                </div>
              </div>
            </div>

            {isProfileLoading ? (
              <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-2xl p-8 border border-blue-200/50">
                <div className="text-center">Loading profile...</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Profile Information */}
                <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-2xl p-8 border border-blue-200/50">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-800">Profile Information</h3>
                    <button
                      onClick={() => setIsEditingProfile(!isEditingProfile)}
                      className="bg-gradient-to-r from-blue-500/80 to-purple-500/80 hover:from-blue-600/80 hover:to-purple-600/80 text-white font-semibold py-2 px-4 rounded-xl transition-all duration-300"
                    >
                      {isEditingProfile ? 'Cancel' : 'Edit'}
                    </button>
                  </div>

                  {isEditingProfile ? (
                    <ProfileEditForm 
                      userProfile={userProfile} 
                      onSave={updateUserProfile}
                      onCancel={() => setIsEditingProfile(false)}
                    />
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Email</label>
                        <p className="text-gray-800">{userProfile?.email || 'Not set'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-600">First Name</label>
                          <p className="text-gray-800">{userProfile?.profile?.firstName || 'Not set'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-600">Last Name</label>
                          <p className="text-gray-800">{userProfile?.profile?.lastName || 'Not set'}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-600">Age</label>
                          <p className="text-gray-800">{userProfile?.profile?.age || 'Not set'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-600">Phone</label>
                          <p className="text-gray-800">{userProfile?.profile?.phoneNumber || 'Not set'}</p>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Bio</label>
                        <p className="text-gray-800">{userProfile?.profile?.bio || 'No bio added yet'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-600">City</label>
                          <p className="text-gray-800">{userProfile?.profile?.location?.city || 'Not set'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-600">Country</label>
                          <p className="text-gray-800">{userProfile?.profile?.location?.country || 'Not set'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* User Statistics */}
                <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-2xl p-8 border border-blue-200/50">
                  <h3 className="text-xl font-bold text-gray-800 mb-6">Your Statistics</h3>
                  
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-blue-600 mb-2">{userStats.currentStreak}</div>
                      <div className="text-gray-600">Current Streak (Days)</div>
                      <div className="text-sm text-gray-500 mt-1">
                        Longest: {userStats.longestStreak} days
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-blue-50/50 rounded-xl">
                        <div className="text-2xl font-bold text-blue-600">{userStats.totalMoodEntries}</div>
                        <div className="text-sm text-gray-600">Total Entries</div>
                      </div>
                      <div className="text-center p-4 bg-green-50/50 rounded-xl">
                        <div className="text-2xl font-bold text-green-600">{userStats.thisWeekEntries}</div>
                        <div className="text-sm text-gray-600">This Week</div>
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{userStats.weekPercentage}%</div>
                      <div className="text-gray-600">Week Completion</div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${userStats.weekPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preferences */}
                <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-2xl p-8 border border-blue-200/50">
                  <h3 className="text-xl font-bold text-gray-800 mb-6">Preferences</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Notifications</label>
                        <p className="text-xs text-gray-500">Receive mood reminders</p>
                      </div>
                      <button
                        onClick={() => {
                          if (userProfile) {
                            updateUserProfile({
                              ...userProfile.profile,
                              preferences: {
                                ...userProfile.preferences,
                                notifications: !userProfile.preferences.notifications
                              }
                            });
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          userProfile?.preferences?.notifications ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            userProfile?.preferences?.notifications ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700">Reminder Time</label>
                      <input
                        type="time"
                        value={userProfile?.preferences?.reminderTime || '09:00'}
                        onChange={(e) => {
                          if (userProfile) {
                            updateUserProfile({
                              ...userProfile.profile,
                              preferences: {
                                ...userProfile.preferences,
                                reminderTime: e.target.value
                              }
                            });
                          }
                        }}
                        className="mt-1 block w-full px-3 py-2 bg-gray-50/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700">Theme</label>
                      <select
                        value={userProfile?.preferences?.theme || 'auto'}
                        onChange={(e) => {
                          if (userProfile) {
                            updateUserProfile({
                              ...userProfile.profile,
                              preferences: {
                                ...userProfile.preferences,
                                theme: e.target.value as 'light' | 'dark' | 'auto'
                              }
                            });
                          }
                        }}
                        className="mt-1 block w-full px-3 py-2 bg-gray-50/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
                      >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="auto">Auto</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Account Actions */}
                <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-2xl p-8 border border-blue-200/50">
                  <h3 className="text-xl font-bold text-gray-800 mb-6">Account Actions</h3>
                  
                  <div className="space-y-3">
                    <button className="w-full bg-gradient-to-r from-green-500/10 to-teal-500/10 hover:from-green-500/20 hover:to-teal-500/20 text-gray-700 font-medium py-3 px-4 rounded-xl transition-all duration-300 text-left">
                      Export My Data
                    </button>
                    
                    <button className="w-full bg-gradient-to-r from-blue-500/10 to-indigo-500/10 hover:from-blue-500/20 hover:to-indigo-500/20 text-gray-700 font-medium py-3 px-4 rounded-xl transition-all duration-300 text-left">
                      Privacy Settings
                    </button>
                    
                    <button className="w-full bg-gradient-to-r from-orange-500/10 to-red-500/10 hover:from-orange-500/20 hover:to-red-500/20 text-gray-700 font-medium py-3 px-4 rounded-xl transition-all duration-300 text-left">
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      <div className="container mx-auto px-4 py-8">
        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2 bg-white/50 backdrop-blur-md p-2 rounded-3xl border border-gray-200/50">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-2xl font-medium transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-teal-500/80 to-emerald-500/80 text-white shadow-lg transform scale-105'
                    : 'text-gray-600 hover:bg-white/50 hover:text-gray-800'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <div className="text-left">
                  <div className="text-sm font-semibold">{tab.label}</div>
                  <div className="text-xs opacity-75">{tab.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {renderTabContent()}
      </div>
    </div>
  );
}
interface ProfileFormData {
  firstName?: string;
  lastName?: string;
  age?: number | null;
  phoneNumber?: string;
  bio?: string;
  location?: {
    city?: string;
    country?: string;
  };
}
// Profile Edit Form Component
function ProfileEditForm({ userProfile, onSave, onCancel }: {
  userProfile: UserProfile | null;
  onSave: (profileData: any) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    firstName: userProfile?.profile?.firstName || '',
    lastName: userProfile?.profile?.lastName || '',
    age: userProfile?.profile?.age || '',
    phoneNumber: userProfile?.profile?.phoneNumber || '',
    bio: userProfile?.profile?.bio || '',
    city: userProfile?.profile?.location?.city || '',
    country: userProfile?.profile?.location?.country || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      firstName: formData.firstName,
      lastName: formData.lastName,
      age: formData.age ? parseInt(formData.age) : null,
      phoneNumber: formData.phoneNumber,
      bio: formData.bio,
      location: {
        city: formData.city,
        country: formData.country
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => setFormData({...formData, firstName: e.target.value})}
            className="w-full px-3 py-2 bg-gray-50/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => setFormData({...formData, lastName: e.target.value})}
            className="w-full px-3 py-2 bg-gray-50/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
          <input
            type="number"
            value={formData.age}
            onChange={(e) => setFormData({...formData, age: e.target.value})}
            className="w-full px-3 py-2 bg-gray-50/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
          <input
            type="tel"
            value={formData.phoneNumber}
            onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
            className="w-full px-3 py-2 bg-gray-50/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
        <textarea
          value={formData.bio}
          onChange={(e) => setFormData({...formData, bio: e.target.value})}
          rows={3}
          className="w-full px-3 py-2 bg-gray-50/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-400/50 focus:border-transparent resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
          <input
            type="text"
            value={formData.city}
            onChange={(e) => setFormData({...formData, city: e.target.value})}
            className="w-full px-3 py-2 bg-gray-50/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
          <input
            type="text"
            value={formData.country}
            onChange={(e) => setFormData({...formData, country: e.target.value})}
            className="w-full px-3 py-2 bg-gray-50/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-400/50 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex space-x-4 pt-4">
        <button
          type="submit"
          className="flex-1 bg-gradient-to-r from-blue-500/80 to-purple-500/80 hover:from-blue-600/80 hover:to-purple-600/80 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300"
        >
          Save Changes
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-500/20 hover:bg-gray-500/30 text-gray-700 font-semibold py-3 px-6 rounded-xl transition-all duration-300"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}