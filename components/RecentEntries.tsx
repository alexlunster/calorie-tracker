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

function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

export default function RecentEntries() {
  const { t } = useI18n();

  const [rows, setRows] = React.useState<EntryRow[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);

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
      setRows((data as EntryRow[]) ?? []);
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
    setBusyId(row.id);
    try {
      const { error } = await supabase.from("entries").update({ total_calories: val }).eq("id", row.id);
      if (error) throw error;
      setRows(prev => prev.map(r => (r.id === row.id ? { ...r, total_calories: val } : r)));
      // let the totals widgets refresh
      window.dispatchEvent(new Event("entry:updated"));
    } catch (e) {
      alert(pretty(t("something_went_wrong") || "something_went_wrong"));
      console.error(e);
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(row: EntryRow) {
    const ok = confirm(pretty(t("are_you_sure_delete") || "are_you_sure_delete"));
    if (!ok) return;
    setBusyId(row.id);
    try {
      const { error } = await supabase.from("entries").delete().eq("id", row.id);
      if (error) throw error;
      setRows(prev => prev.filter(r => r.id !== row.id));
      window.dispatchEvent(new Event("entry:updated"));
    } catch (e) {
      alert(pretty(t("something_went_wrong") || "something_went_wrong"));
      console.error(e);
    } finally {
      setBusyId(null);
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
        const disabled = busyId === r.id;
        const calories = typeof r.total_calories === "number" ? r.total_calories : 0;
        const meal = r.meal_name || pretty(t("untitled_meal") || "untitled_meal");
        const when = new Date(r.created_at);
        const whenStr = when.toLocaleString();

        return (
          <div
            key={r.id}
            className="rounded-2xl bg-white/80 backdrop-blur border border-gray-200 p-3 shadow-sm"
          >
            {/* Row: fixed-width actions on the right, flexible title block on the left */}
            <div className="flex items-center gap-3">
              {/* Title block — can grow vertically; two-line clamp to keep width constant */}
              <div className="flex-1 min-w-0 pr-2">
                <div className="text-base font-medium leading-snug clamp-2">
                  {meal}
                </div>
                <div className="text-xs text-gray-500">{whenStr}</div>
              </div>

              {/* Calories (non-shrinking) */}
              <div className="shrink-0 whitespace-nowrap font-semibold text-gray-900">
                {calories} kcal
              </div>

              {/* Actions (non-shrinking) */}
              <div className="shrink-0 flex items-center gap-2">
                <button
                  onClick={() => onEditCalories(r)}
                  disabled={disabled}
                  className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                  aria-label={pretty(t("edit") || "edit")}
                  title={pretty(t("edit") || "edit")}
                >
                  {pretty(t("edit") || "edit")}
                </button>
                <button
                  onClick={() => onDelete(r)}
                  disabled={disabled}
                  className="text-xs px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  aria-label={pretty(t("delete") || "delete")}
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
