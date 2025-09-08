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

function Dashboard() {
  const { t } = useI18n();
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id || null;

      const query = supabase
        .from("entries")
        .select("id,image_url,total_calories,meal_name,labels,created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      const { data, error } = uid ? await query.eq("user_id", uid) : await query;
      if (!alive) return;
      if (error || !data) setEntries([]);
      else {
        // adapt to support legacy 'calories' and newer 'total_calories'
        setEntries((data as any[]).map((r: any) => ({
          id: r.id,
          image_url: r.image_url,
          calories: typeof r.total_calories === "number" ? r.total_calories : (r.calories ?? 0),
          meal_name: r.meal_name,
          labels: r.labels ?? [],
          created_at: r.created_at,
        })));
      }
    })();
    return () => { alive = false; };
  }, []);

  function handleDelete(id: string) {
    const ok = window.confirm("Delete this entry?");
    if (!ok) return;
    (async () => {
      try {
        await supabase.from("entries").delete().eq("id", id);
        setEntries((prev) => prev.filter((e) => e.id !== id));
        window.dispatchEvent(new Event("entry:updated"));
      } catch (e) {
        console.error("Delete failed:", e);
        alert("Failed to delete entry.");
      }
    })();
  }

  function handleEdit(id: string, current: number) {
    const val = window.prompt("Enter calories (kcal)", String(current));
    if (val == null) return;
    const parsed = Math.round(Number(val));
    if (!Number.isFinite(parsed) || parsed < 0) {
      alert("Please enter a non-negative number.");
      return;
    }
    (async () => {
      try {
        await supabase.from("entries").update({ total_calories: parsed }).eq("id", id);
        setEntries((prev) => prev.map((e) => e.id === id ? { ...e, calories: parsed } : e));
        window.dispatchEvent(new Event("entry:updated"));
      } catch (e) {
        console.error("Edit failed:", e);
        alert("Failed to update entry.");
      }
    })();
  }

  // ...totals derivation and other UI left unchanged...

  return (
    <div className="space-y-4">
      {/* entries list */}
      <div className="space-y-3">
        {entries.map((e) => (
          <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg bg-white shadow-sm">
            {e.image_url ? (
              <img src={e.image_url} alt="" className="w-16 h-16 object-cover rounded" />
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
              <div className="font-semibold">
                {typeof (e as any).calories === "number" ? (e as any).calories : (e as any).total_calories || 0} kcal
              </div>
              <button
                onClick={() => handleEdit(e.id, typeof (e as any).calories === "number" ? (e as any).calories : (e as any).total_calories || 0)}
                className="text-xs text-slate-600 hover:underline mt-1 mr-3"
              >
                Edit
              </button>
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

export default Dashboard;

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-lg p-3 bg-white dark:bg-gray-900">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
