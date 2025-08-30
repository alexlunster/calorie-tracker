"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { pretty } from "@/lib/ui";

type SessionT = Awaited<
  ReturnType<typeof supabase.auth.getSession>
>["data"]["session"] | null;

export default function AuthGate({ children }: { children?: React.ReactNode }) {
  const { t } = useI18n();

  const [session, setSession] = useState<SessionT>(null);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // NEW: after sending the email, show the OTP verify step
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [code, setCode] = useState("");

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, next) => {
      setSession(next);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Build a redirect that points back to the PWA callback route (works for desktop/Android)
  function buildRedirectTo(): string {
    const base =
      (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SITE_URL) ||
      (typeof window !== "undefined" ? window.location.origin : "");
    return `${(base || "").replace(/\/+$/, "")}/auth/callback`;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email) {
      setError(pretty(t("please_enter_email") || "please_enter_email"));
      return;
    }

    try {
      setSending(true);

      // Send the email that contains BOTH: a magic link AND a 6-digit code.
      const { error: signErr } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: buildRedirectTo(), // nice for desktop/Android
          shouldCreateUser: true,
        },
      });
      if (signErr) throw signErr;

      // Move to the OTP verify step for iOS PWA users
      setAwaitingCode(true);
      setInfo(
        pretty(
          t("check_email_login_enter_code") ||
            "check_email_login_enter_code"
        )
      );
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setSending(false);
    }
  }

  // NEW: Verify 6-digit code inside the PWA — this avoids opening Safari.
  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email) {
      setError(pretty(t("please_enter_email") || "please_enter_email"));
      return;
    }
    if (!code || code.trim().length < 4) {
      setError(pretty(t("please_enter_code") || "please_enter_code"));
      return;
    }

    try {
      setSending(true);
      const { data, error: verErr } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: "email", // verify the email OTP (NOT magiclink)
      });
      if (verErr) throw verErr;

      // Session should now be established inside the PWA context
      if (data?.session) {
        setSession(data.session);
        setAwaitingCode(false);
        setCode("");
        setInfo(null);
      } else {
        // Fallback: onAuthStateChange will likely update us, but show a hint
        setInfo(pretty(t("signed_in") || "signed_in"));
      }
    } catch (err: any) {
      setError(err?.message || "Verification failed");
    } finally {
      setSending(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    if (typeof window !== "undefined") window.location.href = "/";
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-500">{pretty(t("loading") || "loading")}…</p>
      </div>
    );
  }

  // --- AUTH UI ---
  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-4">{pretty(t("welcome") || "welcome")}</h1>

        {/* Step 1: request magic link + code */}
        {!awaitingCode && (
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
            {info && <p className="text-sm text-gray-600">{pretty(info)}</p>}
            {error && <p className="text-sm text-red-600">{pretty(error)}</p>}
            <p className="text-xs text-gray-500">
              {pretty(
                t("tip_ios_use_code") ||
                  "tip_ios_use_code"
              )}
            </p>
          </form>
        )}

        {/* Step 2: verify the 6-digit code (ideal for iOS PWA) */}
        {awaitingCode && (
          <form onSubmit={handleVerifyCode} className="w-full max-w-sm space-y-3">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
              placeholder={pretty(t("six_digit_code") || "six_digit_code")}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full border rounded px-4 py-2 tracking-widest text-center"
            />
            <button
              type="submit"
              disabled={sending}
              className="w-full bg-green-600 text-white rounded px-4 py-2 disabled:opacity-60"
            >
              {sending
                ? pretty(t("verifying") || "verifying") + "…"
                : pretty(t("verify") || "verify")}
            </button>

            <button
              type="button"
              disabled={sending}
              onClick={() => setAwaitingCode(false)}
              className="w-full border rounded px-4 py-2"
            >
              {pretty(t("back") || "back")}
            </button>

            {info && <p className="text-sm text-gray-600">{pretty(info)}</p>}
            {error && <p className="text-sm text-red-600">{pretty(error)}</p>}

            <p className="text-xs text-gray-500">
              {pretty(
                t("enter_code_from_email") ||
                  "enter_code_from_email"
              )}
            </p>
          </form>
        )}
      </div>
    );
  }

  // --- SIGNED IN ---
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

      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
