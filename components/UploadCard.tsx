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

  const openPicker = () => {
    inputRef.current?.removeAttribute("capture");
    inputRef.current?.click();
  };

  const openCamera = () => {
    inputRef.current?.setAttribute("capture", "environment");
    inputRef.current?.click();
  };

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    setBusy(true);
    setErr(null);

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error(pretty(t("please_sign_in_first") || "please_sign_in_first"));
      const userId = auth.user.id;

      const file = files[0];
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("photos")
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("photos").getPublicUrl(path);
      const imageUrl = pub.publicUrl;

      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });

      if (!r.ok) throw new Error(`Analyze failed: ${await r.text()}`);

      const parsed: AnalyzeResponse = await r.json();
      const meal_name = parsed.meal_name ?? "meal";
      const calories =
        typeof parsed.calories === "number" && !Number.isNaN(parsed.calories)
          ? parsed.calories
          : 0;
      const labels = Array.isArray(parsed.labels) ? parsed.labels : [];

      const { error: insErr } = await supabase.from("entries").insert({
        user_id: userId,
        image_url: imageUrl,
        labels,
        calories,
        meal_name,
      });
      if (insErr) throw insErr;

      // optional: trim storage to last 3 images
      try {
        const { data: list } = await supabase
          .from("entries")
          .select("image_url, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (list && list.length > 3) {
          const older = list.slice(3);
          const keys: string[] = [];
          for (const e of older) {
            const k = e.image_url?.split("/photos/")[1];
            if (k) keys.push(k);
          }
          if (keys.length) await supabase.storage.from("photos").remove(keys);
        }
      } catch {
        /* non-fatal */
      }

      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) {
        inputRef.current.value = "";
        inputRef.current.removeAttribute("capture");
      }
    }
  }

  return (
    <section className="border rounded-xl p-4 shadow-sm bg-white dark:bg-gray-900">
      <h3 className="font-semibold mb-3">{pretty(t("upload_photo") || "Upload Photo")}</h3>

      <div className="flex gap-2">
        <button
          onClick={openCamera}
          className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
          disabled={busy}
        >
          {pretty(t("take_photo") || "take photo")}
        </button>

        <button
          onClick={openPicker}
          className="px-3 py-2 rounded bg-gray-800 text-white disabled:opacity-60"
          disabled={busy}
        >
          {pretty(t("choose_from_gallery") || "choose from gallery")}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {busy && <p className="text-sm text-gray-500 mt-2">{pretty(t("analyzing") || "analyzing")}…</p>}
      {err && <p className="text-sm text-red-600 mt-2">{pretty(err)}</p>}
    </section>
  );
}
