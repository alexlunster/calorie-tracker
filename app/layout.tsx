import './globals.css';
import type { Metadata } from 'next';
import I18nProvider from '@/components/I18nProvider';
import HeaderBar from '@/components/HeaderBar';

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
            <HeaderBar />
            {children}
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
