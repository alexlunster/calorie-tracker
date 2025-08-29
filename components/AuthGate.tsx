"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import UploadCard from "./UploadCard";
import Dashboard from "./Dashboard";
import I18nProvider, { useI18n } from "@/components/I18nProvider";
import { pretty } from "@/lib/ui";

export default function AuthGate() {
  const { t } = useI18n();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!;
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: SITE_URL },
    });
    alert(pretty(t("check_email_login")));
  }

  if (loading) return <p className="px-4">{pretty(t("loading"))}...</p>;

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">{pretty(t("welcome"))}</h1>
        <form onSubmit={handleLogin} className="flex flex-col gap-2 w-full max-w-xs">
          <input
            type="email"
            placeholder={pretty(t("your_email"))}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border px-4 py-2 rounded"
          />
          <button type="submit" className="bg-blue-500 text-white rounded px-4 py-2">
            {pretty(t("sign_in"))}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Signed in info with comfortable side padding */}
      <div className="px-4 py-2 text-sm text-gray-600">
        {pretty(t("signed_in_as"))} {session.user.email}
      </div>

      <main className="flex-1 p-4 space-y-6">
        {/* Upload photo card (home screen) */}
        <UploadCard />

        {/* Recent entries & Totals */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{pretty(t("recent_entries"))}</h2>
          <Dashboard />
          <h2 className="text-lg font-semibold">{pretty(t("totals"))}</h2>
        </section>
      </main>
    </div>
  );
}
