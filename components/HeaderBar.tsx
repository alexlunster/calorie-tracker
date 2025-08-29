'use client';
import LanguageSwitcher from './LanguageSwitcher';
import { useI18n } from './I18nProvider';

export default function HeaderBar() {
  const { t } = useI18n();
  return (
    <header className="mb-6 flex items-center justify-between">
      <h1 className="text-2xl font-bold">{t('app_title')}</h1>
      <LanguageSwitcher />
    </header>
  );
}
