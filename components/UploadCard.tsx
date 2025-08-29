"use client";

import { useRef, useState } from "react";
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

  /** Open system gallery/file picker */
  const openPicker = () => {
    if (!inputRef.current) return;
    // ensure no capture attribute for gallery
    inputRef.current.removeAttribute("capture");
    inputRef.current.click();
  };

  /** Open camera (mainly mobile) */
  const openCamera = () => {
    if (!inputRef.current) return;
    inputRef.current.setAttribute("capture", "environment");
    inputRef.current.click();
  };

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    setBusy(true);
    setErr(null);

    try {
      // 1) auth
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error(pretty(t("please_sign_in_first") || "please_sign_in_first"));
      const userId = auth.user.id;

      // 2) upload to Storage (bucket: photos)
      const file = files[0];
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("photos")
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (upErr) throw upErr;

      // public URL (or use signed URL if your bucket is private)
      const { data: pub } = supabase.storage.from("photos").getPublicUrl(path);
      const imageUrl = pub.publicUrl;

      // 3) call analyzer
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });

      if (!r.ok) {
        const msg = await r.text();
        throw new Error(`Analyze failed: ${msg}`);
      }

      const parsed: AnalyzeResponse = await r.json();
      const meal_name = parsed.meal_name ?? "meal";
      const calories =
        typeof parsed.calories === "number" && !Number.isNaN(parsed.calories)
          ? parsed.calories
          : 0;
      const labels = Array.isArray(parsed.labels) ? parsed.labels : [];

      // 4) insert entry
      const { error: insErr } = await supabase.from("entries").insert({
        user_id: userId, // required by RLS
        image_url: imageUrl,
        labels,
        calories,
        meal_name,
      });
      if (insErr) throw insErr;

      // 5) trim storage (keep newest 3 images)
      try {
        const { data: list, error: listErr } = await supabase
          .from("entries")
          .select("id,image_url,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (!listErr && list && list.length > 3) {
          const older = list.slice(3);
          const keysToRemove: string[] = [];
          for (const e of older) {
            const key = e.image_url?.split("/photos/")[1];
            if (key) keysToRemove.push(key);
          }
          if (keysToRemove.length) {
            // Best-effort; DB cleanup can be handled by scheduled job too
            await supabase.storage.from("photos").remove(keysToRemove);
          }
        }
      } catch {
        /* non-fatal cleanup */
      }

      // 6) refresh UI
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) {
        // reset input so picking the same file again triggers change
        inputRef.current.value = "";
        inputRef.current.removeAttribute("capture");
      }
    }
  }

  return (
    <div className="border rounded-xl p-4 shadow-sm bg-white dark:bg-gray-900">
      <h3 className="font-semibold mb-3">{pretty(t("upload_photo") || "upload_photo")}</h3>

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

        {/* hidden input used by both buttons */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {busy && (
        <p className="text-sm text-gray-500 mt-2">
          {pretty(t("analyzing") || "analyzing")}…
        </p>
      )}
      {err && <p className="text-sm text-red-600 mt-2">{pretty(err)}</p>}
    </div>
  );
}
