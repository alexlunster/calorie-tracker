'use client';
import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function UploadCard() {
  const router = useRouter();
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
      // Ensure user is logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in first.');

      // 1) Upload to Storage under <userId>/...
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const up = await supabase.storage.from('photos').upload(path, file);
      if (up.error) throw up.error;

      const { data: pub } = supabase.storage.from('photos').getPublicUrl(path);
      const imageUrl = pub.publicUrl;

      // 2) Ask our API to analyze the image (OpenAI)
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl })
      });
      if (!res.ok) throw new Error(await res.text());
      const { result } = await res.json(); // { items, total_calories }

      // 3) Insert into DB FROM THE CLIENT (has user JWT) → RLS passes
      const { error: dbErr } = await supabase.from('entries').insert({
        image_url: imageUrl,
        items: result?.items ?? [],
        total_calories: result?.total_calories ?? 0
        // user_id is auto-set by trigger if you created it; if not, add user_id: user.id
      });
      if (dbErr) throw dbErr;

      // Done → go to dashboard
      router.push('/dashboard');
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
      setFile(null);
      setPreview(null);
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
