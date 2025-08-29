import './globals.css';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import I18nProvider from '@/components/I18nProvider';

export const metadata: Metadata = {
  title: 'Calorie Tracker',
  description: 'Upload a meal photo, estimate calories, and track your goals.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {}
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {}
        },
      },
    }
  );

  let lang = 'en';
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data } = await supabase
        .from('user_prefs')
        .select('lang')
        .eq('user_id', session.user.id)
        .single();
      if (data?.lang && ['en', 'de', 'ru'].includes(data.lang)) {
        lang = data.lang;
      }
    }
  } catch {}

  return (
    <html lang={lang}>
      <head>
        {/* PWA + splash links ... */}
      </head>
      <body>
        <I18nProvider lang={lang}>   {/* 👈 wrap children */}
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
