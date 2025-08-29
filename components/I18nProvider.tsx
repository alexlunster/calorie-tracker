"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

type Translations = Record<string, string>;

const dictionaries: Record<string, Translations> = {
  en: {
    uploadPhoto: "Upload Photo",
    recentEntries: "Recent Entries",
    totalCalories: "Total Calories",
    target: "Target",
    progress: "Progress",
    language: "Language",
  },
  de: {
    uploadPhoto: "Foto hochladen",
    recentEntries: "Letzte Einträge",
    totalCalories: "Gesamtkalorien",
    target: "Ziel",
    progress: "Fortschritt",
    language: "Sprache",
  },
  ru: {
    uploadPhoto: "Загрузить фото",
    recentEntries: "Недавние записи",
    totalCalories: "Всего калорий",
    target: "Цель",
    progress: "Прогресс",
    language: "Язык",
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

  const t = (key: string) => dict[key] || key;

  const saveLang = useCallback(async (newLang: string) => {
    setCurrentLang(newLang);

    // persist to supabase if user is logged in
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
  if (!ctx) {
    throw new Error("useI18n must be used inside <I18nProvider>");
  }
  return ctx;
}
