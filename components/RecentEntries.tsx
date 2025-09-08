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

export default function RecentEntries() {
  const { t } = useI18n();
  const [rows, setRows] = React.useState<EntryRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function fetchRows() {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id || null;

      const query = supabase
        .from("entries")
        .select("id,user_id,image_url,meal_name,total_calories,created_at,items")
        .order("created_at", { ascending: false })
        .limit(10);

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
    let alive = true;
    (async () => {
      if (!alive) return;
      await fetchRows();
    })();
    return () => { alive = false; };
  }, []);

  async function handleEdit(id: string, current: number) {
    const val = window.prompt("Enter calories (kcal)", String(current));
    if (val == null) return; // cancelled
    const parsed = Math.round(Number(val));
    if (!Number.isFinite(parsed) || parsed < 0) {
      alert("Please enter a non-negative number.");
      return;
    }
    try {
      setBusyId(id);
      const { error } = await supabase.from("entries").update({ total_calories: parsed }).eq("id", id);
      if (error) throw error;
      // update local list
      setRows((prev) => prev.map(r => r.id === id ? { ...r, total_calories: parsed } : r));
      // notify totals/components
      window.dispatchEvent(new Event("entry:updated"));
    } catch (e) {
      console.error("Edit failed:", e);
      alert("Failed to update entry.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    const ok = window.confirm("Delete this entry?");
    if (!ok) return;
    try {
      setBusyId(id);
      const { error } = await supabase.from("entries").delete().eq("id", id);
      if (error) throw error;
      setRows((prev) => prev.filter(r => r.id !== id));
      window.dispatchEvent(new Event("entry:updated"));
    } catch (e) {
      console.error("Delete failed:", e);
      alert("Failed to delete entry.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">{pretty(t("loading") || "loading")}…</div>;
  }

  if (!rows || rows.length === 0) {
    return <div className="text-sm text-gray-500">{pretty(t("no_recent_entries") || "no_recent_entries")}</div>;
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const kcal = Math.max(0, Number(r.total_calories ?? 0));
        const dt = new Date(r.created_at);
        const dateStr = dt.toLocaleString();
        const disabled = busyId === r.id;

        return (
          <div key={r.id} className="flex items-center justify-between rounded-2xl bg-white/80 backdrop-blur shadow-sm px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-900">
                {r.meal_name || pretty(t("untitled_meal") || "untitled_meal")}
              </div>
              <div className="text-xs text-gray-500">{dateStr}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm font-semibold tabular-nums">{kcal} kcal</div>
              <button
                onClick={() => handleEdit(r.id, kcal)}
                disabled={disabled}
                className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                aria-label="Edit calories"
                title="Edit calories"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(r.id)}
                disabled={disabled}
                className="text-xs px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                aria-label="Delete entry"
                title="Delete entry"
              >
                {pretty(t("delete") || "delete")}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
