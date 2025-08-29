"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

type Translations = Record<string, string>;

const dictionaries: Record<string, Translations> = {
  en: {
    upload_photo: "Upload Photo",
    recent_entries: "Recent Entries",
    totals: "Totals",
    target: "Target",
    progress: "Progress",
    language: "Language",
    signed_in_as: "signed_in_as",
  },
  de: {
    upload_photo: "Foto hochladen",
    recent_entries: "Letzte Einträge",
    totals: "Summen",
    target: "Ziel",
    progress: "Fortschritt",
    language: "Sprache",
    signed_in_as: "angemeldet_als",
  },
  ru: {
    upload_photo: "Загрузить фото",
    recent_entries: "Недавние записи",
    totals: "Итоги",
    target: "Цель",
    progress: "Прогресс",
    language: "Язык",
    signed_in_as: "вы_вошли_как",
  },
};

interface I18nContextType {
  t: (key: string) => string;
  lang: string;
  saveLang: (newLang: string) => Promise<void>;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export default function I18nProvider({
  lang,
  children,
}: {
  lang: string;
  children: React.ReactNode;
}) {
  const [currentLang, setCurrentLang] = useState(lang);
  const dict = dictionaries[currentLang] || dictionaries.en;

  // Translate helper
  const t = (key: string) => dict[key] ?? key;

  // When language changes, reflect it in <html lang="..."> so screen readers/SEO are correct.
  useEffect(() => {
    try {
      document.documentElement.lang = currentLang;
    } catch {}
  }, [currentLang]);

  // Persist choice for logged-in users and update UI immediately
  const saveLang = useCallback(async (newLang: string) => {
    setCurrentLang(newLang);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from("user_prefs")
        .upsert({ user_id: user.id, lang: newLang }, { onConflict: "user_id" });
    }
  }, []);

  return (
    <I18nContext.Provider value={{ t, lang: currentLang, saveLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
