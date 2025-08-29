"use client";

import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/components/I18nProvider";

export default function LanguageSwitcher() {
  const { lang, saveLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    await saveLang(e.target.value);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      {/* Globe icon button */}
      <button
        aria-label="Change language"
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-full shadow-md bg-white dark:bg-gray-800 hover:shadow-lg transition"
        title="Language"
      >
        {/* Simple globe icon (SVG) */}
        <svg width="20" height="20" viewBox="0 0 24 24" className="fill-current">
          <path d="M12 2a10 10 0 100 20 10 10 0 000-20Zm7.94 9h-3.14a15.91 15.91 0 00-1.2-5.02A8.03 8.03 0 0119.94 11ZM12 4c.98 0 2.38 1.9 3.03 5H8.97C9.62 5.9 11.02 4 12 4ZM6.4 6.98A15.9 15.9 0 005.2 11H2.06a8.03 8.03 0 014.34-4.02ZM4.06 13H5.2c.24 1.72.74 3.42 1.2 5.02A8.03 8.03 0 014.06 13ZM12 20c-.98 0-2.38-1.9-3.03-5h6.06C14.38 18.1 12.98 20 12 20Zm5.6-1.98A15.91 15.91 0 0018.8 13h3.14a8.03 8.03 0 01-4.34 5.02Z" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute bottom-12 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2">
          <select
            value={lang}
            onChange={handleChange}
            className="border rounded p-1 text-sm bg-white dark:bg-gray-800"
          >
            <option value="en">🇬🇧 English</option>
            <option value="de">🇩🇪 Deutsch</option>
            <option value="ru">🇷🇺 Русский</option>
          </select>
        </div>
      )}
    </div>
  );
}
