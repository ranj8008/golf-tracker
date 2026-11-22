"use client";

import { useEffect, useRef, useState } from "react";

// Small hand-drawn SVG charts for the Stats page. Thin marks, a hairline grid,
// muted axis text, and a tooltip on hover or tap.

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

const niceTicks = (lo: number, hi: number, count = 4) => {
  const span = hi - lo || 1;
  const step = [1, 2, 5, 10, 20, 50].find((s) => span / s <= count) ?? 100;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  return ticks;
};

function Tooltip({ x, width, children }: { x: number; width: number; children: React.ReactNode }) {
  const w = 168;
  const left = Math.min(Math.max(x - w / 2, 0), Math.max(width - w, 0));
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-0 z-10 rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs shadow-lg"
      style={{ left, width: w }}
    >
      {children}
    </div>
  );
}

export type TrendPoint = { value: number; average: number; label: string; sub: string };

// Each round as a thin muted line, the moving average in the accent colour.
export function TrendChart({
  points,
  unit,
  averageLabel,
}: {
  points: TrendPoint[];
  unit: string; // "gross", "points"
  averageLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [at, setAt] = useState<number | null>(null);
  const height = 180;
  const pad = { l: 28, r: 8, t: 12, b: 20 };
  const values = points.flatMap((p) => [p.value, p.average]);
  const lo = Math.floor(Math.min(...values) - 1);
  const hi = Math.ceil(Math.max(...values) + 1);
  const x = (i: number) =>
    pad.l + (points.length <= 1 ? 0 : (i / (points.length - 1)) * (width - pad.l - pad.r));
  const y = (v: number) => pad.t + ((hi - v) / (hi - lo || 1)) * (height - pad.t - pad.b);
  const path = (k: "value" | "average") =>
    points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join("");
  const pick = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect();
    const rel = (clientX - r.left - pad.l) / (width - pad.l - pad.r);
    setAt(Math.min(points.length - 1, Math.max(0, Math.round(rel * (points.length - 1)))));
  };
  const p = at === null ? null : points[at];
  return (
    <div ref={ref} className="relative">
      {width > 0 && points.length > 1 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${unit} for each round, with ${averageLabel}`}
          onPointerMove={(e) => pick(e.clientX, e.currentTarget)}
          onPointerDown={(e) => pick(e.clientX, e.currentTarget)}
          onPointerLeave={() => setAt(null)}
          className="touch-pan-y"
        >
          {niceTicks(lo, hi).map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
              <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)">
                {t}
              </text>
            </g>
          ))}
          <path d={path("value")} fill="none" stroke="var(--chart-muted)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
          <path d={path("average")} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {p && at !== null && (
            <g>
              <line x1={x(at)} x2={x(at)} y1={pad.t} y2={height - pad.b} stroke="var(--muted)" strokeWidth={1} />
              <circle cx={x(at)} cy={y(p.value)} r={4} fill="var(--chart-muted)" stroke="var(--card)" strokeWidth={2} />
              <circle cx={x(at)} cy={y(p.average)} r={4} fill="var(--accent)" stroke="var(--card)" strokeWidth={2} />
            </g>
          )}
          <text x={pad.l} y={height - 4} fontSize={11} fill="var(--muted)">
            {points[0].sub.slice(-4)}
          </text>
          <text x={width - pad.r} y={height - 4} fontSize={11} fill="var(--muted)" textAnchor="end">
            {points[points.length - 1].sub.slice(-4)}
          </text>
        </svg>
      )}
      {p && (
        <Tooltip x={x(at!)} width={width}>
          <div className="font-medium">{p.sub}</div>
          <div className="truncate text-muted">{p.label}</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3 rounded bg-[var(--chart-muted)]" />
            {p.value} {unit}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3 rounded bg-accent" />
            {p.average.toFixed(1)} {averageLabel}
          </div>
        </Tooltip>
      )}
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-[var(--chart-muted)]" />
          Each round
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-accent" />
          {averageLabel[0].toUpperCase() + averageLabel.slice(1)}
        </span>
      </div>
    </div>
  );
}

export type DiffBar = { value: number; counts: boolean; label: string; sub: string };

// The last 20 differentials, oldest on the left; the ones that count in the accent.
export function DifferentialBars({ bars }: { bars: DiffBar[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [at, setAt] = useState<number | null>(null);
  const height = 150;
  const pad = { l: 28, r: 4, t: 10, b: 6 };
  const hi = Math.ceil(Math.max(0, ...bars.map((b) => b.value)) + 1);
  const lo = Math.min(0, Math.floor(Math.min(...bars.map((b) => b.value))));
  const slot = (width - pad.l - pad.r) / Math.max(bars.length, 1);
  const bw = Math.min(24, slot - 2);
  const y = (v: number) => pad.t + ((hi - v) / (hi - lo || 1)) * (height - pad.t - pad.b);
  const b = at === null ? null : bars[at];
  // Square at the baseline, 4px rounded at the data end.
  const bar = (i: number, v: number) => {
    const x0 = pad.l + i * slot + (slot - bw) / 2;
    const top = y(Math.max(v, 0));
    const bottom = y(Math.min(v, 0));
    const h = Math.max(bottom - top, 1);
    const r = Math.min(4, h / 2, bw / 2);
    return v >= 0
      ? `M${x0},${bottom}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x0 + bw - r}Q${x0 + bw},${top} ${x0 + bw},${top + r}V${bottom}Z`
      : `M${x0},${top}V${bottom - r}Q${x0},${bottom} ${x0 + r},${bottom}H${x0 + bw - r}Q${x0 + bw},${bottom} ${x0 + bw},${bottom - r}V${top}Z`;
  };
  return (
    <div ref={ref} className="relative">
      {width > 0 && bars.length > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Score differentials for the last 20 rounds"
          onPointerLeave={() => setAt(null)}
          className="touch-pan-y"
        >
          {niceTicks(lo, hi).map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
              <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)">
                {t}
              </text>
            </g>
          ))}
          {bars.map((d, i) => (
            <g key={i}>
              <path
                d={bar(i, d.value)}
                fill={d.counts ? "var(--accent)" : "var(--chart-muted)"}
                opacity={at === null || at === i ? 1 : 0.6}
              />
              {/* A hit area the full height of the slot. */}
              <rect
                x={pad.l + i * slot}
                y={0}
                width={slot}
                height={height}
                fill="transparent"
                onPointerEnter={() => setAt(i)}
                onPointerDown={() => setAt(i)}
              />
            </g>
          ))}
        </svg>
      )}
      {b && (
        <Tooltip x={pad.l + at! * slot + slot / 2} width={width}>
          <div className="font-medium">{b.sub}</div>
          <div className="truncate text-muted">{b.label}</div>
          <div className="mt-0.5">
            Differential {b.value.toFixed(1)}
            {b.counts ? " · counts" : ""}
          </div>
        </Tooltip>
      )}
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-accent" />
          Counts towards the figure
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-[var(--chart-muted)]" />
          Doesn&apos;t count
        </span>
      </div>
    </div>
  );
}

export type MixPart = { key: string; label: string; value: number; color: string };

// One bar split into parts with a 2px gap between them; the legend carries names
// and numbers (segments are often too narrow to label).
export function MixBar({ parts, unit }: { parts: MixPart[]; unit: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <div>
      <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded" role="img" aria-label="Score mix">
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <div
              key={p.key}
              title={`${p.label}: ${p.value.toFixed(1)} ${unit}`}
              style={{ width: `${(p.value / total) * 100}%`, background: p.color, minWidth: 2 }}
            />
          ))}
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-1 text-sm tabular-nums">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2">
            <span className="inline-block size-3 shrink-0 rounded-sm" style={{ background: p.color }} />
            <span className="flex-1">{p.label}</span>
            <span className="w-24 text-right">
              {p.value.toFixed(1)} <span className="text-muted">{unit}</span>
            </span>
            <span className="w-12 text-right text-muted">{Math.round((p.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
