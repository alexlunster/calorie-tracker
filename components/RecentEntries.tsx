"use client";

import React from "react";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { pretty } from "@/lib/ui";

type EntryRow = {
  id: string;
  user_id?: string;
  image_url: string | null;
  meal_name: string | null;
  total_calories: number | null;
  created_at: string;
  items?: { name: string; calories: number }[] | null;
};

function toNum(v: any): number {
  if (typeof v === "number" && isFinite(v)) return v;
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

export default function RecentEntries() {
  const { t } = useI18n();
  const [rows, setRows] = React.useState<EntryRow[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);

  async function load() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id;

      let query = supabase
        .from("entries")
        .select("id, user_id, image_url, meal_name, total_calories, created_at, items")
        .order("created_at", { ascending: false })
        .limit(100);

      const { data, error } = uid ? await query.eq("user_id", uid) : await query;
      if (error) throw error;
      setRows((data as any[]) || []);
    } catch (e) {
      console.error("Recent fetch error:", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  async function onEditCalories(row: EntryRow) {
    const current = row.total_calories ?? 0;
    const maybe = prompt(pretty(t("enter_calories") || "enter_calories"), String(current));
    if (maybe == null) return;
    const val = Math.max(0, Math.round(toNum(maybe)));
    try {
      const { error } = await supabase.from("entries").update({ total_calories: val }).eq("id", row.id);
      if (error) throw error;
      setRows(prev => prev.map(r => (r.id === row.id ? { ...r, total_calories: val } : r)));
    } catch (e) {
      alert(pretty(t("something_went_wrong") || "something_went_wrong"));
      console.error(e);
    }
  }

  async function onDelete(row: EntryRow) {
    const ok = confirm(pretty(t("are_you_sure_delete") || "are_you_sure_delete"));
    if (!ok) return;
    try {
      const { error } = await supabase.from("entries").delete().eq("id", row.id);
      if (error) throw error;
      setRows(prev => prev.filter(r => r.id !== row.id));
    } catch (e) {
      alert(pretty(t("something_went_wrong") || "something_went_wrong"));
      console.error(e);
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">{pretty(t("loading") || "loading")}…</div>;
  }

  if (!rows.length) {
    return <div className="text-sm text-gray-500">{pretty(t("no_recent_entries") || "no_recent_entries")}</div>;
  }

  return (
    <div className="grid gap-3">
      {rows.map((r) => {
        const calories = typeof r.total_calories === "number" ? r.total_calories : 0;
        const meal = r.meal_name || pretty(t("untitled_meal") || "untitled_meal");
        const when = new Date(r.created_at);
        const whenStr = when.toLocaleString();

        return (
          <div key={r.id} className="rounded-2xl bg-white/80 backdrop-blur border border-gray-200 p-3 shadow-sm">
            <div className="flex items-start gap-3">
              {/* TITLE — limited to one visible line with ellipsis; won't push buttons */}
              <div className="flex-1 min-w-0">
                <div className="text-base font-medium leading-6 truncate">{meal}</div>
                <div className="text-xs text-gray-500">{whenStr}</div>
              </div>

              {/* Calories */}
              <div className="whitespace-nowrap font-semibold text-gray-900">{calories} kcal</div>

              {/* Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onEditCalories(r)}
                  className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
                  aria-label="Edit entry calories"
                  title={pretty(t("edit") || "edit")}
                >
                  {pretty(t("edit") || "edit")}
                </button>
                <button
                  onClick={() => onDelete(r)}
                  className="text-xs px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50"
                  aria-label="Delete entry"
                  title={pretty(t("delete") || "delete")}
                >
                  {pretty(t("delete") || "delete")}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
