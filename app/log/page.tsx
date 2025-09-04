"use client";
import React, { useState } from "react";
import GradientShell from "@/components/ui/GradientShell";
import Header from "@/components/ui/Header";
import MealList, { Meal } from "@/components/MealList";

export default function LogPage() {
  const [query, setQuery] = useState("");
  const [results] = useState<Meal[]>([
    { id: "b1",  title: "Banana",          subtitle: "Medium",  kcal: 105 },
    { id: "a1",  title: "Apple",           subtitle: "Medium",  kcal: 95  },
    { id: "ch1", title: "Chicken Breast",  subtitle: "100 g",   kcal: 165 },
  ]);
  const [today, setToday] = useState<Meal[]>([]);

  const add = (m: Meal) => setToday((arr) => [...arr, m]);
  const remove = (id: string) => setToday((arr) => arr.filter((x) => x.id !== id));

  return (
    <GradientShell>
      <Header title="Log Food" backHref="/" />
      <div className="mt-4 rounded-3xl bg-white/70 backdrop-blur shadow-lg p-4 space-y-4">
        <div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search foods…"
            className="w-full rounded-xl px-4 py-3 bg-white shadow-sm outline-none focus:ring-2 ring-slate-300"
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm text-slate-600">Quick picks</div>
          <div className="grid grid-cols-3 gap-3">
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => add(r)}
                className="rounded-2xl bg-white hover:bg-white/90 active:scale-95 transition shadow-sm px-3 py-3 text-left"
              >
                <div className="text-slate-900 font-medium">{r.title}</div>
                <div className="text-slate-500 text-xs">{r.subtitle}</div>
                <div className="text-slate-800 text-sm font-semibold mt-1">{r.kcal} kcal</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Today's additions</h2>
        {today.length === 0 ? (
          <div className="rounded-2xl bg-white/60 p-4 text-slate-600 text-sm shadow-sm">
            No items yet. Search above or pick a quick item.
          </div>
        ) : (
          <MealList meals={today} onRemove={(id)=>remove(id)} />
        )}
      </div>

      <div className="h-16" />
      <div className="fixed inset-x-0 bottom-0">
        <div className="mx-auto max-w-md px-4 pb-[calc(env(safe-area-inset-bottom,0)+10px)]">
          <button
            className="w-full h-12 rounded-2xl bg-slate-900 text-white font-semibold shadow-lg active:scale-98 transition"
            onClick={()=>alert("Saved (wire this to your API)")}
          >
            Save to diary
          </button>
        </div>
      </div>
    </GradientShell>
  );
}
