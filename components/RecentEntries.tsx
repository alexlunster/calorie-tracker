"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { pretty } from "@/lib/ui";

type DbEntry = {
  id: string;
  image_url: string | null;
  items: any | null; // { name?: string, items?: [{name, calories}], labels?: string[] }
  calories?: number | string | null;
  total_calories?: number | string | null;
  created_at: string;
};

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function extractName(items: any): string {
  if (!items) return "meal";
  // prefer explicit name we stored
  if (typeof items.name === "string" && items.name.trim()) {
    return items.name.trim();
  }
  // fall back to structured items names
  if (Array.isArray(items.items) && items.items.length) {
    const names = items.items
      .map((it: any) => (typeof it?.name === "string" ? it.name : null))
      .filter(Boolean) as string[];
    if (names.length) return Array.from(new Set(names)).slice(0, 3).join(", ");
  }
  // fall back to labels (if older rows)
  if (Array.isArray(items.labels) && items.labels.length) {
    return items.labels.slice(0, 3).join(", ");
  }
  return "meal";
}

export default function RecentEntries() {
  const { t } = useI18n();
  const [rows, setRows] = useState<DbEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setErr(null);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("entries")
      .select("id, image_url, items, calories, total_calories, created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) {
      setErr(error.message);
    } else if (data) {
      setRows(data as DbEntry[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    const onCreated = () => { void fetchRows(); };
    const onDeleted = () => { void fetchRows(); };
    window.addEventListener("entry:created", onCreated as EventListener);
    window.addEventListener("entry:deleted", onDeleted as EventListener);
    return () => {
      window.removeEventListener("entry:created", onCreated as EventListener);
      window.removeEventListener("entry:deleted", onDeleted as EventListener);
    };
  }, [fetchRows]);

  async function handleDelete(e: DbEntry) {
    setErr(null);
    try {
      // delete DB row
      const { error } = await supabase.from("entries").delete().eq("id", e.id);
      if (error) throw error;

      // delete image (best effort)
      if (e.image_url && e.image_url.includes("/photos/")) {
        const key = e.image_url.split("/photos/")[1];
        if (key) {
          await supabase.storage.from("photos").remove([key]);
        }
      }

      // local update
      setRows((old) => old.filter((r) => r.id !== e.id));

      // broadcast
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("entry:deleted", { detail: { id: e.id } }));
      }
    } catch (er: any) {
      setErr(er?.message || "Delete failed");
    }
  }

  return (
    <section className="border rounded-xl p-4 shadow-sm bg-white dark:bg-gray-900">
      <h3 className="font-semibold mb-3">{pretty(t("recent_entries") || "recent entries")}</h3>

      {err && <p className="text-sm text-red-600 mb-2">{pretty(err)}</p>}
      {loading && <p className="text-sm text-gray-500">{pretty(t("loading") || "loading")}…</p>}

      {!loading && rows.length === 0 && (
        <p className="text-sm text-gray-500">{pretty(t("no_entries_yet") || "no entries yet")}</p>
      )}

      <ul className="space-y-3">
        {rows.map((e) => {
          const name = extractName(e.items);
          const kcal = toNum(e.total_calories) || toNum(e.calories);
          const dt = new Date(e.created_at);
          const date = dt.toLocaleDateString();

          return (
            <li key={e.id} className="flex items-center justify-between gap-3 border rounded-lg p-3">
              <div className="flex items-center gap-3 min-w-0">
                {e.image_url ? (
                  <img
                    src={e.image_url}
                    alt={name}
                    className="w-14 h-14 rounded object-cover border"
                  />
                ) : (
                  <div className="w-14 h-14 rounded bg-gray-200" />
                )}
                <div className="min-w-0">
                  <div className="font-medium truncate">{pretty(name)}</div>
                  <div className="text-xs text-gray-500">{date}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-sm font-semibold">{Math.round(kcal)} kcal</div>
                <button
                  onClick={() => handleDelete(e)}
                  className="text-sm px-2 py-1 rounded border hover:bg-gray-50"
                  aria-label="Delete entry"
                >
                  {pretty(t("delete") || "delete")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
