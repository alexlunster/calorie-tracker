"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { pretty } from "@/lib/ui";
import CircleRing from "@/components/CircleRing";

// ---- utils ---------------------------------------------------
const toNum = (v: any) =>
  typeof v === "number" && isFinite(v) ? v : Number(v ?? 0) || 0;

type Totals = { day: number; week: number; month: number };

/**
 * AutoFitText
 * Keeps the ring size constant and shrinks the number if it would overflow.
 * We measure the available width and decrease font-size until it fits.
 */
function AutoFitText({
  children,
  max = 44,
  min = 18,
  className = "",
}: {
  children: React.ReactNode;
  max?: number; // px
  min?: number; // px
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const spanRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const box = boxRef.current;
    const span = spanRef.current;
    if (!box || !span) return;

    function fit() {
      if (!box || !span) return;
      const available = box.clientWidth;
      if (available <= 0) return;

      let size = max;
      span.style.fontSize = size + "px";
      span.style.whiteSpace = "nowrap";

      // Shrink until it fits or we hit the minimum.
      let guard = 0;
      while (span.scrollWidth > available && size > min && guard++ < 60) {
        size -= 1;
        span.style.fontSize = size + "px";
      }
    }

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);

    const mo = new MutationObserver(fit);
    mo.observe(span, { characterData: true, childList: true, subtree: true });

    window.addEventListener("resize", fit);
    document.addEventListener("visibilitychange", fit);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", fit);
      document.removeEventListener("visibilitychange", fit);
    };
  }, [children, max, min]);

  return (
    <div ref={boxRef} className={`w-[78%] mx-auto ${className}`}>
      <span
        ref={spanRef}
        className="block leading-tight font-extrabold text-center"
      >
        {children}
      </span>
    </div>
  );
}

// ---- component -----------------------------------------------
export default function TotalsBar() {
  const { t } = useI18n();

  const [totals, setTotals] = useState<Totals>({ day: 0, week: 0, month: 0 });

  // Goals from DB
  const [goalDay, setGoalDay] = useState<number>(0);
  const [goalWeek, setGoalWeek] = useState<number>(0);
  const [goalMonth, setGoalMonth] = useState<number>(0);

  const eaten = toNum(totals.day);

  // % helpers
  const pctClamped = (val: number, denom: number) => {
    if (!isFinite(val) || denom <= 0) return 0;
    const p = Math.round((val / denom) * 100);
    return p < 0 ? 0 : p > 100 ? 100 : p;
  };
  const pctUnbounded = (val: number, denom: number) => {
    if (!isFinite(val) || denom <= 0) return 0;
    return Math.round((val / denom) * 100); // can be > 100
  };

  async function getUserId(): Promise<string | null> {
    try {
      const { data } = await supabase.auth.getUser();
      return data?.user?.id ?? null;
    } catch {
      return null;
    }
  }

  // === GOALS
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

  // === TOTALS since given ISO date
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
    await fetchGoals(userId);

    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
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

  // Daily ring logic
  const remaining = (goalDay || 0) - eaten;
  const isOver = (goalDay || 0) > 0 && eaten >= (goalDay || 0);
  const ringColor = isOver ? "#EF4444" : "#10B981";

  // Weekly/Monthly percents
  const weekPctBar = pctClamped(totals.week, goalWeek);
  const weekPctText = pctUnbounded(totals.week, goalWeek);
  const weekOver = goalWeek > 0 && weekPctText > 100;

  const monthPctBar = pctClamped(totals.month, goalMonth);
  const monthPctText = pctUnbounded(totals.month, goalMonth);
  const monthOver = goalMonth > 0 && monthPctText > 100;

  return (
    <div className="card">
      <div className="mb-2 text-sm font-medium text-slate-700">
        {pretty(t("totals") || "totals")}
      </div>

      {/* Fixed left/right width; ring never shifts; ring size constant */}
      <div className="flex items-center justify-between text-slate-800 text-sm px-1">
        <div className="text-center shrink-0 w-20 md:w-24">
          <div className="text-2xl font-bold">
            {toNum(totals.day).toLocaleString()}
          </div>
          <div className="text-slate-500 -mt-1">
            {pretty(t("today") || "today")}
          </div>
        </div>

        <div className="shrink-0">
          <CircleRing
            size={220}
            stroke={18}
            goal={goalDay || 0}
            eaten={eaten}
            color={ringColor}
            center={
              <div className="text-center">
                <AutoFitText
                  max={44}
                  min={20}
                  className={isOver ? "text-red-600" : "text-slate-900"}
                >
                  {/* Whole line shrinks together to avoid layout shifts */}
                  <span>
                    {remaining.toLocaleString()}{" "}
                    <span style={{ fontSize: "0.48em" }}>kcal</span>
                  </span>
                </AutoFitText>
                <div className="text-sm text-slate-600 -mt-1">
                  {isOver
                    ? "Too much food!"
                    : pretty(t("remaining") || "remaining")}
                </div>
              </div>
            }
          />
        </div>

        <div className="text-center shrink-0 w-20 md:w-24">
          <div className="text-2xl font-bold">
            {(goalDay || 0).toLocaleString()}
          </div>
          <div className="text-slate-500 -mt-1">Goal</div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {/* Week */}
        <div>
          <div className="flex items-center justify-between text-sm">
            <div className="text-slate-700">
              {pretty(t("this_week") || "this_week")}
            </div>
            <div className="font-semibold">
              {Math.round(totals.week).toLocaleString()} kcal
            </div>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-2"
              style={{
                width: `${weekPctBar}%`,
                background: "linear-gradient(90deg,#F9736B,#F59E0B)",
              }}
              aria-hidden
            />
          </div>
          <div
            className={`mt-1 text-xs ${
              weekOver ? "text-red-600 font-semibold" : "text-slate-600"
            }`}
          >
            {goalWeek > 0
              ? `${weekPctText}% of ${goalWeek.toLocaleString()} kcal`
              : pretty(t("no_target_set") || "no_target_set")}
          </div>
        </div>

        {/* Month */}
        <div>
          <div className="flex items-center justify-between text-sm">
            <div className="text-slate-700">
              {pretty(t("this_month") || "this_month")}
            </div>
            <div className="font-semibold">
              {Math.round(totals.month).toLocaleString()} kcal
            </div>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-2"
              style={{
                width: `${monthPctBar}%`,
                background: "linear-gradient(90deg,#F9736B,#F59E0B)",
              }}
              aria-hidden
            />
          </div>
          <div
            className={`mt-1 text-xs ${
              monthOver ? "text-red-600 font-semibold" : "text-slate-600"
            }`}
          >
            {goalMonth > 0
              ? `${monthPctText}% of ${goalMonth.toLocaleString()} kcal`
              : pretty(t("no_target_set") || "no_target_set")}
          </div>
        </div>
      </div>
    </div>
  );
}
