"use client";
import React from "react";
import Link from "next/link";
import { ChevronLeft, Plus } from "lucide-react";

type Props = {
  title: string;
  backHref?: string;
  addHref?: string;
};

export default function Header({ title, backHref, addHref }: Props) {
  return (
    <div className="flex items-center justify-between">
      <div className="w-10 h-10 flex items-center justify-start">
        {backHref ? (
          <Link href={backHref} className="rounded-full p-2 bg-white/60 backdrop-blur shadow-sm active:scale-95 transition">
            <ChevronLeft className="w-5 h-5 text-slate-800" />
          </Link>
        ) : null}
      </div>

      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>

      <div className="w-10 h-10 flex items-center justify-end">
        {addHref ? (
          <Link href={addHref} className="rounded-full p-2 bg-white/60 backdrop-blur shadow-sm active:scale-95 transition">
            <Plus className="w-5 h-5 text-slate-800" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
