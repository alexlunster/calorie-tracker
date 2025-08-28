import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Calorie Tracker',
  description: 'Upload a meal photo, estimate calories, track your goals.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <header className="mb-6">
            <h1 className="text-2xl font-bold">Calorie Tracker</h1>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
