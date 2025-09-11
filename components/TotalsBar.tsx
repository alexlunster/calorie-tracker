"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { pretty } from "@/lib/ui";
import CircleRing from "@/components/CircleRing";

// ---------- helpers ----------
const toNum = (v: any) =>
  typeof v === "number" && isFinite(v) ? v : Number(v ?? 0) || 0;

type Totals = { day: number; week: number; month: number };

/**
 * AutoFitText – fixed container width; shrink text if it would overflow.
 * (All DOM reads guarded to satisfy TypeScript.)
 */
function AutoFitText({
  children,
  max = 44,
  min = 14,
  className = "",
}: {
  children: React.ReactNode;
  max?: number;
  min?: number;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const spanRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const fit = () => {
      const elBox = boxRef.current;
      const elSpan = spanRef.current;
      if (!elBox || !elSpan) return;

      const available = elBox.clientWidth;
      if (available <= 0) return;

      let size = max;
      elSpan.style.fontSize = size + "px";
      elSpan.style.whiteSpace = "nowrap";

      let guard = 0;
      while (elSpan.scrollWidth > available && size > min && guard++ < 100) {
        size -= 1;
        elSpan.style.fontSize = size + "px";
      }
    };

    fit();

    const ro = new ResizeObserver(() => fit());
    if (boxRef.current) ro.observe(boxRef.current);

    const mo = new MutationObserver(() => fit());
    if (spanRef.current)
      mo.observe(spanRef.current, {
        characterData: true,
        childList: true,
        subtree: true,
      });

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
    <div ref={boxRef} className={className}>
      <span
        ref={spanRef}
        className="block leading-tight font-extrabold text-center"
      >
        {children}
      </span>
    </div>
  );
}

/** Simple responsive dimensions for the ring + side boxes */
function computeDims(win: Window | null) {
  // Defaults for SSR
  let side = 112; // px
  let ring = 220; // px
  if (win) {
    const w = win.innerWidth;
    if (w >= 1024) {
      side = 148;
      ring = 260;
    } else if (w >= 768) {
      side = 132;
      ring = 240;
    }
  }
  return { side, ring };
}

export default function TotalsBar() {
  const { t } = useI18n();

  const [totals, setTotals] = useState<Totals>({ day: 0, week: 0, month: 0 });
  const [goalDay, setGoalDay] = useState<number>(0);
  const [goalWeek, setGoalWeek] = useState<number>(0);
  const [goalMonth, setGoalMonth] = useState<number>(0);

  const [dims, setDims] = useState(() => computeDims(null));

  // keep ring + sides fixed; adjust on resize only
  useEffect(() => {
    const update = () => setDims(computeDims(window));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const eaten = toNum(totals.day);

  const pctClamped = (val: number, denom: number) => {
    if (!isFinite(val) || denom <= 0) return 0;
    const p = Math.round((val / denom) * 100);
    return p < 0 ? 0 : p > 100 ? 100 : p;
  };
  const pctUnbounded = (val: number, denom: number) => {
    if (!isFinite(val) || denom <= 0) return 0;
    return Math.round((val / denom) * 100);
  };

  async function getUserId(): Promise<string | null> {
    try {
      const { data } = await supabase.auth.getUser();
      return data?.user?.id ?? null;
    } catch {
      return null;
    }
  }

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
    const dow = (startOfWeek.getDay() + 6) % 7; // Monday = 0
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

    const onAny = () => hydrate();
    window.addEventListener("goals-updated", onAny);
    window.addEventListener("entry:created", onAny);
    window.addEventListener("entry-added", onAny);
    window.addEventListener("entry:updated", onAny);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") hydrate();
    });
    return () => {
      window.removeEventListener("goals-updated", onAny);
      window.removeEventListener("entry:created", onAny);
      window.removeEventListener("entry-added", onAny);
      window.removeEventListener("entry:updated", onAny);
    };
  }, []);

  // Daily ring logic
  const remaining = (goalDay || 0) - eaten;
  const isOver = (goalDay || 0) > 0 && eaten >= (goalDay || 0);
  const ringColor = isOver ? "#EF4444" : "#10B981";

  // Weekly/Monthly
  const weekPctBar = pctClamped(totals.week, goalWeek);
  const weekPctText = pctUnbounded(totals.week, goalWeek);
  const weekOver = goalWeek > 0 && weekPctText > 100;

  const monthPctBar = pctClamped(totals.month, goalMonth);
  const monthPctText = pctUnbounded(totals.month, goalMonth);
  const monthOver = goalMonth > 0 && monthPctText > 100;

  // Side text sizing: allow a touch larger font on wider screens
  const sideMax = dims.ring >= 240 ? 34 : 30;

  return (
    <div className="card">
      <div className="mb-2 text-sm font-medium text-slate-700">
        {pretty(t("totals") || "totals")}
      </div>

      {/* GRID with fixed columns: [LEFT fixed][CENTER fixed ring][RIGHT fixed] */}
      <div className="px-1">
        <div
          className="grid items-center justify-items-center text-slate-800 text-sm"
          style={{
            gridTemplateColumns: `${dims.side}px ${dims.ring}px ${dims.side}px`,
          }}
        >
          {/* LEFT: Today (fixed width, auto-shrink digits) */}
          <div className="w-full text-center">
            <AutoFitText max={sideMax} min={12}>
              {toNum(totals.day).toLocaleString()}
            </AutoFitText>
            <div className="text-slate-500 -mt-1">
              {pretty(t("today") || "today")}
            </div>
          </div>

          {/* CENTER: Ring (constant size & position) */}
          <div className="w-full flex items-center justify-center">
            <CircleRing
              size={dims.ring}
              stroke={18}
              goal={goalDay || 0}
              eaten={eaten}
              color={ringColor}
              center={
                <div className="text-center">
                  <AutoFitText
                    max={46}
                    min={18}
                    className={isOver ? "text-red-600" : "text-slate-900"}
                  >
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

          {/* RIGHT: Goal (fixed width, auto-shrink digits) */}
          <div className="w-full text-center">
            <AutoFitText max={sideMax} min={12}>
              {(goalDay || 0).toLocaleString()}
            </AutoFitText>
            <div className="text-slate-500 -mt-1">Goal</div>
          </div>
        </div>
      </div>

      {/* Week & Month bars */}
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
