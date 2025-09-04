"use client";
import React from "react";

export default function GradientShell({
  children,
  className = "",
}: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className="min-h-dvh w-full bg-gradient-to-br from-[#FFE3C1] via-[#FFD6C7] to-[#FEE1F1]"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <div className={`mx-auto max-w-md px-4 pt-[calc(env(safe-area-inset-top,0)+12px)] pb-[calc(env(safe-area-inset-bottom,0)+16px)] ${className}`}>
        {children}
      </div>
    </div>
  );
}
