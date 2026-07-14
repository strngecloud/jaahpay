"use client";

import { useMemo, useState } from "react";
import { formatUsd } from "./ui";

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  volume: number;
  count: number;
}

const W = 720;
const H = 200;
const PAD = { top: 12, right: 8, bottom: 24, left: 48 };

function niceMax(v: number): number {
  if (v <= 0) return 10;
  const mag = 10 ** Math.floor(Math.log10(v));
  const norm = v / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

/** Daily swap volume — single-series bar chart with hover tooltip. */
export function VolumeChart({ data }: { data: DailyPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const { bars, gridLines, maxV } = useMemo(() => {
    const maxV = niceMax(Math.max(...data.map((d) => d.volume), 0));
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const slot = innerW / Math.max(data.length, 1);
    const barW = Math.max(slot - 2, 2); // 2px surface gap between bars

    const bars = data.map((d, i) => {
      const h = maxV > 0 ? (d.volume / maxV) * innerH : 0;
      return {
        x: PAD.left + i * slot + (slot - barW) / 2,
        y: PAD.top + innerH - h,
        w: barW,
        h,
        slotX: PAD.left + i * slot,
        slotW: slot,
      };
    });

    const gridLines = [0, 0.5, 1].map((f) => ({
      y: PAD.top + innerH - f * innerH,
      label: formatUsd(f * maxV, 0),
    }));

    return { bars, gridLines, maxV };
  }, [data]);

  const hovered = hover !== null ? data[hover] : null;
  const total = data.reduce((s, d) => s + d.volume, 0);

  if (total === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-white/40">
        No completed swap volume in the last {data.length} days.
      </div>
    );
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Daily swap volume over the last ${data.length} days, peaking at $${formatUsd(maxV, 0)}`}
        onMouseLeave={() => setHover(null)}
      >
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={g.y}
              y2={g.y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 8}
              y={g.y + 3}
              textAnchor="end"
              className="fill-white/35 font-mono"
              fontSize="10"
            >
              {g.label}
            </text>
          </g>
        ))}

        {bars.map((b, i) => (
          <g key={i}>
            {/* Hit target spans the full slot, larger than the mark */}
            <rect
              x={b.slotX}
              y={PAD.top}
              width={b.slotW}
              height={H - PAD.top - PAD.bottom}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
            {b.h > 0 && (
              <path
                d={`M ${b.x} ${b.y + Math.min(4, b.h)}
                    Q ${b.x} ${b.y} ${b.x + Math.min(4, b.w / 2)} ${b.y}
                    L ${b.x + b.w - Math.min(4, b.w / 2)} ${b.y}
                    Q ${b.x + b.w} ${b.y} ${b.x + b.w} ${b.y + Math.min(4, b.h)}
                    L ${b.x + b.w} ${b.y + b.h}
                    L ${b.x} ${b.y + b.h} Z`}
                fill="hsl(217 91% 60%)"
                opacity={hover === null || hover === i ? 0.9 : 0.35}
                style={{ transition: "opacity 120ms" }}
              />
            )}
          </g>
        ))}

        {/* Sparse x labels: first, middle, last */}
        {[0, Math.floor(data.length / 2), data.length - 1].map((i) => (
          <text
            key={i}
            x={bars[i].slotX + bars[i].slotW / 2}
            y={H - 8}
            textAnchor="middle"
            className="fill-white/35 font-mono"
            fontSize="10"
          >
            {data[i].date.slice(5)}
          </text>
        ))}
      </svg>

      {hovered && hover !== null && (
        <div
          className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 rounded-lg border border-white/10 bg-[#0d111c] px-3 py-2 text-xs shadow-xl"
          style={{ left: `${((bars[hover].slotX + bars[hover].slotW / 2) / W) * 100}%` }}
        >
          <p className="font-mono text-white/50">{hovered.date}</p>
          <p className="mt-0.5 font-mono font-semibold tabular-nums text-white">
            ${formatUsd(hovered.volume)}
          </p>
          <p className="font-mono tabular-nums text-white/50">
            {hovered.count} swap{hovered.count === 1 ? "" : "s"}
          </p>
        </div>
      )}
    </div>
  );
}
