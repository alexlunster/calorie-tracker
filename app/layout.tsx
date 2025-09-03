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
  themeColor: "#ffffff",
};

function normalizeLang(input?: string): Lang {
  const v = (input || "").toLowerCase();
  if (v === "en" || v === "ru" || v === "de") return v as Lang;
  return "en";
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read cookie on the server, normalize to Lang union
  const cookieStore = cookies();
  const cookieLang = cookieStore.get("lang")?.value;
  const lang = normalizeLang(cookieLang);

  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        {/* PWA / iOS */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ffffff" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Calorie Tracker" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {/* Favicon fallback */}
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        {/* Provide the normalized Lang to the client provider */}
        <I18nProvider lang={lang}>
          <main>{children}</main>
        </I18nProvider>
      </body>
    </html>
  );
}
