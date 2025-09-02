"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import TotalsBar from "@/components/TotalsBar";
import RecentEntries from "@/components/RecentEntries";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { pretty } from "@/lib/ui";

export default function DashboardPage() {
  const { t } = useI18n();
  const title = useMemo(() => pretty(t("dashboard") || "dashboard"), [t]);

  return (
    <AuthGate>
      <div className="grid gap-6">
        <h1 className="text-xl font-semibold">{title}</h1>

        {/* Totals */}
        <TotalsBar />

        {/* Back to upload */}
        <div className="flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {pretty(t("back_to_upload") || "back_to_upload")}
          </Link>
        </div>

        {/* Targets editor – daily only; weekly/monthly derived */}
        <DailyTargetEditor />

        {/* Recent entries */}
        <RecentEntries />
      </div>
    </AuthGate>
  );
}

function DailyTargetEditor() {
  const { t } = useI18n();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [daily, setDaily] = useState<number | "">("");

  // derived
  const weekly = typeof daily === "number" ? daily * 7 : 0;
  const monthly = typeof daily === "number" ? daily * 30 : 0;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: u, error: uErr } = await supabase.auth.getUser();
        if (uErr) throw uErr;
        if (!u.user) throw new Error("not_authenticated");

        const { data: g, error: gErr } = await supabase
          .from("goals")
          .select("daily_target")
          .eq("user_id", u.user.id)
          .maybeSingle();
        if (gErr) throw gErr;

        if (alive) setDaily(g?.daily_target ?? "");
      } catch (e: any) {
        if (alive) setError(e?.message ?? "load_failed");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function save() {
    if (daily === "") return;
    setSaving(true);
    setError(null);
    try {
      const {
        data: { user },
        error: uErr,
      } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      if (!user) throw new Error("not_authenticated");

      const payload = {
        user_id: user.id,
        daily_target: daily,
        weekly_target: weekly,
        monthly_target: monthly,
      };

      // Upsert so the row exists; conflict target is user_id
      const { error: upErr } = await supabase
        .from("goals")
        .upsert(payload, { onConflict: "user_id" });
      if (upErr) throw upErr;

      // tell the app + server components to update
      router.refresh();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("goals-updated"));
      }
    } catch (e: any) {
      setError(e?.message ?? "save_failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <h2 className="mb-3 text-base font-semibold">
        {pretty(t("targets") || "targets")}
      </h2>

      {loading ? (
        <div className="text-sm text-gray-500">{pretty(t("loading") || "loading")}…</div>
      ) : (
        <>
          {error && (
            <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">
              {pretty(error)}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            {/* Daily (editable) */}
            <label className="flex items-center gap-2">
              <span className="w-24 text-sm text-gray-600">{pretty(t("daily") || "daily")}</span>
              <input
                type="number"
                min={0}
                value={daily}
                onChange={(e) => {
                  const v = e.target.value;
                  setDaily(v === "" ? "" : Number(v));
                }}
                className="w-full rounded border px-3 py-2"
                placeholder="kcal"
              />
            </label>

            {/* Weekly (derived) */}
            <label className="flex items-center gap-2">
              <span className="w-24 text-sm text-gray-600">{pretty(t("weekly") || "weekly")}</span>
              <input
                type="number"
                value={weekly}
                readOnly
                className="w-full rounded border bg-gray-50 px-3 py-2 text-gray-700"
              />
            </label>

            {/* Monthly (derived) */}
            <label className="flex items-center gap-2">
              <span className="w-24 text-sm text-gray-600">{pretty(t("monthly") || "monthly")}</span>
              <input
                type="number"
                value={monthly}
                readOnly
                className="w-full rounded border bg-gray-50 px-3 py-2 text-gray-700"
              />
            </label>
          </div>

          <div className="mt-4">
            <button
              onClick={save}
              disabled={saving || daily === ""}
              className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
            >
              {saving ? pretty(t("saving") || "saving") + "…" : pretty(t("save") || "save")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
