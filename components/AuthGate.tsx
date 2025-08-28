'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '');

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<null | { email?: string }>(null);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => mounted && setUser(data.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      mounted = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: SITE_URL } // ← always your domain
      });
      alert('Magic link sent. Check your email.');
    } catch (err: any) {
      setError(err?.message || 'Failed to send magic link');
    } finally {
      setSending(false);
    }
  }

  async function signOut() {
    try { await supabase.auth.signOut(); }
    catch (err: any) { setError(err?.message || 'Failed to sign out'); }
  }

  if (!user) {
    return (
      <div className="card">
        <h2 className="text-xl font-semibold mb-2">Sign in</h2>
        <form onSubmit={signIn} className="space-y-2">
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required />
          <button className="btn btn-primary w-full" type="submit" disabled={sending}>
            {sending ? 'Sending…' : 'Send Magic Link'}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600">Signed in as <b>{user.email || 'user'}</b></div>
        <button className="btn" onClick={signOut}>Sign out</button>
      </div>
      {children}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
