"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AuthGate from "@/components/AuthGate";
import TotalsBar from "@/components/TotalsBar";
import RecentEntries from "@/components/RecentEntries";
import { useI18n } from "@/components/I18nProvider";
import { pretty } from "@/lib/ui";
import { supabase } from "@/lib/supabaseClient";

/**
 * Tries to dynamically load whatever "targets editor" you already have,
 * without breaking the build if the file name is different.
 * If nothing is found, we render an inline fallback editor below.
 */
function TargetsSlot() {
  const [Comp, setComp] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      // Add any other filenames you use here
      const candidates: Array<{
        path: string;
        pick: (m: any) => React.ComponentType<any> | null | undefined;
      }> = [
        { path: "@/components/TargetsCard", pick: (m) => m.default ?? m.TargetsCard },
        { path: "@/components/TargetsMenu", pick: (m) => m.default ?? m.TargetsMenu },
        { path: "@/components/GoalsCard", pick: (m) => m.default ?? m.GoalsCard },
        { path: "@/components/GoalEditor", pick: (m) => m.default ?? m.GoalEditor },
        { path: "@/components/Targets", pick: (m) => m.default ?? m.Targets },
      ];

      for (const c of candidates) {
        try {
          const mod = await import(/* webpackIgnore: true */ c.path as any);
          const C = c.pick(mod);
          if (C && mounted) {
            setComp(() => C);
            return;
          }
        } catch {
          // keep trying next candidate
        }
      }
      if (mounted) setComp(null);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (!Comp) return null;
  return <Comp />;
}

/**
 * Inline fallback targets editor – only shown if TargetsSlot didn’t find your component.
 * It reads/writes the "goals" row for the current user.
 */
function InlineTargetsEditor() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [daily, setDaily] = useState<number | "">("");
  const [weekly, setWeekly] = useState<number | "">("");
  const [monthly, setMonthly] = useState<number | "">("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const {
          data: { user },
          error: uErr,
        } = await supabase.auth.getUser();
        if (uErr) throw uErr;
        if (!user) throw new Error("not_authenticated");

        const { data, error: gErr } = await supabase
          .from("goals")
          .select("daily_target, weekly_target, monthly_target")
          .eq("user_id", user.id)
          .maybeSingle();

        if (gErr) throw gErr;
        if (data) {
          setDaily(data.daily_target ?? "");
          setWeekly(data.weekly_target ?? "");
          setMonthly(data.monthly_target ?? "");
        } else {
          // create a blank row so the editor has something to update
          await supabase.from("goals").upsert(
            { user_id: user.id, daily_target: null, weekly_target: null, monthly_target: null },
            { onConflict: "user_id" }
          );
        }
      } catch (e: any) {
        setError(e?.message ?? "load_failed");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function save() {
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
        daily_target: daily === "" ? null : Number(daily),
        weekly_target: weekly === "" ? null : Number(weekly),
        monthly_target: monthly === "" ? null : Number(monthly),
      };

      const { error: upErr } = await supabase
        .from("goals")
        .update(payload)
        .eq("user_id", user.id);

      if (upErr) throw upErr;
    } catch (e: any) {
      setError(e?.message ?? "save_failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border p-4 text-sm text-gray-500">
        {pretty(t("loading") || "loading")}…
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4">
      <h2 className="mb-3 text-base font-semibold">
        {pretty(t("targets") || "targets")}
      </h2>

      {error && (
        <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">
          {pretty(error)}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex items-center gap-2">
          <span className="w-24 text-sm text-gray-600">{pretty(t("daily") || "daily")}</span>
          <input
            type="number"
            min={0}
            value={daily}
            onChange={(e) => setDaily(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full rounded border px-3 py-2"
            placeholder="kcal"
          />
        </label>

        <label className="flex items-center gap-2">
          <span className="w-24 text-sm text-gray-600">{pretty(t("weekly") || "weekly")}</span>
          <input
            type="number"
            min={0}
            value={weekly}
            onChange={(e) => setWeekly(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full rounded border px-3 py-2"
            placeholder="kcal"
          />
        </label>

        <label className="flex items-center gap-2">
          <span className="w-24 text-sm text-gray-600">{pretty(t("monthly") || "monthly")}</span>
          <input
            type="number"
            min={0}
            value={monthly}
            onChange={(e) => setMonthly(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full rounded border px-3 py-2"
            placeholder="kcal"
          />
        </label>
      </div>

      <div className="mt-4">
        <button
          onClick={save}
          disabled={saving}
          className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {saving ? pretty(t("saving") || "saving") + "…" : pretty(t("save") || "save")}
        </button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useI18n();
  const title = useMemo(() => pretty(t("dashboard") || "dashboard"), [t]);

  return (
    <AuthGate>
      <div className="grid gap-4">
        {/* Title */}
        <h1 className="text-xl font-semibold">{title}</h1>

        {/* Totals */}
        <TotalsBar />

        {/* Back to Upload button directly UNDER Totals */}
        <div className="flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            aria-label={pretty(t("back_to_upload") || "back_to_upload")}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
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

        {/* Prefer your existing Targets component; if none found, show a safe inline editor */}
        <TargetsSlot />
        <InlineTargetsEditor />

        {/* Rest of dashboard */}
        <RecentEntries />
      </div>
    </AuthGate>
  );
}
