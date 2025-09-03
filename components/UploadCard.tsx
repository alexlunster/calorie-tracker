"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { pretty } from "@/lib/ui";

type AnalyzeResponse = {
  meal_name: string | null;
  items: { name: string; calories: number }[];
  total_calories: number | null;
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // ~8MB cap after compression
const MAX_DIM = 1600; // max width/height for downscaling

export default function UploadCard() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function toast(message: string) {
    setMsg(pretty(message));
    setTimeout(() => setMsg(null), 4000);
  }

  async function pick(fromCamera: boolean) {
    if (!fileRef.current) return;
    fileRef.current.accept = "image/*";
    if (fromCamera) fileRef.current.setAttribute("capture", "environment");
    else fileRef.current.removeAttribute("capture");
    fileRef.current.click();
  }

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!file) return;

    try {
      setBusy(true);
      setMsg(null);

      const safeBlob = await makeSafeBlob(file);
      if (safeBlob.size > MAX_UPLOAD_BYTES) {
        toast(t("image_too_large") || "image_too_large");
        return;
      }

      // 1) Upload to Storage
      const folder = crypto.randomUUID();
      const name = `${Date.now()}-${crypto.randomUUID()}.jpg`;
      const path = `${folder}/${name}`;

      const { error: upErr } = await supabase.storage
        .from("photos")
        .upload(path, safeBlob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw upErr;

      const {
        data: { publicUrl },
      } = supabase.storage.from("photos").getPublicUrl(path);

      // 2) Call analyzer (we pass publicUrl; the API will download and base64 it)
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: publicUrl }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `${t("analyze_failed") || "analyze_failed"}: ${text}`.slice(0, 400)
        );
      }

      const payload: AnalyzeResponse = await res.json();

      // 3) Insert entry
      const { error: insErr } = await supabase.from("entries").insert({
        image_url: publicUrl,
        items: payload.items ?? [],
        meal_name: payload.meal_name ?? null,
        total_calories:
          typeof payload.total_calories === "number"
            ? Math.round(payload.total_calories)
            : null,
      });
      if (insErr) throw insErr;

      toast(t("upload_success") || "upload_success");
      // refresh totals & recent list
      if (typeof window !== "undefined") window.location.reload();
    } catch (err: any) {
      const raw = String(err?.message || err);
      if (
        /low memory|not enough memory|insufficient memory/i.test(raw) ||
        /Unable to complete previous operation due to low memory/i.test(raw)
      ) {
        toast(
          t("low_memory_hint") ||
            "low_memory_hint"
        );
      } else if (/Timeout while downloading/i.test(raw)) {
        toast(
          t("analyze_timeout_hint") ||
            "analyze_timeout_hint"
        );
      } else {
        toast(raw);
      }
    } finally {
      setBusy(false);
    }
  }

  // ---- image helpers ----

  async function makeSafeBlob(file: File): Promise<Blob> {
    if (!file.type.startsWith("image/")) return file;
    try {
      const img = await loadImage(file);
      const { width, height } = scaleToMax(img.width, img.height, MAX_DIM);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) throw new Error("canvas context failed");

      ctx.drawImage(img, 0, 0, width, height);

      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          b => (b ? resolve(b) : reject(new Error("blob conversion failed"))),
          "image/jpeg",
          0.8
        );
      });

      if (blob.size < file.size) return blob;
      if (file.size > MAX_UPLOAD_BYTES) return blob; // still enforce cap
      return file;
    } catch {
      return file; // fall back safely
    }
  }

  function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = e => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      img.src = url;
    });
  }

  function scaleToMax(w: number, h: number, max: number) {
    if (w <= max && h <= max) return { width: w, height: h };
    const r = w > h ? max / w : max / h;
    return { width: Math.round(w * r), height: Math.round(h * r) };
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <h2 className="text-lg font-semibold">
        {pretty(t("upload_photo") || "upload_photo")}
      </h2>

      <div className="flex gap-3 flex-wrap">
        <button
          type="button"
          className="rounded bg-blue-600 text-white px-4 py-2 disabled:opacity-50"
          onClick={() => pick(true)}
          disabled={busy}
        >
          {pretty(t("take_photo") || "take_photo")}
        </button>
        <button
          type="button"
          className="rounded bg-gray-900 text-white px-4 py-2 disabled:opacity-50"
          onClick={() => pick(false)}
          disabled={busy}
        >
          {pretty(t("choose_from_gallery") || "choose_from_gallery")}
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onChange}
        />
      </div>

      {busy && (
        <p className="text-sm text-gray-500">
          {pretty(t("processing") || "processing")}…
        </p>
      )}
      {msg && (
        <div className="mt-2 rounded bg-gray-100 px-3 py-2 text-sm text-gray-800">
          {msg}
        </div>
      )}
    </div>
  );
}
