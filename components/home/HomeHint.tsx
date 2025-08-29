'use client';
import Link from 'next/link';
import { useI18n } from '@/components/I18nProvider';

export default function HomeHint() {
  const { t } = useI18n();
  return (
    <div className="card">
      <p className="text-sm">
        {t('after_analysis')} <Link className="underline" href="/dashboard">{t('dashboard')}</Link>.
      </p>
    </div>
  );
}
