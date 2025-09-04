"use client";
import React from "react";

type Item = { label: string; grams: number; color: string };
export default function MacroLegend({ items }: { items: Item[] }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((m) => (
        <div key={m.label} className="rounded-2xl bg-white/70 backdrop-blur shadow-sm px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
            <span className="text-sm font-medium text-slate-800">{m.label}</span>
          </div>
          <div className="text-slate-500 text-xs mt-0.5">{m.grams} g</div>
        </div>
      ))}
    </div>
  );
}
