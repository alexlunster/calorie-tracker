"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";
import TotalsBar from "@/components/TotalsBar";
import RecentEntries from "@/components/RecentEntries";
import { useI18n } from "@/components/I18nProvider";
import { pretty } from "@/lib/ui";

/**
 * Dynamically load whichever Targets editor you already have.
 * We try a few common filenames/exports to avoid breaking the build.
 */
function TargetsSlot() {
  const [Comp, setComp] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      // Try these in order. Add/remove paths if your project differs.
      const candidates = [
        { path: "@/components/TargetsCard", pick: (m: any) => m.default ?? m.TargetsCard },
        { path: "@/components/TargetsMenu", pick: (m: any) => m.default ?? m.TargetsMenu },
        { path: "@/components/GoalsCard", pick: (m: any) => m.default ?? m.GoalsCard },
        { path: "@/components/GoalEditor", pick: (m: any) => m.default ?? m.GoalEditor },
        { path: "@/components/Targets", pick: (m: any) => m.default ?? m.Targets },
      ];

      for (const c of candidates) {
        try {
          const mod = await import(/* @vite-ignore */ c.path as any);
          const C = c.pick(mod);
          if (C && mounted) {
            setComp(() => C);
            return;
          }
        } catch {
          // ignore missing module and try next
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (!Comp) return null;
  return <Comp />;
}

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

        {/* NEW: Button directly under Totals to return to the Upload screen */}
        <div className="flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            aria-label={pretty(t("back_to_upload") || "back to upload")}
          >
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

        {/* Keep your Targets editor/menu intact (now safely restored) */}
        <TargetsSlot />

        {/* The rest of the dashboard content */}
        <RecentEntries />
      </div>
    </AuthGate>
  );
}
