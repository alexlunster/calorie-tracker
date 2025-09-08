"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { pretty } from "@/lib/ui";
import CircleRing from "@/components/CircleRing";

const toNum = (v: any) =>
  typeof v === "number" && isFinite(v) ? v : Number(v ?? 0) || 0;

type Totals = { day: number; week: number; month: number };

export default function TotalsBar() {
  const { t } = useI18n();

  const [totals, setTotals] = useState<Totals>({ day: 0, week: 0, month: 0 });

  // Goals from DB
  const [goalDay, setGoalDay] = useState<number>(0);
  const [goalWeek, setGoalWeek] = useState<number>(0);
  const [goalMonth, setGoalMonth] = useState<number>(0);

  // Eaten today
  const eaten = toNum(totals.day);

  // pct helper with denominator
  const pct = (val: number, denom: number) => {
    if (!isFinite(val) || denom <= 0) return 0;
    const p = Math.round((val / denom) * 100);
    return p < 0 ? 0 : p > 100 ? 100 : p;
  };

  async function getUserId(): Promise<string | null> {
    try {
      const { data } = await supabase.auth.getUser();
      return data?.user?.id ?? null;
    } catch {
      return null;
    }
  }

  // === GOALS: read from goals.daily_target / weekly_target / monthly_target
  async function fetchGoals(userId: string | null) {
    if (!userId) {
      setGoalDay(0);
      setGoalWeek(0);
      setGoalMonth(0);
      return;
    }
    try {
      const { data, error } = await (supabase as any)
        .from("goals")
        .select("daily_target, weekly_target, monthly_target")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;

      const daily = toNum(data?.daily_target);
      const weekly = toNum(data?.weekly_target || (daily > 0 ? daily * 7 : 0));
      const monthly = toNum(
        data?.monthly_target || (daily > 0 ? daily * 30 : 0)
      );

      setGoalDay(daily);
      setGoalWeek(weekly);
      setGoalMonth(monthly);
    } catch {
      setGoalDay(0);
      setGoalWeek(0);
      setGoalMonth(0);
    }
  }

  // === SUMS: user-scoped
  async function sumSince(userId: string | null, iso: string): Promise<number> {
    if (!userId) return 0;
    const { data, error } = await (supabase as any)
      .from("entries")
      .select("total_calories, created_at, user_id")
      .eq("user_id", userId)
      .gte("created_at", iso)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error || !data) return 0;
    return (data as any[]).reduce(
      (s, r) => s + toNum((r as any).total_calories),
      0
    );
  }

  async function hydrate() {
    const userId = await getUserId();

    // fetch goals first (needed for UI state)
    await fetchGoals(userId);

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayISO = startOfDay.toISOString();

    const startOfWeek = new Date(startOfDay);
    const dow = (startOfWeek.getDay() + 6) % 7; // Monday=0
    startOfWeek.setDate(startOfWeek.getDate() - dow);
    const weekISO = startOfWeek.toISOString();

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthISO = startOfMonth.toISOString();

    const [d, w, m] = await Promise.all([
      sumSince(userId, dayISO),
      sumSince(userId, weekISO),
      sumSince(userId, monthISO),
    ]);

    setTotals({ day: d, week: w, month: m });
  }

  useEffect(() => {
    hydrate();

    const onGoals = () => hydrate();
    const onEntryCreated = () => hydrate();
    const onLegacyAdded = () => hydrate();
    const onEntryUpdated = () => hydrate();
    const onVis = () => {
      if (document.visibilityState === "visible") hydrate();
    };

    window.addEventListener("goals-updated", onGoals);
    window.addEventListener("entry:created", onEntryCreated);
    window.addEventListener("entry-added", onLegacyAdded);
    window.addEventListener("entry:updated", onEntryUpdated);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("goals-updated", onGoals);
      window.removeEventListener("entry:created", onEntryCreated);
      window.removeEventListener("entry-added", onLegacyAdded);
      window.removeEventListener("entry:updated", onEntryUpdated);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const weekPct = pct(totals.week, goalWeek);
  const monthPct = pct(totals.month, goalMonth);

  // Over-limit state for the day
  const remaining = (goalDay || 0) - eaten;
  const isOver = (goalDay || 0) > 0 && eaten >= (goalDay || 0);
  const ringColor = isOver ? "#EF4444" : "#10B981";

  return (
    <div className="card">
      <div className="mb-2 text-sm font-medium text-slate-700">
        {pretty(t("totals") || "totals")}
      </div>

      <div className="flex items-center justify-between text-slate-800 text-sm px-1">
        <div className="text-center">
          <div className="text-2xl font-bold">{toNum(totals.day).toLocaleString()}</div>
          <div className="text-slate-500 -mt-1">{pretty(t("today") || "today")}</div>
        </div>

        <CircleRing
          goal={goalDay || 0}
          eaten={eaten}
          color={ringColor}
          center={
            <div className="text-center">
              <div className={`text-4xl font-extrabold leading-tight ${isOver ? "text-red-600" : "text-slate-900"}`}>
                {remaining.toLocaleString()}
                <span className="text-lg align-baseline"> kcal</span>
              </div>
              <div className="text-sm text-slate-600 -mt-1">
                {isOver ? "Too much food!" : pretty(t("remaining") || "remaining")}
              </div>
            </div>
          }
        />

        <div className="text-center">
          <div className="text-2xl font-bold">{(goalDay || 0).toLocaleString()}</div>
          <div className="text-slate-500 -mt-1">Goal</div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {[
          { label: pretty(t("this_week") || "this_week"), val: totals.week, pct: weekPct, denom: goalWeek },
          { label: pretty(t("this_month") || "this_month"), val: totals.month, pct: monthPct, denom: goalMonth },
        ].map(({ label, val, pct, denom }, i) => (
          <div key={i}>
            <div className="flex items-center justify-between text-sm">
              <div className="text-slate-700">{label}</div>
              <div className="font-semibold">{Math.round(val).toLocaleString()} kcal</div>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-2"
                style={{ width: `${pct}%`, background: "linear-gradient(90deg,#F9736B,#F59E0B)" }}
                aria-hidden
              />
            </div>
            <div className="mt-1 text-xs text-slate-600">
              {denom > 0 ? `${pct}% of ${denom} kcal` : pretty(t("no_target_set") || "no_target_set")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
