"use client";

import Link from "next/link";
import AuthGate from "@/components/AuthGate";
import TotalsBar from "@/components/TotalsBar";
import RecentEntries from "@/components/RecentEntries";
import { useI18n } from "@/components/I18nProvider";
import { pretty } from "@/lib/ui";

export default function DashboardPage() {
  const { t } = useI18n();

  return (
    <AuthGate>
      <div className="grid gap-4">
        {/* Page title */}
        <h1 className="text-xl font-semibold">
          {pretty(t("dashboard") || "dashboard")}
        </h1>

        {/* Totals box */}
        <TotalsBar />

        {/* NEW: Button under Totals to go back to Upload screen */}
        <div className="flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            aria-label={pretty(t("back_to_upload") || "back to upload")}
          >
            {/* simple icon */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {pretty(t("back_to_upload") || "back_to_upload")}
          </Link>
        </div>

        {/* The rest of the dashboard content is automatically pushed lower */}
        <RecentEntries />
      </div>
    </AuthGate>
  );
}
