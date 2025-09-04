"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { pretty } from "@/lib/ui";
import CircleRing from "@/components/CircleRing";

const toNum = (v: any) => (typeof v === "number" && isFinite(v) ? v : Number(v ?? 0) || 0);

type Totals = { day: number; week: number; month: number };

export default function TotalsBar() {
  const { t } = useI18n();

  const [totals, setTotals] = useState<Totals>({ day: 0, week: 0, month: 0 });
  const [goal, setGoal] = useState<number>(0);

  const eaten = toNum(totals.day);

  const pct = (val: number) => {
    if (!isFinite(val) || goal <= 0) return 0;
    const p = Math.round((val / goal) * 100);
    return p < 0 ? 0 : p > 100 ? 100 : p;
  };

  async function resolveDailyGoal(): Promise<number> {
    async function trySelect(table: string, columns: string[]) {
      try {
        const { data, error } = await supabase.from(table).select(columns.join(",")).limit(1).maybeSingle();
        if (error || !data) return null;
        const row = data as Record<string, unknown>;
        for (const col of columns) {
          if (row[col] != null) {
            const v = toNum(row[col]);
            if (v > 0) return v;
          }
        }
        return null;
      } catch {
        return null;
      }
    }

    const checks: Array<[string, string[]]> = [
      ["profiles", ["daily_kcal", "daily_goal", "goal_kcal"]],
      ["user_prefs", ["daily_kcal", "daily_goal", "goal_kcal"]],
      ["goals", ["daily", "daily_kcal", "kcal"]],
      ["targets", ["daily", "daily_kcal", "kcal"]],
      ["settings", ["daily_kcal", "daily_goal", "goal_kcal"]],
    ];

    for (const [table, cols] of checks) {
      const v = await trySelect(table, cols);
      if (typeof v === "number" && v > 0) return v;
    }
    return 0;
  }

  async function fetchTotals() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayISO = startOfDay.toISOString();

    const startOfWeek = new Date(startOfDay);
    const dow = (startOfWeek.getDay() + 6) % 7; // Monday=0
    startOfWeek.setDate(startOfWeek.getDate() - dow);
    const weekISO = startOfWeek.toISOString();

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthISO = startOfMonth.toISOString();

    async function sumSince(iso: string): Promise<number> {
      const { data, error } = await supabase
        .from("entries")
        .select("total_calories, created_at")
        .gte("created_at", iso)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error || !data) return 0;
      return data.reduce((s, r) => s + toNum((r as any).total_calories), 0);
    }

    const [d, w, m] = await Promise.all([sumSince(dayISO), sumSince(weekISO), sumSince(monthISO)]);
    setTotals({ day: d, week: w, month: m });
  }

  async function hydrate() {
    const [g] = await Promise.all([resolveDailyGoal(), fetchTotals()]);
    setGoal(toNum(g));
  }

  useEffect(() => {
    hydrate();

    const onGoals = () => hydrate();
    const onEntry = () => hydrate();
    const onVis = () => { if (document.visibilityState === "visible") hydrate(); };

    window.addEventListener("goals-updated", onGoals);
    window.addEventListener("entry-added", onEntry);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("goals-updated", onGoals);
      window.removeEventListener("entry-added", onEntry);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const weekPct = pct(totals.week);
  const monthPct = pct(totals.month);

  const segments = [
    { label: "Carbs",   value: Math.round(eaten * 0.55), color: "#F9736B" },
    { label: "Protein", value: Math.round(eaten * 0.30), color: "#10B981" },
    { label: "Fat",     value: Math.round(eaten * 0.15), color: "#F59E0B" },
  ];

  return (
    <div className="card">
      <div className="mb-2 text-sm font-medium text-slate-700">{pretty(t("totals") || "totals")}</div>

      <div className="flex items-center justify-between text-slate-800 text-sm px-1">
        <div className="text-center">
          <div className="text-2xl font-bold">{toNum(totals.day).toLocaleString()}</div>
          <div className="text-slate-500 -mt-1">{pretty(t("today") || "today")}</div>
        </div>

        <CircleRing goal={goal || 0} eaten={eaten} segments={segments} />

        <div className="text-center">
          <div className="text-2xl font-bold">{(goal || 0).toLocaleString()}</div>
          <div className="text-slate-500 -mt-1">Goal</div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {[
          { label: pretty(t("this_week") || "this_week"), val: totals.week, pct: weekPct },
          { label: pretty(t("this_month") || "this_month"), val: totals.month, pct: monthPct },
        ].map(({ label, val, pct }, i) => (
          <div key={i} className="rounded-2xl bg-white/70 backdrop-blur px-3 py-2 shadow-sm">
            <div className="flex items-center justify-between text-sm text-slate-800">
              <div>{label}</div>
              <div className="font-semibold">{toNum(val).toLocaleString()} kcal</div>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-2" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#F9736B,#F59E0B)" }} aria-hidden />
            </div>
            <div className="mt-1 text-xs text-slate-600">
              {goal > 0 ? `${pct}% of ${goal} kcal` : pretty(t("no_target_set") || "no_target_set")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
