"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { pretty } from "@/lib/ui";

type Entry = {
  id: string;
  image_url: string | null;
  calories: number | null;
  meal_name?: string | null;
  labels?: string[] | null;
  created_at: string;
};

export default function Dashboard() {
  const { t } = useI18n();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data, error } = await supabase
        .from("entries")
        .select("id,image_url,calories,meal_name,labels,created_at")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (!error && data) setEntries(data as Entry[]);
      setLoading(false);
    })();
  }, []);

  // Totals (day / week / month)
  const { day, week, month } = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(now);
    const dayIdx = (startOfWeek.getDay() + 6) % 7; // Mon=0
    startOfWeek.setDate(startOfWeek.getDate() - dayIdx);
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const toNum = (v: number | null | undefined) => (typeof v === "number" ? v : 0);

    const d = entries
      .filter((e) => new Date(e.created_at) >= startOfDay)
      .reduce((s, e) => s + toNum(e.calories), 0);

    const w = entries
      .filter((e) => new Date(e.created_at) >= startOfWeek)
      .reduce((s, e) => s + toNum(e.calories), 0);

    const m = entries
      .filter((e) => new Date(e.created_at) >= startOfMonth)
      .reduce((s, e) => s + toNum(e.calories), 0);

    return { day: d, week: w, month: m };
  }, [entries]);

  async function handleDelete(id: string) {
    // delete DB row; storage cleanup handled by scheduled job
    await supabase.from("entries").delete().eq("id", id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div className="space-y-4">
      {/* Totals row */}
      <div className="grid grid-cols-3 gap-3">
        <Card label={pretty(t("Totals"))} value="" />
        <Card label={pretty(t("day") || "day")} value={`${day} kcal`} />
        <Card label={pretty(t("week") || "week")} value={`${week} kcal`} />
        <Card label={pretty(t("month") || "month")} value={`${month} kcal`} />
      </div>

      {/* Recent entries */}
      <div className="space-y-2">
        {loading && <p className="text-sm text-gray-500">{pretty(t("loading"))}…</p>}
        {!loading && entries.length === 0 && (
          <p className="text-sm text-gray-500">{pretty(t("no_entries_yet") || "no_entries_yet")}</p>
        )}
        {entries.slice(0, 10).map((e) => (
          <div
            key={e.id}
            className="flex items-center gap-3 border rounded-lg p-2 bg-white dark:bg-gray-900"
          >
            {e.image_url ? (
              <img
                src={e.image_url}
                alt={pretty(e.meal_name || "meal")}
                className="w-16 h-16 rounded object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded bg-gray-200" />
            )}

            <div className="flex-1">
              <div className="font-medium">{pretty(e.meal_name || (e.labels?.[0] ?? "meal"))}</div>
              <div className="text-xs text-gray-500">
                {new Date(e.created_at).toLocaleString()}
              </div>
            </div>

            <div className="text-right">
              <div className="font-semibold">{typeof e.calories === "number" ? e.calories : 0} kcal</div>
              <button
                onClick={() => handleDelete(e.id)}
                className="text-xs text-red-600 hover:underline mt-1"
              >
                {pretty(t("delete") || "delete")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-lg p-3 bg-white dark:bg-gray-900">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
