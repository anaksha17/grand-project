'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseClient } from '../utils/supabase/server';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      console.log('Checking session on home page...'); // Debug log
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      if (error) {
        console.error('Session check error:', error.message);
        router.push('/login');
      } else if (session) {
        console.log('Session found, redirecting to /moods');
        router.push('/moods');
      } else {
        console.log('No session, redirecting to /login');
        router.push('/login');
      }
    };
    checkSession();
  }, [router]);

  return <div style={{ padding: '20px', textAlign: 'center' }}>Redirecting...</div>;
}