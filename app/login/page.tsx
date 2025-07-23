'use client';
import { useState } from 'react';
import { supabaseClient } from '../../utils/supabase/server';

export default function Login() {
  const [email, setEmail] = useState<string>('');
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await supabaseClient.auth.signInWithOtp({ email });
      alert('Check your email!');
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };
  return (
    <div>
      <h1>Login</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
        />
        <button type="submit">Send Magic Link</button>
        
      </form>
    </div>
  );
}