'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } });
    alert('Check your email for a magic link.');
  }
  async function signOut() { await supabase.auth.signOut(); }

  if (!user) {
    return (
      <div className="card">
        <h2 className="text-xl font-semibold mb-2">Sign in</h2>
        <form onSubmit={signIn} className="space-y-2">
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
          <button className="btn btn-primary w-full" type="submit">Send Magic Link</button>
        </form>
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600">Signed in as <b>{user.email}</b></div>
        <button className="btn" onClick={signOut}>Sign out</button>
      </div>
      {children}
    </div>
  );
}
