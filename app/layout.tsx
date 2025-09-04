import "./globals.css";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import I18nProvider, { Lang } from "@/components/I18nProvider";

export const metadata: Metadata = {
  title: "Calorie Tracker",
  description: "Track calories from food photos",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }
    ]
  },
  viewport: { width: "device-width", initialScale: 1, viewportFit: "cover" },
  themeColor: "#ffffff",
};

function normalizeLang(raw?: string): Lang {
  if (raw === "de" || raw === "ru" || raw === "en") return raw;
  return "en";
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const lang = normalizeLang(cookieStore.get("lang")?.value);
  return (
    <html lang={lang}>
      <body className="min-h-dvh antialiased">
        <I18nProvider lang={lang}>
          <div className="min-h-dvh w-full bg-gradient-to-br from-[#FFE3C1] via-[#FFD6C7] to-[#FEE1F1]">
            <main className="mx-auto max-w-md px-4 pt-[calc(env(safe-area-inset-top,0)+12px)] pb-[calc(env(safe-area-inset-bottom,0)+16px)]">
              {children}
            </main>
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
