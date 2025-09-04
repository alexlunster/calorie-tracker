"use client";
import React from "react";
import Link from "next/link";

function ChevronLeftIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...props}>
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PlusIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...props}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Header({
  title,
  backHref,
  addHref,
}: { title: string; backHref?: string; addHref?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="w-10 h-10 flex items-center justify-start">
        {backHref ? (
          <Link href={backHref} className="rounded-full p-2 bg-white/60 backdrop-blur shadow-sm active:scale-95 transition">
            <ChevronLeftIcon className="text-slate-800" />
          </Link>
        ) : null}
      </div>

      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>

      <div className="w-10 h-10 flex items-center justify-end">
        {addHref ? (
          <Link href={addHref} className="rounded-full p-2 bg-white/60 backdrop-blur shadow-sm active:scale-95 transition">
            <PlusIcon className="text-slate-800" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
