import AuthGate from "@/components/AuthGate";
import TotalsBar from "@/components/TotalsBar";
import UploadCard from "@/components/UploadCard";
import { pretty } from "@/lib/ui";
import { useI18n } from "@/components/I18nProvider";

export default function Home() {
  // This page is a Server Component; content rendered inside AuthGate (Client)
  return (
    <AuthGate>
      <div className="grid gap-6">
        {/* Totals */}
        <TotalsBar />

        {/* Upload */}
        <UploadCard />

        {/* Link to Dashboard */}
        <a href="/dashboard" className="text-blue-600 hover:underline text-sm">
          Go to dashboard
        </a>
      </div>
    </AuthGate>
  );
}
