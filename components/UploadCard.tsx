"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { pretty } from "@/lib/ui";

type ModelItem = { name: string; calories: number | string };
type AnalyzeResponse = {
  meal_name?: string;
  items?: ModelItem[];
  total_calories?: number | string;
};

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function UploadCard() {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // toast
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  useEffect(() => {
    if (!showToast) return;
    const id = setTimeout(() => setShowToast(false), 3000);
    return () => clearTimeout(id);
  }, [showToast]);

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

      // 1) upload
      const file = files[0];
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const key = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("photos")
        .upload(key, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("photos").getPublicUrl(key);
      const imageUrl = pub.publicUrl;

      // 2) analyze
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      if (!res.ok) throw new Error(`Analyze failed: ${await res.text()}`);
      const parsed: AnalyzeResponse = await res.json();

      const mealName = (parsed.meal_name || "meal").toString();
      const itemsArray = Array.isArray(parsed.items) ? parsed.items : [];
      const normalizedItems = itemsArray.map((it) => ({
        name: (it?.name ?? "item") as string,
        calories: toNum(it?.calories),
      }));
      const total =
        toNum(parsed.total_calories) ||
        normalizedItems.reduce((s, it) => s + toNum(it.calories), 0);

      // Build a robust items JSON that older & newer UIs can read
      const uniqueNames = Array.from(
        new Set([mealName, ...normalizedItems.map((i) => i.name)].filter(Boolean))
      ).slice(0, 5);

      // 3) insert
      const { error: insErr } = await supabase.from("entries").insert({
        user_id: userId,
        image_url: imageUrl,
        items: {
          name: mealName,           // preferred field
          items: normalizedItems,   // structured items
          labels: uniqueNames,      // fallback for older renders
        },
        calories: total,
        total_calories: total,
      });
      if (insErr) throw insErr;

      // 4) light cleanup (keep only 3 latest images per user)
      try {
        const { data: list } = await supabase
          .from("entries")
          .select("image_url, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (list && list.length > 3) {
          const extras = list.slice(3);
          const keys = extras
            .map((e: any) => (typeof e.image_url === "string" ? e.image_url.split("/photos/")[1] : null))
            .filter(Boolean) as string[];
          if (keys.length) await supabase.storage.from("photos").remove(keys);
        }
      } catch {
        /* ignore */
      }

      // 5) broadcast + toast
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("entry:created", { detail: { userId } }));
      }
      setToastMsg(`Saved ${Math.round(total)} kcal for "${mealName}"`);
      setShowToast(true);
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
    <section className="relative border rounded-xl p-4 shadow-sm bg-white dark:bg-gray-900">
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

      {showToast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-4 z-50 rounded-lg bg-green-600 text-white px-4 py-2 shadow-lg">
          <div className="flex items-center gap-3">
            <span>✅</span>
            <span className="text-sm">{toastMsg}</span>
            <button
              className="ml-2 text-white/90 hover:text-white"
              onClick={() => setShowToast(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
