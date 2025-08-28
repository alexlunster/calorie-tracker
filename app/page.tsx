import AuthGate from '@/components/AuthGate';
import UploadCard from '@/components/UploadCard';
import Link from 'next/link';

export default function Home() {
  return (
    <AuthGate>
      <div className="grid gap-4">
        <UploadCard onDone={() => location.assign('/dashboard')} />
        <div className="card">
          <p className="text-sm">After analysis, see your totals on the <Link className="underline" href="/dashboard">Dashboard</Link>.</p>
        </div>
      </div>
    </AuthGate>
  );
}
