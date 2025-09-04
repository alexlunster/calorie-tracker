"use client";

import React from "react";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { pretty } from "@/lib/ui";

type EntryRow = {
  id: string;
  image_url: string | null;
  meal_name: string | null;
  total_calories: number | null;
  created_at: string;
  items?: { name: string; calories: number }[] | null;
};

export default function RecentEntries() {
  const { t } = useI18n();
  const [rows, setRows] = React.useState<EntryRow[] | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("entries")
        .select("id,image_url,meal_name,total_calories,created_at,items")
        .order("created_at", { ascending: false })
        .limit(10);

      if (!alive) return;
      if (error) {
        console.error("Recent fetch error:", error);
        setRows([]);
      } else {
        setRows(data || []);
      }
      setLoading(false);
    })();

    // Optional: live “instant” add from UploadCard broadcast:
    function onNew(e: Event) {
      const entry = (e as CustomEvent).detail as EntryRow | undefined;
      if (!entry) return;
      setRows((prev) => [entry, ...(prev || [])].slice(0, 10));
    }
    window.addEventListener("entry:created", onNew);
    return () => {
      alive = false;
      window.removeEventListener("entry:created", onNew);
    };
  }, []);

  if (loading) {
    return (
      <div className="text-sm text-gray-500">
        {pretty(t("loading") || "loading")}…
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        {pretty(t("no_recent_entries") || "no_recent_entries")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const mealName =
          (r.meal_name && r.meal_name.trim()) ||
          (Array.isArray(r.items) && r.items[0]?.name) ||
          "meal";

        const kcal = typeof r.total_calories === "number" ? r.total_calories : 0;

        const when = new Date(r.created_at);
        const dateStr = when.toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        return (
          <div
            key={r.id}
            className="rounded-md border p-3 bg-white flex gap-3 items-center"
          >
            {r.image_url ? (
              <img
                src={r.image_url}
                alt={mealName}
                className="h-14 w-14 rounded object-cover border"
              />
            ) : (
              <div className="h-14 w-14 rounded bg-gray-100 border" />
            )}

            <div className="flex-1 min-w-0">
              {/* meal name is its own line → no truncation with date */}
              <div className="font-medium text-gray-900 break-words">
                {pretty(mealName)}
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
