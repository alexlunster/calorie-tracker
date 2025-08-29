import "./globals.css";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import I18nProvider from "@/components/I18nProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export const metadata: Metadata = {
  title: "Calorie Tracker",
  description: "Track calories easily with photo uploads and goals",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Build Supabase SSR client with proper cookie methods
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            /* noop on read-only contexts */
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            /* noop on read-only contexts */
          }
        },
      },
    }
  );

  // Default language
  let lang = "en";
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: prefs } = await supabase
        .from("user_prefs")
        .select("lang")
        .eq("user_id", user.id)
        .maybeSingle();
      if (prefs?.lang) lang = prefs.lang;
    }
  } catch {
    // keep 'en'
  }

  return (
    <html lang={lang}>
      <head>
        {/* PWA manifest + icons */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#ffffff" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Calorie Tracker" />
        {/* point to your 192 icon in /public/icons */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>
        <I18nProvider lang={lang}>
          <main>{children}</main>

          {/* Floating Language Switcher */}
          <div className="fixed bottom-4 right-4 z-50 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-2">
            <LanguageSwitcher />
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
