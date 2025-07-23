'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseClient } from '../../../utils/supabase/server'; // Adjusted import path

export default function Callback() {
  const router = useRouter();

  useEffect(() => {
    const verifySessionAndRedirect = async () => {
      console.log('Verifying session at callback...'); // Debug log
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      if (error) {
        console.error('Session error:', error.message);
        alert('Authentication failed: ' + error.message);
        router.push('/login');
      } else if (session) {
        console.log('Session verified, user ID:', session.user.id);
        router.push('/moods'); // Redirect to mood log page
      } else {
        console.log('No session yet, retrying or redirecting to login...');
        // Add a small delay to allow session to set
        setTimeout(() => router.push('/login'), 1000); // Wait 1 second
      }
    };
    verifySessionAndRedirect();
  }, [router]);

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>Verifying your login...</h2>
      <p>Please wait while we confirm your session.</p>
    </div>
  );
}