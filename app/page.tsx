import AuthGate from '@/components/AuthGate';
import UploadCard from '@/components/UploadCard';
import TotalsBar from '@/components/TotalsBar';
import HomeHint from '@/components/home/HomeHint';

export default function Home() {
  return (
    <AuthGate>
      <div className="grid gap-4">
        <TotalsBar />
        <UploadCard />
        <HomeHint />
      </div>
    </AuthGate>
  );
}
