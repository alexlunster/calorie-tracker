"use client";

import { useI18n } from "@/components/I18nProvider";

export default function LanguageSwitcher() {
  const { lang, saveLang } = useI18n();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    saveLang(e.target.value);
  };

  return (
    <select
      value={lang}
      onChange={handleChange}
      className="border rounded p-1 text-sm bg-white dark:bg-gray-800"
    >
      <option value="en">🇬🇧 English</option>
      <option value="de">🇩🇪 Deutsch</option>
      <option value="ru">🇷🇺 Русский</option>
    </select>
  );
}
