"use client";

import React, { createContext, useContext } from "react";

type Translations = Record<string, string>;

const dictionaries: Record<string, Translations> = {
  en: {
    uploadPhoto: "Upload Photo",
    recentEntries: "Recent Entries",
    totalCalories: "Total Calories",
    target: "Target",
    progress: "Progress",
  },
  de: {
    uploadPhoto: "Foto hochladen",
    recentEntries: "Letzte Einträge",
    totalCalories: "Gesamtkalorien",
    target: "Ziel",
    progress: "Fortschritt",
  },
  ru: {
    uploadPhoto: "Загрузить фото",
    recentEntries: "Недавние записи",
    totalCalories: "Всего калорий",
    target: "Цель",
    progress: "Прогресс",
  },
};

interface I18nContextType {
  t: (key: string) => string;
  lang: string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export default function I18nProvider({
  lang,
  children,
}: {
  lang: string;
  children: React.ReactNode;
}) {
  const dict = dictionaries[lang] || dictionaries.en;

  const t = (key: string) => dict[key] || key;

  return (
    <I18nContext.Provider value={{ t, lang }}>
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
