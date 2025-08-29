"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { pretty, pct } from "@/lib/ui";
import { useI18n } from "@/components/I18nProvider";

type Entry = {
  calories?: number | string | null;
  total_calories?: number | string | null;
  created_at: string;
};

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function TotalsBar() {
  const { t } = useI18n();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [dailyTarget, setDailyTarget] = useState<number>(2000);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setLoading(false);
        return;
      }

      const { data: rows } = await supabase
        .from("entries")
        .select("calories, total_calories, created_at")
        .eq("user_id", auth.user.id)
        .gte("created_at", new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString())
        .order("created_at", { ascending: false });

      if (rows) setEntries(rows as Entry[]);

      const { data: prof } = await supabase
        .from("profiles")
        .select("daily_target")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (prof?.daily_target) {
        const n = Number(prof.daily_target);
        if (Number.isFinite(n)) setDailyTarget(n);
      }

      setLoading(false);
    })();
  }, []);

  const { day, week, month, weekTarget, monthTarget } = useMemo(() => {
    const now = new Date();

    const startOfDay = new Date(now); startOfDay.setHours(0,0,0,0);
    const startOfWeek = new Date(now);
    const dayIdx = (startOfWeek.getDay() + 6) % 7; // Monday=0
    startOfWeek.setDate(startOfWeek.getDate() - dayIdx);
    startOfWeek.setHours(0,0,0,0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const value = (e: Entry) =>
      toNum(e.total_calories) || toNum(e.calories);

    const d = entries.filter(e => new Date(e.created_at) >= startOfDay)
      .reduce((s, e) => s + value(e), 0);

    const w = entries.filter(e => new Date(e.created_at) >= startOfWeek)
      .reduce((s, e) => s + value(e), 0);

    const m = entries.filter(e => new Date(e.created_at) >= startOfMonth)
      .reduce((s, e) => s + value(e), 0);

    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    return {
      day: d,
      week: w,
      month: m,
      weekTarget: dailyTarget * 7,
      monthTarget: dailyTarget * daysInMonth,
    };
  }, [entries, dailyTarget]);

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{pretty(t("totals") || "Totals")}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <TotalCard label={pretty(t("day") || "day")} value={day} target={dailyTarget} />
        <TotalCard label={pretty(t("week") || "week")} value={week} target={weekTarget} />
        <TotalCard label={pretty(t("month") || "month")} value={month} target={monthTarget} />
      </div>

      {loading && (
        <p className="text-sm text-gray-500">{pretty(t("loading") || "loading")}…</p>
      )}
    </section>
  );
}

function TotalCard({ label, value, target }: { label: string; value: number; target: number }) {
  const percent = pct(target > 0 ? (value / target) * 100 : 0);
  return (
    <div className="border rounded-lg p-3 bg-white dark:bg-gray-900">
      <div className="text-sm text-gray-600">{label}</div>
      <div className="text-2xl font-semibold">{Math.round(value)} kcal</div>
      <div className="mt-2">
        <div className="w-full h-2 rounded bg-gray-200 overflow-hidden">
          <div className="h-2 bg-blue-600" style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-1 text-xs text-gray-500">
          {Math.round(percent)}% of {Math.round(target)} kcal
        </div>
      </div>
    </div>
  );
}
