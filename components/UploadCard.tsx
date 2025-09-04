"use client";

import React from "react";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { pretty } from "@/lib/ui";

type AnalyzeResponse = {
  ok: true;
  entryId: string;
  meal_name: string;
  total_calories: number;
  items: { name: string; calories: number }[];
} | {
  error: string;
};

export default function UploadCard() {
  const { t } = useI18n();
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  // hidden inputs for camera / gallery
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
      // 1) Ensure we have a logged-in user
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user?.id;
      if (!userId) {
        throw new Error(pretty(t("please_sign_in") || "please_sign_in"));
      }

      // 2) Upload to Supabase Storage (photos bucket)
      const safeName = file.name.replace(/\s+/g, "-").toLowerCase();
      const fileName = `${userId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}-${safeName}`;

      const { error: storageErr } = await supabase.storage
        .from("photos")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });

      if (storageErr) {
        throw new Error(`Upload failed: ${storageErr.message}`);
      }

      const { data: pub } = supabase.storage.from("photos").getPublicUrl(fileName);
      const imageUrl = pub.publicUrl;

      // 3) Insert entry row (pass user_id explicitly for RLS)
      const { data: inserted, error: insertErr } = await supabase
        .from("entries")
        .insert({
          user_id: userId,                 // 👈 critical for RLS
          image_url: imageUrl,
          meal_time: new Date().toISOString(),
          total_calories: 0,
          items: [],
          // meal_name can be null initially; analyzer will update
        })
        .select("id")
        .single();

      if (insertErr || !inserted) {
        // Helpful hint if RLS blocks
        if (insertErr?.message?.toLowerCase().includes("row-level security")) {
          throw new Error(
            "Insert blocked by RLS. Ensure entries policies allow insert with user_id = auth.uid() and that user_id default/trigger is set (or you pass user_id explicitly)."
          );
        }
        throw new Error(insertErr?.message || "Failed to create entry");
      }

      // 4) Analyze via server route (OpenAI call + DB update)
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: inserted.id, imageUrl }),
      });

      const json: AnalyzeResponse = await res.json();
      if (!res.ok || "error" in json) {
        throw new Error(("error" in json && json.error) || "Analyze failed");
      }

      // 5) Success message
      setSuccess(
        `${pretty(t("saved") || "saved")}: ${json.meal_name} — ${json.total_calories} kcal`
      );

      // 6) Optional: refresh data on the page (if you rely on SWR/React cache you can revalidate here)
      try {
        // If you use Next.js revalidateTag or router refresh, plug it here.
        // e.g., router.refresh();
      } catch {
        /* no-op */
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Upload failed");
    } finally {
      setSending(false);
      // reset inputs so the same file can be selected again
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  return (
    <div className="border rounded-lg p-4 shadow-sm bg-white">
      <h2 className="text-lg font-semibold mb-3">{pretty(t("upload_photo") || "upload_photo")}</h2>

      {/* hidden file inputs */}
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

      {/* messages */}
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

      {/* tiny hint */}
      <p className="mt-3 text-xs text-gray-500">
        {pretty(t("analysis_takes_a_moment") || "analysis_takes_a_moment")}
      </p>
    </div>
  );
}
