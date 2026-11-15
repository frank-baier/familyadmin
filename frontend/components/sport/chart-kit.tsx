'use client';

import { useEffect, useRef, useState } from 'react';

/** Chart tokens (light surface). Text never wears a series color. */
export const INK = {
  primary: '#111111',
  secondary: '#52514e',
  muted: '#8a8984',
  grid: '#ecece8',
  axis: '#d4d4ce',
  surface: '#ffffff',
  neutralSeries: '#c8c8c2',
};

/** Sequential blue ramp (light → dark) for magnitude. */
export const BLUE_RAMP = ['#f0f0ec', '#cde2fb', '#86b6ef', '#3987e5', '#1c5cab', '#0d366b'];

export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    setWidth(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Clean axis ticks: 0 … ≥max in 1/2/2.5/5 × 10ⁿ steps. */
export function niceTicks(max: number, count = 4, min = 0): number[] {
  const span = Math.max(max - min, 1e-9);
  const raw = span / count;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.999; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  if (ticks.length < 2) ticks.push(start + step);
  return ticks;
}

/** Path for a column with 4px rounded data-end and square baseline. */
export function columnPath(x: number, yTop: number, w: number, yBase: number, r = 4): string {
  const h = yBase - yTop;
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${yBase}V${yTop + rr}Q${x},${yTop} ${x + rr},${yTop}H${x + w - rr}Q${x + w},${yTop} ${x + w},${yTop + rr}V${yBase}Z`;
}

export function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: React.ReactNode }) {
  // Flip to the left of the pointer near the right edge.
  const left = x > width - 190 ? x - 12 : x + 12;
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 rounded-xl bg-white px-3 py-2 text-xs shadow-lg"
      style={{
        left,
        top: Math.max(0, y - 8),
        transform: x > width - 190 ? 'translateX(-100%)' : undefined,
        border: '1px solid #e8e8e4',
        minWidth: 140,
      }}
    >
      {children}
    </div>
  );
}

export function TipRow({ color, label, value, line }: { color?: string; label: string; value: string; line?: boolean }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      {color && (
        line
          ? <span className="inline-block w-3 h-0.5 rounded-full shrink-0" style={{ background: color }} />
          : <span className="inline-block w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
      )}
      <span className="text-slate-500 flex-1">{label}</span>
      <span className="font-semibold text-slate-900 tabular-nums">{value}</span>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; line?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500" aria-label="Legende">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          {i.line
            ? <span className="inline-block w-3.5 h-0.5 rounded-full" style={{ background: i.color }} />
            : <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: i.color }} />}
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { key: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-stone-100 p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          role="radio"
          aria-checked={value === o.key}
          onClick={() => onChange(o.key)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            value === o.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Card({ title, subtitle, action, children, className = '' }: {
  title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`glass rounded-3xl p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
