'use client';
import { useState, useEffect, useRef } from 'react';
import { supabaseClient } from '../../utils/supabase/server';
import { useRouter } from 'next/navigation';
import { pipeline } from '@xenova/transformers';

// Types
interface MoodData {
  state: string;
  count: number;
}

interface MoodEntry {
  _id?: string;
  moodText: string;
  moodState: 'Happy' | 'Sad' | 'Stressed';
  userId: string;
  timestamp: Date;
  sentiment?: string;
}

export default function MoodLog() {
  const [moodText, setMoodText] = useState<string>('');
  const [moodState, setMoodState] = useState<'Happy' | 'Sad' | 'Stressed'>('Happy');
  const [moodData, setMoodData] = useState<MoodData[]>([]);
  const [rawMoodEntries, setRawMoodEntries] = useState<MoodEntry[]>([]);
  const [sentiment, setSentiment] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [sentimentPipeline, setSentimentPipeline] = useState<any>(null);
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const trendCanvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const supabase = supabaseClient;

  // Initialize sentiment analysis pipeline
  useEffect(() => {
    const initSentimentAnalysis = async () => {
      try {
        console.log('Loading sentiment analysis model...');
        const classifier = await pipeline('sentiment-analysis', 'distilbert-base-uncased-finetuned-sst-2-english');
        setSentimentPipeline(classifier);
        console.log('Sentiment analysis model loaded successfully');
      } catch (error) {
        console.error('Failed to load sentiment model:', error);
      }
    };
    
    initSentimentAnalysis();
  }, []);

  // Fetch mood data on component mount
  useEffect(() => {
    fetchMoodData();
  }, [router]);

  // Update charts when mood data changes
  useEffect(() => {
    if (moodData.length > 0) {
      drawMoodChart();
    }
    if (rawMoodEntries.length > 0) {
      drawTrendAnalysis();
    }
  }, [moodData, rawMoodEntries]);

  const fetchMoodData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user.id) {
        alert('Please log in first');
        router.push('/login');
        return;
      }

      // Fetch aggregated data for bar chart
      const response = await fetch(`/api/moods?userId=${session.user.id}`);
      if (response.ok) {
        const aggregatedData = await response.json();
        setMoodData(aggregatedData);
      }
      
      // Fetch raw entries for trend analysis
      const rawResponse = await fetch(`/api/moods/raw?userId=${session.user.id}`);
      if (rawResponse.ok) {
        const rawData = await rawResponse.json();
        setRawMoodEntries(rawData);
      }
    } catch (error) {
      console.error('Network error:', error);
    }
  };

  // Analyze sentiment using Hugging Face DistilBERT
  const analyzeSentiment = async (text: string): Promise<string> => {
    try {
      if (!sentimentPipeline) {
        return 'Model loading...';
      }
      
      const result = await sentimentPipeline(text);
      const label = result[0].label === 'POSITIVE' ? 'Positive' : 'Negative';
      const score = (result[0].score * 100).toFixed(1);
      return `${label} (${score}%)`;
    } catch (error) {
      console.error('Sentiment analysis error:', error);
      return 'Analysis failed';
    }
  };

  // Draw mood distribution chart using TensorFlow.js-style visualization
  const drawMoodChart = () => {
    const canvas = chartCanvasRef.current;
    if (!canvas || moodData.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Chart settings
    const padding = 50;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;
    const barWidth = chartWidth / moodData.length;
    const maxCount = Math.max(...moodData.map(d => d.count), 1);
    
    // Colors for each mood
    const colors: { [key: string]: string } = {
      'Happy': '#4CAF50',
      'Sad': '#F44336',
      'Stressed': '#FF9800'
    };
    
    // Draw background
    ctx.fillStyle = '#f9f9f9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid lines
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvas.width - padding, y);
      ctx.stroke();
    }
    
    // Draw bars with animation effect
    moodData.forEach((data, index) => {
      const barHeight = (data.count / maxCount) * chartHeight;
      const x = padding + index * barWidth + barWidth * 0.15;
      const y = canvas.height - padding - barHeight;
      const width = barWidth * 0.7;
      
      // Draw shadow
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(x + 3, y + 3, width, barHeight);
      
      // Draw main bar
      ctx.fillStyle = colors[data.state] || '#666';
      ctx.fillRect(x, y, width, barHeight);
      
      // Draw gradient effect
      const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
      gradient.addColorStop(0, colors[data.state] || '#666');
      gradient.addColorStop(1, `${colors[data.state]}80` || '#66680');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, width, barHeight);
      
      // Draw label
      ctx.fillStyle = '#333';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(data.state, x + width / 2, canvas.height - padding + 20);
      
      // Draw count
      ctx.fillStyle = '#666';
      ctx.font = '14px Arial';
      ctx.fillText(data.count.toString(), x + width / 2, y - 10);
    });
    
    // Draw title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Mood Distribution Analysis', canvas.width / 2, 30);
    
    // Draw y-axis labels
    ctx.font = '10px Arial';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const value = Math.round((maxCount / 5) * (5 - i));
      const y = padding + (chartHeight / 5) * i + 3;
      ctx.fillText(value.toString(), padding - 10, y);
    }
  };

  // Draw trend analysis using TensorFlow.js concepts
  const drawTrendAnalysis = () => {
    const canvas = trendCanvasRef.current;
    if (!canvas || rawMoodEntries.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Prepare data for trend analysis
    const sortedEntries = rawMoodEntries
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-10); // Last 10 entries
    
    if (sortedEntries.length < 2) {
      ctx.fillStyle = '#666';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Need more entries for trend analysis', canvas.width / 2, canvas.height / 2);
      return;
    }
    
    // Draw background
    ctx.fillStyle = '#f9f9f9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Convert mood states to numerical values for tensor-like processing
    const moodToNumber = { 'Happy': 3, 'Stressed': 2, 'Sad': 1 };
    const trendData = sortedEntries.map(entry => moodToNumber[entry.moodState]);
    
    // Chart settings
    const padding = 50;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;
    const stepX = chartWidth / (trendData.length - 1);
    
    // Draw grid
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvas.width - padding, y);
      ctx.stroke();
    }
    
    // Draw trend line with gradient
    const gradient = ctx.createLinearGradient(0, padding, 0, canvas.height - padding);
    gradient.addColorStop(0, 'rgba(33, 150, 243, 0.3)');
    gradient.addColorStop(1, 'rgba(33, 150, 243, 0.1)');
    
    // Fill area under curve
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(padding, canvas.height - padding);
    
    trendData.forEach((mood, index) => {
      const x = padding + index * stepX;
      const y = canvas.height - padding - ((mood - 1) / 2) * chartHeight;
      if (index === 0) {
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.closePath();
    ctx.fill();
    
    // Draw main trend line
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    trendData.forEach((mood, index) => {
      const x = padding + index * stepX;
      const y = canvas.height - padding - ((mood - 1) / 2) * chartHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      
      // Draw data points with different colors based on mood
      const pointColor = mood === 3 ? '#4CAF50' : mood === 2 ? '#FF9800' : '#F44336';
      ctx.fillStyle = pointColor;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
      
      // Add white border to points
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = '#2196F3';
      ctx.lineWidth = 3;
    });
    
    ctx.stroke();
    
    // Draw title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Mood Trend Analysis (TensorFlow.js Style)', canvas.width / 2, 30);
    
    // Draw y-axis labels
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('Happy', padding - 10, padding + 15);
    ctx.fillText('Stressed', padding - 10, padding + chartHeight / 2 + 5);
    ctx.fillText('Sad', padding - 10, canvas.height - padding - 5);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Check session first
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('Session check:', { session: !!session, error: sessionError });
      
      if (sessionError || !session?.user?.id) {
        console.error('No valid session:', sessionError);
        alert('Please log in first');
        router.push('/login');
        return;
      }
      
      const userId = session.user.id;
      console.log('Using userId:', userId);
      
      // Analyze sentiment
      const sentimentResult = await analyzeSentiment(moodText);
      setSentiment(sentimentResult);

      // Prepare data to send
      const requestData = { 
        moodText, 
        moodState, 
        userId, 
        timestamp: new Date().toISOString(),
        sentiment: sentimentResult
      };
      
      console.log('Sending data:', requestData);

      const response = await fetch('/api/moods', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` // Add auth header
        },
        body: JSON.stringify(requestData),
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const responseData = await response.json();
      console.log('Success response:', responseData);
      
      alert('Mood saved successfully!');
      setMoodText('');
      setMoodState('Happy');
      setSentiment('');
      
      // Refresh data
      await fetchMoodData();
      
    } catch (error: any) {
      console.error('Error details:', error);
      alert('Error: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '1200px', 
      margin: '0 auto', 
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <h1 style={{ 
        textAlign: 'center', 
        color: '#333', 
        marginBottom: '40px',
        fontSize: '2.5em',
        fontWeight: 'bold'
      }}>
        🧠 AI-Powered Mental Health Tracker
      </h1>
      
      {/* Mood Input Form */}
      <div style={{ 
        backgroundColor: '#fff', 
        padding: '30px', 
        borderRadius: '12px', 
        marginBottom: '40px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ color: '#333', marginBottom: '20px', fontSize: '1.5em' }}>📝 Log Your Mood</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <textarea
            value={moodText}
            onChange={(e) => setMoodText(e.target.value)}
            placeholder="Describe how you're feeling today... Be as detailed as you'd like for better sentiment analysis!"
            style={{ 
              margin: '10px 0', 
              padding: '15px', 
              minHeight: '100px',
              border: '2px solid #e0e0e0', 
              borderRadius: '8px',
              fontSize: '16px',
              resize: 'vertical',
              fontFamily: 'Arial, sans-serif'
            }}
            required
          />
          <select
            value={moodState}
            onChange={(e) => setMoodState(e.target.value as 'Happy' | 'Sad' | 'Stressed')}
            style={{ 
              margin: '10px 0', 
              padding: '15px', 
              border: '2px solid #e0e0e0', 
              borderRadius: '8px',
              fontSize: '16px',
              backgroundColor: '#fff'
            }}
          >
            <option value="Happy">😊 Happy</option>
            <option value="Sad">😢 Sad</option>
            <option value="Stressed">😰 Stressed</option>
          </select>
          <button
            type="submit"
            disabled={isLoading}
            style={{ 
              padding: '15px', 
              backgroundColor: isLoading ? '#ccc' : '#4CAF50', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '18px',
              fontWeight: 'bold',
              transition: 'background-color 0.3s'
            }}
          >
            {isLoading ? '🤖 Analyzing & Saving...' : '💾 Save Mood Entry'}
          </button>
        </form>
        
        {sentiment && (
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            backgroundColor: '#e8f5e8', 
            borderRadius: '8px',
            border: '2px solid #4CAF50'
          }}>
            <strong>🧠 AI Sentiment Analysis:</strong> {sentiment}
          </div>
        )}
      </div>

      {/* Data Visualization Section */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
        gap: '30px', 
        marginBottom: '40px' 
      }}>
        <div style={{ 
          backgroundColor: '#fff', 
          padding: '30px', 
          borderRadius: '12px', 
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)' 
        }}>
          <canvas 
            ref={chartCanvasRef} 
            width={450} 
            height={300}
            style={{ width: '100%', height: 'auto', maxWidth: '450px' }}
          />
        </div>
        
        <div style={{ 
          backgroundColor: '#fff', 
          padding: '30px', 
          borderRadius: '12px', 
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)' 
        }}>
          <canvas 
            ref={trendCanvasRef} 
            width={450} 
            height={300}
            style={{ width: '100%', height: 'auto', maxWidth: '450px' }}
          />
        </div>
      </div>

      {/* Mood Statistics */}
      {moodData.length > 0 && (
        <div style={{ 
          backgroundColor: '#fff', 
          padding: '30px', 
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ color: '#333', marginBottom: '20px', fontSize: '1.3em' }}>📊 Your Mood Statistics</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
            gap: '20px' 
          }}>
            {moodData.map((data, index) => (
              <div key={index} style={{ 
                textAlign: 'center', 
                padding: '20px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #e9ecef'
              }}>
                <div style={{ fontSize: '2em', marginBottom: '10px' }}>
                  {data.state === 'Happy' ? '😊' : data.state === 'Sad' ? '😢' : '😰'}
                </div>
                <div style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#333' }}>
                  {data.count}
                </div>
                <div style={{ fontSize: '0.9em', color: '#666' }}>
                  {data.state} entries
                </div>
              </div>
            ))}
          </div>
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            backgroundColor: '#e3f2fd',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <strong>Total Entries:</strong> {moodData.reduce((sum, d) => sum + d.count, 0)} | 
            <strong> Recent Entries:</strong> {rawMoodEntries.length}
          </div>
        </div>
      )}

      {moodData.length === 0 && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          backgroundColor: '#fff',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ color: '#666' }}>No mood data yet</h3>
          <p style={{ color: '#999' }}>Start logging your moods to see beautiful AI-powered visualizations!</p>
        </div>
      )}
    </div>
  );
}