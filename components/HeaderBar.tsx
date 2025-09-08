'use client';
import LanguageSwitcher from './LanguageSwitcher';
import { useI18n } from './I18nProvider';

export default function HeaderBar() {
  const { t } = useI18n();
  return (
    <header className="mb-4 flex items-center justify-between">
      <div className="rounded-2xl bg-white/70 backdrop-blur px-4 py-2 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">{t('app_title')}</h1>
      </div>
      <div className="rounded-full bg-white/70 backdrop-blur px-2 py-1 shadow-sm">
        <LanguageSwitcher />
      </div>
    </header>
  );
}
