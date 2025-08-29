"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { pretty } from "@/lib/ui";

type AnalyzeResponse = {
  meal_name?: string;
  items?: { name: string; calories: number | string }[];
  total_calories?: number | string;
};

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function UploadCard() {
  const { t } = useI18n();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pickFromGallery = () => {
    inputRef.current?.removeAttribute("capture");
    inputRef.current?.click();
  };

  const takePhoto = () => {
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

      // Upload image to the public "photos" bucket
      const file = files[0];
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const key = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: upErr } = await supabase
        .storage
        .from("photos")
        .upload(key, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("photos").getPublicUrl(key);
      const imageUrl = pub.publicUrl;

      // Call analyzer
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      if (!res.ok) throw new Error(`Analyze failed: ${await res.text()}`);

      const parsed: AnalyzeResponse = await res.json();

      // Normalize values for your schema
      const itemsArray = Array.isArray(parsed.items) ? parsed.items : [];
      const normalizedItems = itemsArray.map((it) => ({
        name: (it?.name ?? "item") as string,
        calories: num(it?.calories),
      }));

      const total =
        num(parsed.total_calories) ||
        normalizedItems.reduce((s, it) => s + num(it.calories), 0);

      // Insert only columns that exist in your DB
      const { error: insErr } = await supabase.from("entries").insert({
        user_id: userId,
        image_url: imageUrl,
        items: { name: parsed.meal_name ?? null, items: normalizedItems }, // jsonb
        calories: total,          // numeric
        total_calories: total,    // int4 NOT NULL
      });
      if (insErr) throw insErr;

      // Best-effort: keep only latest 3 images per user
      try {
        const { data: list } = await supabase
          .from("entries")
          .select("image_url, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (list && list.length > 3) {
          const extra = list.slice(3);
          const keys = extra
            .map((e: any) => (typeof e.image_url === "string" ? e.image_url.split("/photos/")[1] : null))
            .filter(Boolean) as string[];
          if (keys.length) await supabase.storage.from("photos").remove(keys);
        }
      } catch {
        // ignore cleanup errors
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
      <h3 className="font-semibold mb-3">
        {pretty(t("upload_photo") || "Upload Photo")}
      </h3>

      <div className="flex gap-2">
        <button
          onClick={takePhoto}
          className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
          disabled={busy}
        >
          {pretty(t("take_photo") || "take photo")}
        </button>

        <button
          onClick={pickFromGallery}
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
