"use client";

import React from "react";
import { useI18n } from "@/components/I18nProvider";
import type { Lang } from "@/components/I18nProvider";

function isLang(v: string): v is Lang {
  return v === "en" || v === "ru" || v === "de";
}

export default function LanguageSwitcher() {
  const { lang, saveLang, t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState<Lang>(lang);

  React.useEffect(() => {
    setValue(lang);
  }, [lang]);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    const next = isLang(v) ? v : "en"; // narrow safely
    setValue(next);
    await saveLang(next);
    setOpen(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle button (hidden -> icon) */}
      <button
        aria-label={t("language")}
        onClick={() => setOpen((o) => !o)}
        className="rounded-full border bg-white/90 backdrop-blur px-3 py-2 shadow hover:bg-white"
      >
        🌐
      </button>

      {/* Popover */}
      {open && (
        <div className="mt-2 w-48 rounded-lg border bg-white p-3 shadow">
          <label htmlFor="lang" className="block text-sm mb-1">
            {t("language")}
          </label>
          <select
            id="lang"
            value={value}
            onChange={handleChange}
            className="w-full rounded border px-2 py-1"
          >
            <option value="en">{t("english")}</option>
            <option value="de">{t("german")}</option>
            <option value="ru">{t("russian")}</option>
          </select>
        </div>
      )}
    </div>
  );
}
