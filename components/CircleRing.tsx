"use client";
import React from "react";

export default function CircleRing({
  size = 220,
  stroke = 18,
  goal,
  eaten,
  color = "#10B981", // emerald
  center,
}: {
  size?: number;
  stroke?: number;
  goal: number;
  eaten: number;
  color?: string;
  center?: React.ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;

  const clamped = Math.max(0, Math.min(eaten, goal));
  const ratio = goal > 0 ? clamped / goal : 0;
  const len = Math.max(0, circ * ratio);

  return (
    <div style={{ width: size, height: size }} className="relative mx-auto">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#E5ECF6" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          stroke={color}
          strokeLinecap="round"
          strokeWidth={stroke}
          strokeDasharray={`${len} ${circ}`}
          strokeDashoffset={0}
          fill="none"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{center ?? null}</div>
    </div>
  );
}
