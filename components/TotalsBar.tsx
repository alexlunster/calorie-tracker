"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { pretty } from "@/lib/ui";
import CircleRing from "@/components/CircleRing";

const toNum = (v: any) => (typeof v === "number" && isFinite(v) ? v : Number(v ?? 0) || 0);

type Totals = { day: number; week: number; month: number };
type Targets = { daily: number; weekly: number; monthly: number };

export default function TotalsBar() {
  const { t } = useI18n();

  const [totals, setTotals] = useState<Totals>({ day: 0, week: 0, month: 0 });
  const [targets, setTargets] = useState<Targets>({ daily: 0, weekly: 0, monthly: 0 });

  const eaten = toNum(totals.day);

  const pct = (val: number, target: number) => {
    const g = toNum(target);
    if (!isFinite(val) || g <= 0) return 0;
    const p = Math.round((val / g) * 100);
    return p < 0 ? 0 : p > 100 ? 100 : p;
  };

  async function fetchUserId(): Promise<string | null> {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) return null;
    return data.user.id;
  }

  async function fetchTargets(userId: string): Promise<Targets> {
    // read from 'goals' row for this user
    const { data, error } = await supabase
      .from("goals")
      .select("daily_target, weekly_target, monthly_target")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) return { daily: 0, weekly: 0, monthly: 0 };
    return {
      daily: toNum((data as any).daily_target),
      weekly: toNum((data as any).weekly_target),
      monthly: toNum((data as any).monthly_target),
    };
  }

  async function fetchTotals(userId: string): Promise<Totals> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    const dow = (startOfWeek.getDay() + 6) % 7; // Monday=0
    startOfWeek.setDate(startOfWeek.getDate() - dow);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const dayISO = startOfDay.toISOString();
    const weekISO = startOfWeek.toISOString();
    const monthISO = startOfMonth.toISOString();

    async function sumSince(iso: string): Promise<number> {
      const { data, error } = await supabase
        .from("entries")
        .select("total_calories, created_at, user_id")
        .eq("user_id", userId)
        .gte("created_at", iso)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error || !data) return 0;
      return (data as any[]).reduce((s, r) => s + toNum((r as any).total_calories), 0);
    }

    const [d, w, m] = await Promise.all([sumSince(dayISO), sumSince(weekISO), sumSince(monthISO)]);
    return { day: d, week: w, month: m };
  }

  async function hydrate() {
    const userId = await fetchUserId();
    if (!userId) return;
    const [tgs, tots] = await Promise.all([fetchTargets(userId), fetchTotals(userId)]);
    setTargets(tgs);
    setTotals(tots);
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

        <CircleRing goal={targets.daily || 0} eaten={eaten} segments={segments} />

        <div className="text-center">
          <div className="text-2xl font-bold">{(targets.daily || 0).toLocaleString()}</div>
          <div className="text-slate-500 -mt-1">Goal</div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {[
          { label: pretty(t("this_week") || "this_week"), val: totals.week, target: targets.weekly },
          { label: pretty(t("this_month") || "this_month"), val: totals.month, target: targets.monthly },
        ].map(({ label, val, target }, i) => {
          const p = pct(val, target);
          return (
            <div key={i} className="rounded-2xl bg-white/70 backdrop-blur px-3 py-2 shadow-sm">
              <div className="flex items-center justify-between text-sm text-slate-800">
                <div>{label}</div>
                <div className="font-semibold">{toNum(val).toLocaleString()} kcal</div>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-2" style={{ width: `${p}%`, background: "linear-gradient(90deg,#F9736B,#F59E0B)" }} aria-hidden />
              </div>
              <div className="mt-1 text-xs text-slate-600">
                {target > 0 ? `${p}% of ${target} kcal` : pretty(t("no_target_set") || "no_target_set")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
