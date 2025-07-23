'use client';
import { useState } from 'react';
import { supabaseClient } from '../../utils/supabase/server';
import { useRouter } from 'next/navigation';

export default function MoodLog() {
  const [moodText, setMoodText] = useState<string>('');
  const [moodState, setMoodState] = useState<'Happy' | 'Sad' | 'Stressed'>('Happy');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('Submitting:', { moodText, moodState }); // Debug log
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session?.user.id) {
        alert('Please log in first');
        router.push('/login'); // Redirect to login if no session
        return;
      }
      const userId = session.user.id;
      const response = await fetch('/api/moods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moodText, moodState, userId, timestamp: new Date() }),
      });
      if (!response.ok) throw new Error(`Failed to save mood: ${response.statusText}`);
      const result = await response.json();
      console.log('API Response:', result); // Debug log
      alert('Mood saved successfully!');
      setMoodText(''); // Clear input
      setMoodState('Happy'); // Reset dropdown
    } catch (error: any) {
      console.error('Error:', error.message); // Debug log
      alert('Error: ' + error.message);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '300px' }}>
      <h1>Log Your Mood</h1>
      {(!moodText && !moodState) && <p>Please fill out the form to log your mood.</p>}
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={moodText}
          onChange={(e) => setMoodText(e.target.value)}
          placeholder="Describe your mood"
          style={{ margin: '10px 0', padding: '5px', width: '100%' }}
          required
        />
        <select
          value={moodState}
          onChange={(e) => setMoodState(e.target.value as 'Happy' | 'Sad' | 'Stressed')}
          style={{ margin: '10px 0', padding: '5px', width: '100%' }}
        >
          <option value="Happy">Happy</option>
          <option value="Sad">Sad</option>
          <option value="Stressed">Stressed</option>
        </select>
        <button type="submit" style={{ padding: '5px 10px', width: '100%' }}>Save Mood</button>
      </form>
    </div>
  );
}