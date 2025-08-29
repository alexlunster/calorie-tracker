'use client';
import { useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { differenceInDays } from './utils/dateDiff'; // add tiny helper below or inline

export default function UploadCard() {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setPreview(URL.createObjectURL(f)); }
  }

  // ---- helpers ----
  function pathFromPublicUrl(publicUrl: string): string | null {
    // expects .../storage/v1/object/public/photos/<path>
    const ix = publicUrl.indexOf('/storage/v1/object/public/photos/');
    if (ix === -1) return null;
    return publicUrl.slice(ix + '/storage/v1/object/public/photos/'.length);
  }

  async function deleteImagesByPaths(paths: string[]) {
    if (!paths.length) return;
    await supabase.storage.from('photos').remove(paths);
  }

  async function cleanupOldEntriesAndImages(userId: string) {
    const now = new Date();

    // 1) Delete DB entries older than 45 days (and attempt to remove their images)
    const { data: oldEntries } = await supabase
      .from('entries')
      .select('id, image_url, created_at')
      .eq('user_id', userId)
      .lt('created_at', new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString())
      .limit(500);

    if (oldEntries && oldEntries.length) {
      // remove their images (best-effort)
      const paths = oldEntries
        .map((e: any) => pathFromPublicUrl(e.image_url))
        .filter(Boolean) as string[];
      if (paths.length) {
        try { await deleteImagesByPaths(paths); } catch {}

      }
      // delete entries
      await supabase.from('entries')
        .delete()
        .in('id', oldEntries.map((e: any) => e.id));
    }

    // 2) Keep only newest 3 images for this user
    // List all files in user folder
    const listRes = await supabase.storage.from('photos').list(userId, {
      limit: 1000, // adjust if you expect more
      sortBy: { column: 'name', order: 'desc' } // we'll sort by time client-side anyway
    });

    const files = (listRes.data || []).map((f: any) => ({
      name: f.name,
      created_at: f.created_at ? new Date(f.created_at) : null
    }));

    // sort newest first by created_at (fallback to name)
    files.sort((a: any, b: any) => {
      const ta = a.created_at ? a.created_at.getTime() : 0;
      const tb = b.created_at ? b.created_at.getTime() : 0;
      if (tb !== ta) return tb - ta;
      return (b.name || '').localeCompare(a.name || '');
    });

    const toDelete = files.slice(3).map(f => `${userId}/${f.name}`);
    if (toDelete.length) {
      await deleteImagesByPaths(toDelete);
    }
  }
  // -----------------

  async function submit() {
    if (!file) return;
    setLoading(true); setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in first.');

      // 1) Upload to Storage (user folder)
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const up = await supabase.storage.from('photos').upload(path, file);
      if (up.error) throw new Error(`Storage upload failed: ${up.error.message}`);

      const { data: pub } = supabase.storage.from('photos').getPublicUrl(path);
      const imageUrl = pub.publicUrl;

      // 2) Analyze via API (OpenAI)
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl })
      });
      if (!res.ok) throw new Error(`Analyze failed: ${await res.text()}`);
      const { result } = await res.json();

      // 3) Insert into DB (client-side, JWT present)
      const { error: dbErr } = await supabase.from('entries').insert({
        image_url: imageUrl,
        items: result?.meal_name ? { meal_name: result.meal_name, items: result.items } : (result?.items ?? []),
        total_calories: result?.total_calories ?? 0
      });
      if (dbErr) throw new Error(`DB insert failed: ${dbErr.message}`);

      // 4) Cleanup storage/DB (best-effort, fire-and-forget)
      cleanupOldEntriesAndImages(user.id).catch(() => {});

      router.push('/dashboard');
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
      setFile(null);
      setPreview(null);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="card space-y-3">
      <div className="label">Add a meal photo</div>

      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={onPick} className="hidden" />
      <input ref={fileInputRef} type="file" accept="image/*" onChange={onPick} className="hidden" />

      <div className="grid grid-cols-2 gap-2">
        <button className="btn w-full" onClick={() => cameraInputRef.current?.click()}>Take Photo</button>
        <button className="btn w-full" onClick={() => fileInputRef.current?.click()}>Choose from Device</button>
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

/* ---- components/utils/dateDiff.ts (new tiny helper) ----
export function differenceInDays(a: Date, b: Date) {
  const ONE = 24*60*60*1000;
  return Math.floor((a.getTime() - b.getTime()) / ONE);
}
*/
