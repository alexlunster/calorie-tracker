"use client";
import React from "react";

type Segment = { label: string; value: number; color: string };
type Props = {
  size?: number;              // px
  stroke?: number;            // px
  goal: number;               // kcal
  eaten: number;              // kcal
  segments: Segment[];        // sum <= eaten
  center?: React.ReactNode;   // custom center content
};

// Pure SVG circular progress with multiple colored segments for eaten macros.
export default function CircleRing({
  size = 220,
  stroke = 18,
  goal,
  eaten,
  segments,
  center,
}: Props) {
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;

  const clampedEaten = Math.max(0, Math.min(eaten, goal));
  const eatenRatio = goal > 0 ? clampedEaten / goal : 0; // 0..1
  const gap = 2; // stroke-dash gap between segments

  // Compute dash arrays for each segment relative to goal
  let offset = 0;
  const segs = segments.map((s) => {
    const frac = clampedEaten > 0 ? (s.value / clampedEaten) * eatenRatio : 0;
    const len = Math.max(0, (circ) * frac - gap);
    const data = { ...s, len, offset };
    offset += Math.max(0, (circ) * frac);
    return data;
  });

  const remaining = Math.max(0, goal - eaten);
  const remainingLabel = remaining > 0 ? `${remaining.toLocaleString()} ` : "0 ";

  return (
    <div style={{ width: size, height: size }} className="relative mx-auto">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
        {/* Track ring */}
        <circle
          cx={size/2}
          cy={size/2}
          r={radius}
          stroke="#F1F5F9"
          strokeWidth={stroke}
          fill="none"
        />
        {/* Eaten segments */}
        {segs.map((s, i) => (
          <circle
            key={i}
            cx={size/2}
            cy={size/2}
            r={radius}
            transform={`rotate(-90 ${size/2} ${size/2})`}
            stroke={s.color}
            strokeLinecap="round"
            strokeWidth={stroke}
            strokeDasharray={`${s.len} ${circ}`}
            strokeDashoffset={circ - s.offset}
            fill="none"
          />
        ))}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 grid place-items-center">
        {center ?? (
          <div className="text-center">
            <div className="text-4xl font-extrabold text-slate-900 leading-tight">
              {remainingLabel}<span className="text-lg align-baseline">kcal</span>
            </div>
            <div className="text-sm text-slate-600 -mt-1">Remaining</div>
          </div>
        )}
      </div>
    </div>
  );
}
