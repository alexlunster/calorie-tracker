'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useI18n } from '@/components/I18nProvider';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '');

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
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
    return () => { mounted = false; listener?.subscription.unsubscribe(); };
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setSending(true); setError(null);
    try {
      await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: SITE_URL } });
      alert(t('magic_sent'));
    } catch (err: any) {
      setError(err?.message || 'Failed to send magic link');
    } finally { setSending(false); }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (!user) {
    return (
      <div className="card">
        <h2 className="text-xl font-semibold mb-2">{t('sign_in')}</h2>
        <form onSubmit={signIn} className="space-y-2">
          <label className="label">{t('email')}</label>
          <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
          <button className="btn btn-primary w-full" type="submit" disabled={sending}>
            {sending ? t('analyzing') : t('send_magic')}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600">
          {t('signed_in_as')} <b>{user.email || 'user'}</b>
        </div>
        <button className="btn" onClick={signOut}>{t('sign_out')}</button>
      </div>
      {children}
    </div>
  );
}
