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

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id || null;

      const query = supabase
        .from("entries")
        .select("id,user_id,image_url,meal_name,total_calories,created_at,items")
        .order("created_at", { ascending: false })
        .limit(10);

      const { data, error } = uid ? await query.eq("user_id", uid) : await query;

      if (!alive) return;
      if (error) {
        console.error("Recent fetch error:", error);
        setRows([]);
      } else {
        setRows((data as any[]) || []);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

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

        return (
          <div key={r.id} className="flex items-center justify-between rounded-2xl bg-white/80 backdrop-blur shadow-sm px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-900">
                {r.meal_name || pretty(t("untitled_meal") || "untitled_meal")}
              </div>
              <div className="text-xs text-gray-500">{dateStr}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">{kcal} kcal</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
