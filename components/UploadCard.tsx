"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { pretty } from "@/lib/ui";

type AnalyzeResponse = {
  meal_name?: string;
  calories?: number;
  labels?: string[];
};

export default function UploadCard() {
  const { t } = useI18n();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // open file picker (gallery)
  const openPicker = () => inputRef.current?.click();

  // camera capture for mobile
  const openCamera = () => {
    inputRef.current?.setAttribute("capture", "environment");
    inputRef.current?.click();
    // reset after click so next time gallery works too
    setTimeout(() => inputRef.current?.removeAttribute("capture"), 1000);
  };

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setErr(null);

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        throw new Error(pretty(t("please_sign_in_first") || "please_sign_in_first"));
      }
      const userId = auth.user.id;

      const file = files[0];
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      // Upload to Supabase Storage (bucket 'photos')
      const { data: up, error: upErr } = await supabase.storage.from("photos").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (upErr) throw upErr;

      // Public (or signed) URL
      const { data: publicUrl } = supabase.storage.from("photos").getPublicUrl(path);
      const imageUrl = publicUrl.publicUrl;

      // Call analyze API
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Analyze failed: ${txt}`);
      }

      const parsed: AnalyzeResponse = await res.json();

      const meal_name = parsed.meal_name || "meal";
      const calories = typeof parsed.calories === "number" ? parsed.calories : 0;
      const labels = parsed.labels || [];

      // Save entry
      const { error: insErr } = await supabase.from("entries").insert({
        user_id: userId,
        image_url: imageUrl,
        labels,
        calories,
        meal_name,
      });
      if (insErr) throw insErr;

      // Keep only 3 photos (storage control) – server-side job also enforces this, but we trim on client too.
      try {
        const { data: list, error: listErr } = await supabase
          .from("entries")
          .select("id, image_url, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (!listErr && list && list.length > 3) {
          const older = list.slice(3);
          // remove only from storage; keep DB cleanup for the scheduled job
          for (const e of older) {
            const key = e.image_url.split("/photos/")[1];
            if (key) await supabase.storage.from("photos").remove([key]);
          }
        }
      } catch {
        // non-fatal
      }

      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="border rounded-xl p-4 shadow-sm bg-white dark:bg-gray-900">
      <h3 className="font-semibold mb-2">{pretty(t("upload_photo"))}</h3>

      <div className="flex gap-2">
        <button
          onClick={openCamera}
          className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
          disabled={busy}
        >
          {pretty(t("take_photo") || "take_photo")}
        </button>
        <button
          onClick={openPicker}
          className="px-3 py-2 rounded bg-gray-800 text-white disabled:opacity-60"
          disabled={busy}
        >
          {pretty(t("choose_from_gallery") || "choose_from_gallery")}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {busy && <p className="text-sm text-gray-500 mt-2">{pretty(t("analyzing"))}…</p>}
      {err && <p className="text-sm text-red-600 mt-2">{pretty(err)}</p>}
    </div>
  );
}
