"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { pretty } from "@/lib/ui";

type AnalyzeResponse =
  | {
      ok: true;
      entryId: string;
      meal_name: string;
      total_calories: number;
      items: { name: string; calories: number }[];
    }
  | { error: string };

type EntryRow = {
  id: string;
  user_id: string;
  image_url: string | null;
  meal_name: string | null;
  total_calories: number | null;
  created_at: string;
  items?: { name: string; calories: number }[] | null;
};

export default function UploadCard() {
  const { t } = useI18n();
  const router = useRouter();

  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const cameraRef = React.useRef<HTMLInputElement | null>(null);
  const galleryRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!success) return;
    const id = setTimeout(() => setSuccess(null), 3500);
    return () => clearTimeout(id);
  }, [success]);

  async function handleFile(file: File) {
    setError(null);
    setSuccess(null);
    if (!file) return;

    setSending(true);
    try {
      // 1) Must be signed in
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user?.id;
      if (!userId) throw new Error(pretty(t("please_sign_in") || "please_sign_in"));

      // 2) Upload image to Storage (photos)
      const safeName = file.name.replace(/\s+/g, "-").toLowerCase();
      const fileName = `${userId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}-${safeName}`;

      const { error: storageErr } = await supabase.storage
        .from("photos")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });
      if (storageErr) throw new Error(`Upload failed: ${storageErr.message}`);

      const { data: pub } = supabase.storage.from("photos").getPublicUrl(fileName);
      const imageUrl = pub.publicUrl;

      // 3) Insert entry (RLS-safe: pass user_id)
      const { data: inserted, error: insertErr } = await supabase
        .from("entries")
        .insert({
          user_id: userId,
          image_url: imageUrl,
          total_calories: 0, // analyzer will update
          items: [], // analyzer will update
          // meal_name will be set by analyzer
        })
        .select("id")
        .single();

      if (insertErr || !inserted) {
        if (insertErr?.message?.toLowerCase().includes("row-level security")) {
          throw new Error(
            "Insert blocked by RLS. Check entries policies and ensure user_id = auth.uid() is present."
          );
        }
        throw new Error(insertErr?.message || "Failed to create entry");
      }

      // 4) Analyze (OpenAI) — server updates the row
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: inserted.id, imageUrl }),
      });
      const json: AnalyzeResponse = await res.json();
      if (!res.ok || "error" in json) throw new Error(json.error || "Analyze failed");

      // 5) Fetch back the updated row (for instant UI update)
      const { data: updated, error: fetchErr } = await supabase
        .from("entries")
        .select("id,user_id,image_url,meal_name,total_calories,created_at,items")
        .eq("id", inserted.id)
        .single();

      if (fetchErr || !updated) {
        // Fall back to success text only; router.refresh will still show updated list soon
        setSuccess(`${json.meal_name} — ${json.total_calories} kcal`);
        router.refresh();
        return;
      }

      // 6) Success toast
      setSuccess(
        `${updated.meal_name ?? json.meal_name} — ${updated.total_calories ?? json.total_calories} kcal`
      );

      // 7) 🔔 Broadcast to any listener (Recent Entries / Totals) for immediate UI update
      if (typeof window !== "undefined") {
        const entry: EntryRow = updated as EntryRow;

        // CustomEvent for general listeners
        window.dispatchEvent(
          new CustomEvent<EntryRow>("entry:created", { detail: entry })
        );

        // Optional ad-hoc callback (if any component sets it)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__onNewEntry?.(entry);

        // Bonus: stash last entry in sessionStorage (in case a listener wants to read it)
        try {
          sessionStorage.setItem("last_entry", JSON.stringify(entry));
        } catch {
          /* ignore storage failures */
        }
      }

      // 8) Still refresh as a safety net (ensures SWR/server components re-fetch)
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Upload failed");
    } finally {
      setSending(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  return (
    <div className="border rounded-lg p-4 shadow-sm bg-white">
      <h2 className="text-lg font-semibold mb-3">
        {pretty(t("upload_photo") || "upload_photo")}
      </h2>

      {/* hidden inputs */}
      <input
        ref={cameraRef}
        id="cameraInput"
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <input
        ref={galleryRef}
        id="galleryInput"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      <div className="flex flex-wrap gap-2">
        <label
          htmlFor="cameraInput"
          className={`cursor-pointer rounded-md px-4 py-2 text-white ${
            sending ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {sending
            ? pretty(t("uploading") || "uploading") + "…"
            : pretty(t("take_photo") || "take_photo")}
        </label>

        <label
          htmlFor="galleryInput"
          className={`cursor-pointer rounded-md px-4 py-2 text-white ${
            sending ? "bg-gray-500" : "bg-gray-800 hover:bg-black"
          }`}
        >
          {pretty(t("choose_from_gallery") || "choose_from_gallery")}
        </label>
      </div>

      {success && (
        <div className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {success}
        </div>
      )}
      {error && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <p className="mt-3 text-xs text-gray-500">
        {pretty(t("analysis_takes_a_moment") || "analysis_takes_a_moment")}
      </p>
    </div>
  );
}
