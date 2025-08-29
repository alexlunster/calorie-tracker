'use client';
import { useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useI18n } from '@/components/I18nProvider';

export default function UploadCard() {
  const { t } = useI18n();
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

  async function submit() {
    if (!file) return;
    setLoading(true); setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('please_sign_in'));

      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const up = await supabase.storage.from('photos').upload(path, file);
      if (up.error) throw new Error(`${t('storage_upload_failed')}: ${up.error.message}`);

      const { data: pub } = supabase.storage.from('photos').getPublicUrl(path);
      const imageUrl = pub.publicUrl;

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl })
      });
      if (!res.ok) throw new Error(await res.text());
      const { result } = await res.json();

      const { error: dbErr } = await supabase.from('entries').insert({
        image_url: imageUrl,
        items: result?.meal_name ? { meal_name: result.meal_name, items: result.items } : (result?.items ?? []),
        total_calories: result?.total_calories ?? 0
      });
      if (dbErr) throw dbErr;

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
      <div className="label">{t('add_meal_photo')}</div>

      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={onPick} className="hidden" />
      <input ref={fileInputRef} type="file" accept="image/*" onChange={onPick} className="hidden" />

      <div className="grid grid-cols-2 gap-2">
        <button className="btn w-full" onClick={() => cameraInputRef.current?.click()}>
          {t('take_photo')}
        </button>
        <button className="btn w-full" onClick={() => fileInputRef.current?.click()}>
          {t('choose_device')}
        </button>
      </div>

      {preview && (
        <div className="relative w-full h-64">
          <Image src={preview} alt="preview" fill className="object-contain rounded-xl" />
        </div>
      )}

      <button disabled={!file || loading} onClick={submit} className="btn btn-primary w-full">
        {loading ? t('analyzing') : t('upload_analyze')}
      </button>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {!error && !file && <p className="text-xs text-gray-500">{t('tip_gallery')}</p>}
    </div>
  );
}
