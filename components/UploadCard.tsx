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
      // 0) Must be signed in
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in first.');

      // 1) Upload to Storage
      console.log('[UploadCard] step 1: uploading to storage');
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const up = await supabase.storage.from('photos').upload(path, file);
      if (up.error) {
        console.error('[UploadCard] storage upload error', up.error);
        throw new Error(`Storage upload failed: ${up.error.message}`);
      }

      const { data: pub } = supabase.storage.from('photos').getPublicUrl(path);
      const imageUrl = pub.publicUrl;
      console.log('[UploadCard] uploaded. public url:', imageUrl);

      // 2) Analyze with OpenAI via our API
      console.log('[UploadCard] step 2: calling /api/analyze');
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl })
      });
      if (!res.ok) {
        const t = await res.text();
        console.error('[UploadCard] analyze error', t);
        throw new Error(`Analyze failed: ${t}`);
      }
      const { result } = await res.json();
      console.log('[UploadCard] analyze result:', result);

      // 3) Insert into DB FROM THE CLIENT (has JWT → RLS passes)
      console.log('[UploadCard] step 3: inserting into entries');
      const { error: dbErr } = await supabase.from('entries').insert({
        image_url: imageUrl,
        items: result?.items ?? [],
        total_calories: result?.total_calories ?? 0
        // user_id is auto-set by trigger; if you removed the trigger, add: user_id: user.id
      });
      if (dbErr) {
        console.error('[UploadCard] db insert error', dbErr);
        throw new Error(`DB insert failed: ${dbErr.message}`);
      }

      // 4) Go to dashboard
      router.push('/dashboard');
    } catch (e: any) {
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
