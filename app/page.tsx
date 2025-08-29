import AuthGate from '@/components/AuthGate';
import UploadCard from '@/components/UploadCard';
import TotalsBar from '@/components/TotalsBar';
import Link from 'next/link';

export default function Home() {
  return (
    <AuthGate>
      <div className="grid gap-4">
        <TotalsBar />
        <UploadCard />
        <div className="card">
          <p className="text-sm">
            After analysis, see all details on the{' '}
            <Link className="underline" href="/dashboard">Dashboard</Link>.
          </p>
        </div>
      </div>
    </AuthGate>
  );
}
