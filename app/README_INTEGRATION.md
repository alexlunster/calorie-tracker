# Calorie Tracker UI Kit — Drop-in Integration

This kit includes two mobile‑first screens and reusable UI components to match the approved design (warm gradient, circular calorie ring, color‑coded macros, no "burned" row).

## What’s inside
- `app/page.tsx` — **Main screen (Calories)** with ring, Eaten/Goal, Macro legend, and Foods list.
- `app/log/page.tsx` — **Log Food** screen styled consistently with the main screen.
- `components/ui/CircleRing.tsx` — Pure SVG circular progress ring with **macro segments**.
- `components/ui/MacroLegend.tsx` — Color legend for Carbs / Protein / Fat.
- `components/ui/Header.tsx` — Mobile header with title + optional back/add buttons.
- `components/ui/GradientShell.tsx` — Padded container with the warm gradient + safe area.
- `components/MealList.tsx` — Simple meal list (example data, replace with your data).

## Assumptions
- Next.js (App Router) + TailwindCSS.
- TypeScript project.
- Optional: `lucide-react` for icons. If you don’t have it, run:
  ```bash
  npm i lucide-react
  ```

## Install / Copy
1. Copy the folders **`app`** and **`components`** from this kit into your repo (merge with existing ones).
2. If your main route isn’t `/` or your log route isn’t `/log`, either:
   - Move `app/page.tsx` to your actual route (e.g. `app/(app)/page.tsx`), or
   - Copy the **contents** of these pages into your existing pages.
3. Ensure Tailwind is configured and `globals.css` is imported in `app/layout.tsx`.
4. ✅ No additional CSS files are required; everything is Tailwind utility classes.

## Design tokens (keep consistent across screens)
- Background gradient: `from-[#FFE3C1] via-[#FFD6C7] to-[#FEE1F1]` (top-right to bottom-left).
- Macro colors:
  - **Carbs** — `#F9736B` (coral)
  - **Protein** — `#10B981` (emerald)
  - **Fat** — `#F59E0B` (amber)
- Headings: semi-bold, large; body: medium; compact spacing with `px-4` and `py-3` blocks.
- Cards: rounded-2xl, soft shadows for contrast on gradient.
- Tap targets: 44px min height.

## Hooking up real data
Replace the `mock` objects in `app/page.tsx` and `app/log/page.tsx` with your state/store or API:
- `goalKcal`: number, daily goal
- `eatenKcal`: number, kcal eaten today
- `macros`: grams per macro { carbs, protein, fat }
- `meals`: array of { id, title, subtitle, kcal }

The ring uses `segments` that sum to `eatenKcal` (or less). Anything above goal is handled visually by capping to goal so the ring never overflows.
