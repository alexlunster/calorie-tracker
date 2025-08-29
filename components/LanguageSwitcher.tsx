'use client';
import { useI18n } from './I18nProvider';

export default function LanguageSwitcher() {
  const { lang, saveLang } = useI18n();

  return (
    <div className="flex items-center gap-2">
      <select
        className="input"
        value={lang}
        onChange={(e) => saveLang(e.target.value as any)}
        aria-label="Language"
      >
        <option value="en">English</option>
        <option value="de">Deutsch</option>
        <option value="ru">Русский</option>
      </select>
    </div>
  );
}
