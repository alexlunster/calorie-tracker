"use client";
import React, { useMemo } from "react";

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
  const { radius, circ, len } = useMemo(() => {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const g = Math.max(0, Number(goal) || 0);
    const e = Math.max(0, Number(eaten) || 0);
    const rr = g > 0 ? Math.min(1, e / g) : 0;
    const l = Math.max(0, c * rr);
    return { radius: r, circ: c, len: l };
  }, [size, stroke, goal, eaten]);

  // Don't draw the stroke when nothing eaten or goal not set → avoids the “dot”
  const showStroke = len >= 1;

  return (
    <div style={{ width: size, height: size }} className="relative mx-auto">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="block"
        key={`ring-${goal}-${eaten}`} // force update if props change
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5ECF6"
          strokeWidth={stroke}
          fill="none"
        />
        {showStroke && (
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
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center">{center ?? null}</div>
    </div>
  );
}
