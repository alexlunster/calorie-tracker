"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { pretty } from "@/lib/ui";

type DbEntry = {
  id: string;
  image_url: string | null;
  items: any | null;                // jsonb with various shapes across versions
  calories?: number | string | null;
  total_calories?: number | string | null;
  created_at: string;
};

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function ensureObject(v: any): any | null {
  if (!v) return null;
  if (typeof v === "object") return v;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return null;
}

/** Extract a human label from any historical 'items' json shape */
function extractName(raw: any): string {
  const obj = ensureObject(raw);
  if (!obj) return "meal";

  // Preferred
  if (typeof obj.name === "string" && obj.name.trim()) return obj.name.trim();

  // Fallback to labels array
  if (Array.isArray(obj.labels) && obj.labels.length) {
    const names = (obj.labels as any[])
      .map((x) => (typeof x === "string" ? x.trim() : null))
      .filter(Boolean) as string[];
    if (names.length) return Array.from(new Set(names)).slice(0, 3).join(", ");
  }

  // Fallback to structured items
  if (Array.isArray(obj.items) && obj.items.length) {
    const names = (obj.items as any[])
      .map((it) => (typeof it?.name === "string" ? it.name.trim() : null))
      .filter(Boolean) as string[];
    if (names.length) return Array.from(new Set(names)).slice(0, 3).join(", ");
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

    if (error) setErr(error.message);
    else if (data) setRows(data as DbEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // live refresh
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
      const { error } = await supabase.from("entries").delete().eq("id", e.id);
      if (error) throw error;

      if (e.image_url && e.image_url.includes("/photos/")) {
        const key = e.image_url.split("/photos/")[1];
        if (key) await supabase.storage.from("photos").remove([key]);
      }

      setRows((old) => old.filter((r) => r.id !== e.id));
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
          const dateTime = new Date(e.created_at).toLocaleString();

          return (
            <li key={e.id} className="flex items-center justify-between gap-3 border rounded-lg p-3">
              <div className="flex items-center gap-3 min-w-0">
                {e.image_url ? (
                  <img src={e.image_url} alt={name} className="w-14 h-14 rounded object-cover border" />
                ) : (
                  <div className="w-14 h-14 rounded bg-gray-200" />
                )}
                <div className="min-w-0">
                  {/* date — name on one line, like your screenshot */}
                  <div className="font-medium truncate">
                    {dateTime} — {pretty(name)}
                  </div>
                  <div className="text-sm text-gray-600">{Math.round(kcal)} kcal</div>
                </div>
              </div>

              <button
                onClick={() => handleDelete(e)}
                className="text-sm px-2 py-1 rounded border hover:bg-gray-50"
                aria-label="Delete entry"
              >
                {pretty(t("delete") || "delete")}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
