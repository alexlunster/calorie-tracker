"use client";
import React from "react";
import GradientShell from "@/components/ui/GradientShell";
import Header from "@/components/ui/Header";
import CircleRing from "@/components/ui/CircleRing";
import MacroLegend from "@/components/ui/MacroLegend";
import MealList, { Meal } from "@/components/MealList";

export default function Page() {
  // TODO: replace with real data/store
  const goalKcal = 2200;
  const eatenKcal = 1250;
  const macros = { carbs: 150, protein: 90, fat: 35 };
  const meals: Meal[] = [
    { id: "1", title: "Breakfast", subtitle: "Oatmeal", kcal: 350 },
    { id: "2", title: "Lunch", subtitle: "Grilled Chicken", kcal: 600 },
    { id: "3", title: "Snack", subtitle: "Greek Yogurt", kcal: 150 },
  ];

  const segments = [
    { label: "Carbs",   value: Math.round(eatenKcal * 0.55), color: "#F9736B" },
    { label: "Protein", value: Math.round(eatenKcal * 0.30), color: "#10B981" },
    { label: "Fat",     value: Math.round(eatenKcal * 0.15), color: "#F59E0B" },
  ];

  return (
    <GradientShell>
      <Header title="Calories" addHref="/log" />
      <div className="mt-4 rounded-3xl bg-white/70 backdrop-blur shadow-lg p-4">
        <div className="flex items-center justify-between text-slate-800 text-sm px-2">
          <div className="text-center">
            <div className="text-2xl font-bold">{eatenKcal.toLocaleString()}</div>
            <div className="text-slate-500 -mt-1">Eaten</div>
          </div>

          <CircleRing goal={goalKcal} eaten={eatenKcal} segments={segments} />

          <div className="text-center">
            <div className="text-2xl font-bold">{goalKcal.toLocaleString()}</div>
            <div className="text-slate-500 -mt-1">Goal</div>
          </div>
        </div>

        <div className="mt-4">
          <MacroLegend
            items={[
              { label: "Carbs",   grams: macros.carbs,   color: "#F9736B" },
              { label: "Protein", grams: macros.protein, color: "#10B981" },
              { label: "Fat",     grams: macros.fat,     color: "#F59E0B" },
            ]}
          />
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Foods</h2>
        <MealList meals={meals} />
      </div>
    </GradientShell>
  );
}
