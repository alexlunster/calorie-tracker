"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { pretty } from "@/lib/ui";
import UploadCard from "@/components/UploadCard";
import Dashboard from "@/components/Dashboard";

export default function AuthGate() {
  const { t } = useI18n();
  const [session, setSession] = useState<Awaited<
    ReturnType<typeof supabase.auth.getSession>
  >["data"]["session"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load session and subscribe to auth changes
  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError(pretty(t("please_enter_email") || "please_enter_email"));
      return;
    }
    try {
      setSending(true);
      const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!;
      const { error: signErr } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: SITE_URL },
      });
      if (signErr) throw signErr;
      alert(pretty(t("check_email_login") || "check_email_login"));
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setSending(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    // Force a refresh to show the login form immediately
    if (typeof window !== "undefined") window.location.href = "/";
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-500">{pretty(t("loading") || "loading")}…</p>
      </div>
    );
  }

  // Not logged in → simple Magic Link form
  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-4">{pretty(t("welcome") || "welcome")}</h1>

        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-3">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={pretty(t("your_email") || "your_email")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded px-4 py-2"
          />
          <button
            type="submit"
            disabled={sending}
            className="w-full bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-60"
          >
            {sending
              ? pretty(t("sending") || "sending") + "…"
              : pretty(t("sign_in") || "sign_in")}
          </button>
          {error && <p className="text-sm text-red-600">{pretty(error)}</p>}
        </form>
      </div>
    );
  }

  // Logged in view
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar: signed in + sign out */}
      <div className="px-4 py-2 text-sm text-gray-600 flex items-center justify-between">
        <div>
          {pretty(t("signed_in_as") || "signed_in_as")} {session.user?.email}
        </div>
        <button
          onClick={handleSignOut}
          className="text-sm px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
        >
          {pretty(t("sign_out") || "sign_out")}
        </button>
      </div>

      {/* Main content */}
      <main className="flex-1 p-4 space-y-6">
        {/* Upload UI on the home */}
        <UploadCard />

        {/* Recent entries + totals (Dashboard component renders both) */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{pretty(t("recent_entries") || "recent_entries")}</h2>
          <Dashboard />

          {/* Optional deep link to /dashboard page if you have it */}
          <a
            href="/dashboard"
            className="inline-block text-sm text-blue-600 hover:underline"
          >
            {pretty(t("go_to_dashboard") || "go_to_dashboard")}
          </a>
        </section>
      </main>
    </div>
  );
}
