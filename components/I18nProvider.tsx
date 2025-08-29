'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Lang = 'en' | 'de' | 'ru';
type Dict = Record<string, string>;
type Dicts = Record<Lang, Dict>;

const DICTS: Dicts = {
  en: {
    app_title: 'Calorie Tracker',
    signed_in_as: 'Signed in as',
    sign_out: 'Sign out',
    sign_in: 'Sign in',
    email: 'Email',
    send_magic: 'Send Magic Link',
    magic_sent: 'Magic link sent. Check your email.',
    totals: 'Totals',
    today: 'Today',
    this_week: 'This Week',
    this_month: 'This Month',
    goals: 'Goals',
    daily_target: 'Daily target',
    weekly_target: 'Weekly target',
    monthly_target: 'Monthly target',
    save: 'Save',
    add_meal_photo: 'Add a meal photo',
    take_photo: 'Take Photo',
    choose_device: 'Choose from Device',
    analyzing: 'Analyzing…',
    upload_analyze: 'Upload & Analyze',
    tip_gallery: 'Tip: Take a new photo or pick one from your gallery.',
    recent_entries: 'Recent entries',
    delete: 'Delete',
    after_analysis: 'After analysis, see all details on the',
    dashboard: 'Dashboard',
    please_sign_in: 'Please sign in first.',
    storage_upload_failed: 'Storage upload failed',
  },
  de: {
    app_title: 'Kalorienzähler',
    signed_in_as: 'Angemeldet als',
    sign_out: 'Abmelden',
    sign_in: 'Anmelden',
    email: 'E-Mail',
    send_magic: 'Magischen Link senden',
    magic_sent: 'Magischer Link gesendet. Prüfe deine E-Mails.',
    totals: 'Summen',
    today: 'Heute',
    this_week: 'Diese Woche',
    this_month: 'Diesen Monat',
    goals: 'Ziele',
    daily_target: 'Tagesziel',
    weekly_target: 'Wochenziel',
    monthly_target: 'Monatsziel',
    save: 'Speichern',
    add_meal_photo: 'Mahlzeitenfoto hinzufügen',
    take_photo: 'Foto aufnehmen',
    choose_device: 'Vom Gerät wählen',
    analyzing: 'Analysiere…',
    upload_analyze: 'Hochladen & Analysieren',
    tip_gallery: 'Tipp: Neues Foto aufnehmen oder aus der Galerie wählen.',
    recent_entries: 'Letzte Einträge',
    delete: 'Löschen',
    after_analysis: 'Nach der Analyse alle Details im',
    dashboard: 'Dashboard',
    please_sign_in: 'Bitte zuerst anmelden.',
    storage_upload_failed: 'Upload fehlgeschlagen',
  },
  ru: {
    app_title: 'Счётчик калорий',
    signed_in_as: 'Вы вошли как',
    sign_out: 'Выйти',
    sign_in: 'Войти',
    email: 'E-mail',
    send_magic: 'Отправить магическую ссылку',
    magic_sent: 'Ссылка отправлена. Проверьте почту.',
    totals: 'Итого',
    today: 'Сегодня',
    this_week: 'Эта неделя',
    this_month: 'Этот месяц',
    goals: 'Цели',
    daily_target: 'Дневная цель',
    weekly_target: 'Недельная цель',
    monthly_target: 'Месячная цель',
    save: 'Сохранить',
    add_meal_photo: 'Добавить фото еды',
    take_photo: 'Сделать фото',
    choose_device: 'Выбрать из галереи',
    analyzing: 'Анализ…',
    upload_analyze: 'Загрузить и проанализировать',
    tip_gallery: 'Подсказка: сделать фото или выбрать из галереи.',
    recent_entries: 'Недавние записи',
    delete: 'Удалить',
    after_analysis: 'После анализа см. детали на',
    dashboard: 'Панели',
    please_sign_in: 'Сначала войдите.',
    storage_upload_failed: 'Ошибка загрузки',
  },
};

type I18nCtx = {
  lang: Lang;
  t: (k: keyof Dict) => string;
  setLang: (lang: Lang) => void;
  saveLang: (lang: Lang) => Promise<void>;
};

const Ctx = createContext<I18nCtx | null>(null);
export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n must be used inside <I18nProvider>');
  return v;
}

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLangState('en'); return; } // default for guests
      const { data } = await supabase.from('user_prefs').select('lang').eq('user_id', user.id).single();
      if (data?.lang && ['en','de','ru'].includes(data.lang)) setLangState(data.lang as Lang);
    })();
  }, []);

  function setLang(l: Lang) { setLangState(l); }

  async function saveLang(l: Lang) {
    setLangState(l);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // guests: do not persist
    await supabase.from('user_prefs').upsert({ user_id: user.id, lang: l, updated_at: new Date().toISOString() });
  }

  const t = useMemo(() => (k: keyof Dict) => DICTS[lang][k] ?? k, [lang]);

  return (
    <Ctx.Provider value={{ lang, t, setLang, saveLang }}>
      {children}
    </Ctx.Provider>
  );
}
