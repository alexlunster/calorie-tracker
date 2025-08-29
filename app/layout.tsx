import './globals.css';
import type { Metadata } from 'next';
import I18nProvider from '@/components/I18nProvider';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export const metadata: Metadata = {
  title: 'Calorie Tracker',
  description: 'Upload a meal photo, estimate calories, track your goals.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <I18nProvider>
          <div className="container">
            <header className="mb-6 flex items-center justify-between">
              <h1 className="text-2xl font-bold">Calorie Tracker</h1>
              <LanguageSwitcher />
            </header>
            {children}
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
