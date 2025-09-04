"use client";

import React from "react";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { pretty } from "@/lib/ui";
import { useRouter } from "next/navigation";

type AnalyzeResponse =
  | {
      ok: true;
      entryId: string;
      meal_name: string;
      total_calories: number;
      items: { name: string; calories: number }[];
    }
  | { error: string };

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
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user?.id;
      if (!userId) throw new Error(pretty(t("please_sign_in") || "please_sign_in"));

      const safeName = file.name.replace(/\s+/g, "-").toLowerCase();
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

      const { error: storageErr } = await supabase.storage
        .from("photos")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });
      if (storageErr) throw new Error(`Upload failed: ${storageErr.message}`);

      const { data: pub } = supabase.storage.from("photos").getPublicUrl(fileName);
      const imageUrl = pub.publicUrl;

      const { data: inserted, error: insertErr } = await supabase
        .from("entries")
        .insert({
          user_id: userId,
          image_url: imageUrl,
          total_calories: 0,
          items: [],
        })
        .select("id")
        .single();

      if (insertErr || !inserted) throw new Error(insertErr?.message || "Failed to create entry");

      // Call analyzer
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: inserted.id, imageUrl }),
      });

      const json: AnalyzeResponse = await res.json();
      if (!res.ok || "error" in json) throw new Error(json.error || "Analyze failed");

      // ✅ Success popup
      setSuccess(`${json.meal_name} — ${json.total_calories} kcal`);

      // ✅ Refresh entries so "recent" shows updated meal/calories
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
      <h2 className="text-lg font-semibold mb-3">{pretty(t("upload_photo") || "upload_photo")}</h2>

      <input
        ref={cameraRef}
        id="cameraInput"
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <input
        ref={galleryRef}
        id="galleryInput"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      <div className="flex flex-wrap gap-2">
        <label
          htmlFor="cameraInput"
          className={`cursor-pointer rounded-md px-4 py-2 text-white ${
            sending ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {sending ? pretty(t("uploading") || "uploading") + "…" : pretty(t("take_photo") || "take_photo")}
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
    </div>
  );
}
