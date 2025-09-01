"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { pretty } from "@/lib/ui";

// small util so we don't explode on weird data
const n = (v: any) => (typeof v === "number" && !isNaN(v) ? v : Number(v ?? 0) || 0);

type Totals = {
  day: number;
  week: number;
  month: number;
};

type Goals = {
  daily_target: number | null;
  weekly_target: number | null;
  monthly_target: number | null;
};

export default function TotalsBar() {
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState<Totals>({ day: 0, week: 0, month: 0 });
  const [goals, setGoals] = useState<Goals>({
    daily_target: null,
    weekly_target: null,
    monthly_target: null,
  });
  const [err, setErr] = useState<string | null>(null);

  // --- fetch helpers ---------------------------------------------------------
  async function getUserId() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error("not_authenticated");
    return data.user.id;
  }

  function rangeFor(type: "day" | "week" | "month") {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);
    if (type === "day") {
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 1);
      end.setHours(0, 0, 0, 0);
    } else if (type === "week") {
      const d = start.getDay(); // 0 Sun..6 Sat
      const diff = (d + 6) % 7; // make Monday the start
      start.setDate(start.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 7);
      end.setHours(0, 0, 0, 0);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(start.getMonth() + 1, 1);
      end.setHours(0, 0, 0, 0);
    }
    return { start: start.toISOString(), end: end.toISOString() };
  }

  async function fetchTotalsAndGoals() {
    setLoading(true);
    setErr(null);
    try {
      const userId = await getUserId();

      // fetch goals
      const { data: g, error: gErr } = await supabase
        .from("goals")
        .select("daily_target, weekly_target, monthly_target")
        .eq("user_id", userId)
        .maybeSingle();
      if (gErr) throw gErr;

      // compute totals client-side (works with RLS)
      const types: Array<keyof Totals> = ["day", "week", "month"];
      const sums: Totals = { day: 0, week: 0, month: 0 };

      for (const k of types) {
        const { start, end } = rangeFor(k);
        const { data: rows, error: e } = await supabase
          .from("entries")
          .select("total_calories, calories, created_at")
          .eq("user_id", userId)
          .gte("created_at", start)
          .lt("created_at", end);
        if (e) throw e;

        let sum = 0;
        (rows || []).forEach((r: any) => {
          // prefer total_calories, fallback to calories
          sum += n(r.total_calories ?? r.calories ?? 0);
        });
        sums[k] = sum;
      }

      setGoals({
        daily_target: g?.daily_target ?? null,
        weekly_target: g?.weekly_target ?? null,
        monthly_target: g?.monthly_target ?? null,
      });
      setTotals(sums);
    } catch (e: any) {
      setErr(e?.message ?? "failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTotalsAndGoals();

    // refresh totals when targets get updated
    const onGoals = () => fetchTotalsAndGoals();
    // and when a new entry is added (UploadCard can dispatch this)
    const onEntry = () => fetchTotalsAndGoals();
    // also refetch when tab regains focus
    const onVis = () => {
      if (document.visibilityState === "visible") fetchTotalsAndGoals();
    };

    window.addEventListener("goals-updated", onGoals);
    window.addEventListener("entry-added", onEntry);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("goals-updated", onGoals);
      window.removeEventListener("entry-added", onEntry);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cards = useMemo(() => {
    const dGoal = n(goals.daily_target);
    // if weekly/monthly are null, derive from daily so progress works immediately
    const wGoal = n(goals.weekly_target ?? (dGoal ? dGoal * 7 : 0));
    const mGoal = n(goals.monthly_target ?? (dGoal ? dGoal * 30 : 0));

    return [
      {
        label: pretty(t("today") || "today"),
        value: totals.day,
        goal: dGoal,
      },
      {
        label: pretty(t("this_week") || "this_week"),
        value: totals.week,
        goal: wGoal,
      },
      {
        label: pretty(t("this_month") || "this_month"),
        value: totals.month,
        goal: mGoal,
      },
    ];
  }, [totals, goals, t]);

  if (loading) {
    return (
      <div className="rounded-lg border p-4 text-sm text-gray-500">
        {pretty(t("loading") || "loading")}…
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-lg border p-4 text-sm text-red-600">
        {pretty(err)}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((c) => {
        const goal = n(c.goal);
        const pct = goal > 0 ? Math.min(100, Math.round((n(c.value) / goal) * 100)) : 0;
        return (
          <div key={c.label} className="rounded-lg border p-4">
            <div className="text-sm text-gray-600 mb-1">{c.label}</div>
            <div className="text-2xl font-semibold">{n(c.value)} kcal</div>
            <div className="mt-2 h-2 w-full rounded bg-gray-200 overflow-hidden">
              <div
                className="h-2 bg-blue-600"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
            </div>
            <div className="mt-1 text-xs text-gray-600">
              {goal > 0 ? `${pct}% of ${goal} kcal` : pretty(t("no_target_set") || "no_target_set")}
            </div>
          </div>
        );
      })}
    </div>
  );
}
