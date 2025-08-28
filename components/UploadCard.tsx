'use client';
import { useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';

export default function UploadCard({ onDone }: { onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setPreview(URL.createObjectURL(f)); }
  }

  async function submit() {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      // Ensure logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in first.');

      // Upload to Supabase Storage
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('photos').upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      const { data: publicUrl } = supabase.storage.from('photos').getPublicUrl(path);
      const imageUrl = publicUrl.publicUrl;

      // Analyze via API route
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl })
      });
      if (!res.ok) throw new Error(await res.text());
      await res.json();

      onDone();
    } catch (e:any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false); setFile(null); setPreview(null);
    }
  }

  return (
    <div className="card space-y-3">
      <div>
        <label className="label">Take/Upload a photo</label>
        <input className="input" type="file" accept="image/*" capture="environment" onChange={onPick} />
      </div>
      {preview && (
        <div className="relative w-full h-64">
          <Image src={preview} alt="preview" fill className="object-contain rounded-xl" />
        </div>
      )}
      <button disabled={!file || loading} onClick={submit} className="btn btn-primary w-full">
        {loading ? 'Analyzing…' : 'Upload & Analyze'}
      </button>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}
