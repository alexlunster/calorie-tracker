"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// ---- Types ----
export type Lang = "en" | "ru" | "de";
type Dict = Record<string, string>;
type Bundle = Record<Lang, Dict>;

export type I18nContextType = {
  lang: Lang;
  t: (key: keyof Dict | string, params?: Record<string, string | number>) => string;
  setLang: (lang: Lang) => void;         // UI-only + cookie
  saveLang: (lang: Lang) => Promise<void>; // persist to DB + cookie + UI
};

// ---- Translations (inline) ----
const translations: Bundle = {
  en: {
    loading: "loading",
    welcome: "welcome",
    your_email: "your_email",
    sending: "sending",
    sign_in: "sign_in",
    sign_out: "sign_out",
    signed_in_as: "signed_in_as",
    please_enter_email: "please_enter_email",
    check_email_login: "check_your_email_for_a_login_link",

    totals: "Totals",
    today: "today",
    this_week: "this_week",
    this_month: "this_month",
    of_kcal: "of {n} kcal",

    upload_photo: "Upload Photo",
    take_photo: "Take Photo",
    choose_from_gallery: "Choose from Gallery",
    upload_and_analyze: "Upload & Analyze",
    processing: "Processing",
    upload_success: "Upload successful!",
    analyze_failed: "Analysis failed",
    image_too_large: "Image is too large after compression. Try a smaller photo.",
    low_memory_hint:
      "Your device ran out of memory processing the photo. Close other apps or try a smaller photo.",
    analyze_timeout_hint:
      "The photo was uploaded but analysis timed out. Please try again.",
    go_to_dashboard: "Go to dashboard",
    back_to_upload: "back to upload",

    dashboard: "dashboard",
    targets: "targets",
    daily: "daily",
    weekly: "weekly",
    monthly: "monthly",
    save: "save",

    recent_entries: "Recent Entries",
    delete: "delete",
    kcal: "kcal",

    language: "Language",
    english: "English",
    german: "German",
    russian: "Russian",
  },

  ru: {
    loading: "загрузка",
    welcome: "добро пожаловать",
    your_email: "ваш_email",
    sending: "отправка",
    sign_in: "войти",
    sign_out: "выйти",
    signed_in_as: "вы вошли как",
    please_enter_email: "введите_email",
    check_email_login: "проверьте почту для ссылки входа",

    totals: "Итого",
    today: "сегодня",
    this_week: "эта неделя",
    this_month: "этот месяц",
    of_kcal: "из {n} ккал",

    upload_photo: "Загрузить фото",
    take_photo: "Сделать фото",
    choose_from_gallery: "Выбрать из галереи",
    upload_and_analyze: "Загрузить и распознать",
    processing: "Обработка",
    upload_success: "Загрузка завершена!",
    analyze_failed: "Ошибка анализа",
    image_too_large: "Изображение слишком большое. Попробуйте меньшего размера.",
    low_memory_hint:
      "На устройстве не хватает памяти. Закройте другие приложения или используйте фото меньшего размера.",
    analyze_timeout_hint:
      "Фото загружено, но анализ истёк по времени. Повторите попытку.",
    go_to_dashboard: "Перейти на дашборд",
    back_to_upload: "назад к загрузке",

    dashboard: "дашборд",
    targets: "цели",
    daily: "день",
    weekly: "неделя",
    monthly: "месяц",
    save: "сохранить",

    recent_entries: "Последние записи",
    delete: "удалить",
    kcal: "ккал",

    language: "Язык",
    english: "Английский",
    german: "Немецкий",
    russian: "Русский",
  },

  de: {
    loading: "lädt",
    welcome: "willkommen",
    your_email: "deine_email",
    sending: "senden",
    sign_in: "anmelden",
    sign_out: "abmelden",
    signed_in_as: "angemeldet als",
    please_enter_email: "bitte_email_eingeben",
    check_email_login: "prüfe deine E-Mails für den Login-Link",

    totals: "Gesamt",
    today: "heute",
    this_week: "diese Woche",
    this_month: "dieser Monat",
    of_kcal: "von {n} kcal",

    upload_photo: "Foto hochladen",
    take_photo: "Foto aufnehmen",
    choose_from_gallery: "Aus Galerie wählen",
    upload_and_analyze: "Hochladen & Analysieren",
    processing: "Wird verarbeitet",
    upload_success: "Upload erfolgreich!",
    analyze_failed: "Analyse fehlgeschlagen",
    image_too_large:
      "Bild ist nach der Kompression zu groß. Bitte kleineres Foto versuchen.",
    low_memory_hint:
      "Zu wenig Speicher auf dem Gerät. Schließe andere Apps oder versuche ein kleineres Foto.",
    analyze_timeout_hint:
      "Foto hochgeladen, aber Analyse hat ein Timeout. Bitte erneut versuchen.",
    go_to_dashboard: "Zum Dashboard",
    back_to_upload: "zurück zum Upload",

    dashboard: "dashboard",
    targets: "ziele",
    daily: "täglich",
    weekly: "wöchentlich",
    monthly: "monatlich",
    save: "speichern",

    recent_entries: "Neueste Einträge",
    delete: "löschen",
    kcal: "kcal",

    language: "Sprache",
    english: "Englisch",
    german: "Deutsch",
    russian: "Russisch",
  },
};

// ---- Small helpers (no replaceAll) ----
function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(
    new RegExp("(^|; )" + encodeURIComponent(name) + "=([^;]*)")
  );
  return m ? decodeURIComponent(m[2]) : undefined;
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === "undefined") return;
  const exp = new Date();
  exp.setTime(exp.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(
    value
  )}; expires=${exp.toUTCString()}; path=/; SameSite=Lax`;
}

function replaceAllSafe(s: string, needle: string, replacement: string) {
  // Works in older runtimes without String.prototype.replaceAll
  return s.split(needle).join(replacement);
}

function format(template: string, params?: Record<string, string | number>) {
  if (!params) return template;
  return Object.entries(params).reduce(
    (acc, [k, v]) => replaceAllSafe(acc, `{${k}}`, String(v)),
    template
  );
}

// ---- Context ----
const I18nContext = createContext<I18nContextType | null>(null);

export default function I18nProvider({
  children,
  lang: initialLang = "en",
}: {
  children: React.ReactNode;
  lang?: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  // On mount: cookie → DB → initial prop
  useEffect(() => {
    let alive = true;

    async function init() {
      // 1) cookie
      const cookieLang = getCookie("lang") as Lang | undefined;
      if (cookieLang && ["en", "ru", "de"].includes(cookieLang)) {
        if (alive) setLangState(cookieLang);
        return;
      }

      // 2) DB (if logged in)
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("user_prefs")
          .select("lang")
          .eq("user_id", user.id)
          .maybeSingle();
        const dbLang = (data?.lang as Lang | undefined) || initialLang || "en";
        setCookie("lang", dbLang, 365);
        if (alive) setLangState(dbLang);
      }
    }

    init();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Translator for current lang
  const t = useMemo(() => {
    const dict = translations[lang] || translations.en;
    return (key: string, params?: Record<string, string | number>) => {
      const base = dict[key] ?? translations.en[key] ?? key;
      return format(base, params);
    };
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    setCookie("lang", l, 365);
  };

  const saveLang = async (l: Lang) => {
    setLang(l);
    // persist to DB for logged-in users
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return; // not logged in, cookie is enough
    await supabase.from("user_prefs").upsert(
      {
        user_id: user.id,
        lang: l,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  };

  const value: I18nContextType = { lang, t, setLang, saveLang };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
