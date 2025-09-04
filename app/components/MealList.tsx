"use client";
import React from "react";

export type Meal = {
  id: string;
  title: string;
  subtitle?: string;
  kcal: number;
};

export default function MealList({ meals, onRemove }: { meals: Meal[]; onRemove?: (id: string)=>void }) {
  return (
    <div className="space-y-3">
      {meals.map((m) => (
        <div key={m.id} className="flex items-center justify-between rounded-2xl bg-white/80 backdrop-blur shadow-sm px-4 py-3">
          <div>
            <div className="text-slate-900 font-medium">{m.title}</div>
            {m.subtitle ? <div className="text-slate-500 text-sm">{m.subtitle}</div> : null}
          </div>
          <div className="text-slate-800 font-semibold">{m.kcal} kcal</div>
        </div>
      ))}
    </div>
  );
}
