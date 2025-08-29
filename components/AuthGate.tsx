"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import UploadCard from "./UploadCard";
import Dashboard from "./Dashboard";
import { useI18n } from "@/components/I18nProvider";

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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
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
    alert(t("check_email_login"));
  }

  function cleanText(text: string) {
    return text.replaceAll("_", " ");
  }

  if (loading) return <p>{t("loading")}...</p>;

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">{t("welcome")}</h1>
        <form onSubmit={handleLogin} className="flex flex-col gap-2">
          <input
            type="email"
            placeholder={t("your_email")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border px-4 py-2 rounded"
          />
          <button
            type="submit"
            className="bg-blue-500 text-white rounded px-4 py-2"
          >
            {t("sign_in")}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Signed in info with padding */}
      <div className="px-4 py-2 text-sm text-gray-600">
        {t("signed_in_as")} {session.user.email}
      </div>

      <main className="flex-1 p-4 space-y-6">
        {/* Upload photo card */}
        <UploadCard />

        {/* Recent entries & totals */}
        <section>
          <h2 className="text-lg font-semibold mb-2">{t("recent_entries")}</h2>
          <Dashboard />

          {/* Capitalized Totals */}
          <h2 className="text-lg font-semibold mt-6">{t("Totals")}</h2>
        </section>
      </main>
    </div>
  );
}
