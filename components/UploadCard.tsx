"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function UploadCard() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(file: File) {
    try {
      setError(null);
      setLoading(true);

      // 1. Upload to Supabase Storage
      const fileName = `${Date.now()}-${file.name}`;
      const { data: storage, error: storageErr } = await supabase.storage
        .from("photos")
        .upload(fileName, file);

      if (storageErr) throw storageErr;

      const {
        data: { publicUrl },
      } = supabase.storage.from("photos").getPublicUrl(fileName);

      // 2. Insert row into entries
      const { data: entry, error: entryErr } = await supabase
        .from("entries")
        .insert([{ image_url: publicUrl }])
        .select()
        .single();

      if (entryErr) throw entryErr;

      // 3. Call analyze API with entryId + imageUrl
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId: entry.id,
          imageUrl: publicUrl,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Analyze failed");

      alert("✅ Food analyzed and calories saved!");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border rounded p-4 shadow bg-white">
      <h2 className="text-lg font-bold mb-2">Upload Photo</h2>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFile(e.target.files[0]);
        }}
        className="hidden"
        id="cameraInput"
      />
      <div className="flex gap-2">
        <label
          htmlFor="cameraInput"
          className="bg-blue-600 text-white px-4 py-2 rounded cursor-pointer"
        >
          Take Photo
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            if (e.target.files?.[0]) handleFile(e.target.files[0]);
          }}
          className="hidden"
          id="galleryInput"
        />
        <label
          htmlFor="galleryInput"
          className="bg-gray-800 text-white px-4 py-2 rounded cursor-pointer"
        >
          Choose from Gallery
        </label>
      </div>
      {loading && <p className="mt-2 text-sm text-gray-500">Uploading…</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
