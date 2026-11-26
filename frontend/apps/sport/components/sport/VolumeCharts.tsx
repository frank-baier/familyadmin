'use client';

import { useMemo, useState } from 'react';
import type { CategoryTotals, DayStat, MonthStat, SportCategory, YearStat } from '@/lib/sport';
import { CATEGORY_META, CATEGORY_ORDER, compact, fmt0, fmt1, fmtHours, MONTHS_SHORT } from '@/lib/sport';
import { Card, columnPath, INK, Legend, niceTicks, Segmented, TipRow, Tooltip, useWidth } from './chart-kit';

export type Metric = 'distance' | 'hours' | 'count';
export const METRIC_OPTIONS: { key: Metric; label: string }[] = [
  { key: 'distance', label: 'Distanz' },
  { key: 'hours', label: 'Zeit' },
  { key: 'count', label: 'Anzahl' },
];

const pick = (t: { distanceKm: number; hours: number; count: number }, m: Metric) =>
  m === 'distance' ? t.distanceKm : m === 'hours' ? t.hours : t.count;

export const fmtMetric = (v: number, m: Metric) =>
  m === 'distance' ? `${fmt0(v)} km` : m === 'hours' ? `${fmt0(v)} h` : fmt0(v);

function categoriesIn(rows: { byCategory: CategoryTotals[] }[], m: Metric): SportCategory[] {
  const present = new Set<SportCategory>();
  rows.forEach((r) => r.byCategory.forEach((c) => { if (pick(c, m) > 0) present.add(c.category); }));
  return CATEGORY_ORDER.filter((c) => present.has(c));
}

/** Stacked columns — shared by year and month views. */
function StackedColumns({ rows, labels, metric, ghost, height = 220, ariaLabel }: {
  rows: { byCategory: CategoryTotals[]; count: number; distanceKm: number; hours: number }[];
  labels: string[];
  metric: Metric;
  ghost?: (number | null)[];
  height?: number;
  ariaLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const cats = categoriesIn(rows, metric);
  const padL = 40, padB = 22, padT = 18;
  const innerW = Math.max(0, width - padL - 4);
  const band = rows.length ? innerW / rows.length : 0;
  const barW = Math.min(24, band * 0.62);
  const totals = rows.map((r) => pick(r, metric));
  const maxV = Math.max(1, ...totals, ...(ghost ?? []).map((g) => g ?? 0));
  const ticks = niceTicks(maxV, 4);
  const top = ticks[ticks.length - 1];
  const plotH = height - padB - padT;
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const GAP = 2;

  return (
    <div className="space-y-3">
      {cats.length > 1 && <Legend items={cats.map((c) => ({ label: CATEGORY_META[c].label, color: CATEGORY_META[c].color }))} />}
      <div ref={ref} className="relative w-full">
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={ariaLabel}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={padL + innerW} y1={y(t)} y2={y(t)} stroke={t === 0 ? INK.axis : INK.grid} />
                <text x={padL - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill={INK.muted}>{compact(t)}</text>
              </g>
            ))}
            {rows.map((r, i) => {
              const cx = padL + band * i + band / 2;
              let acc = 0;
              const segs = cats
                .map((c) => ({ c, v: pick(r.byCategory.find((b) => b.category === c) ?? { distanceKm: 0, hours: 0, count: 0 }, metric) }))
                .filter((s) => s.v > 0);
              const g = ghost?.[i];
              return (
                <g key={i} opacity={hover == null || hover === i ? 1 : 0.55}>
                  {segs.map((s, k) => {
                    const y0 = y(acc);
                    acc += s.v;
                    const y1 = y(acc);
                    const isTop = k === segs.length - 1;
                    // 2px surface gap between stacked segments (taken off the bottom of every segment above the first)
                    const bottom = k === 0 ? y0 : y0 - GAP;
                    if (bottom - y1 < 0.5) return null;
                    return isTop
                      ? <path key={s.c} d={columnPath(cx - barW / 2, y1, barW, bottom)} fill={CATEGORY_META[s.c].color} />
                      : <rect key={s.c} x={cx - barW / 2} y={y1} width={barW} height={bottom - y1} fill={CATEGORY_META[s.c].color} />;
                  })}
                  {g != null && g > 0 && (
                    <line x1={cx - barW / 2 - 3} x2={cx + barW / 2 + 3} y1={y(g)} y2={y(g)} stroke={INK.primary} strokeWidth={2} strokeLinecap="round" opacity={0.35} />
                  )}
                  {band >= 34 && totals[i] > 0 && (
                    <text x={cx} y={y(totals[i]) - 5} textAnchor="middle" fontSize={10} fill={INK.secondary}>{compact(totals[i])}</text>
                  )}
                  <text x={cx} y={height - 6} textAnchor="middle" fontSize={10} fill={INK.muted}>{labels[i]}</text>
                  <rect x={padL + band * i} y={padT} width={band} height={plotH} fill="transparent"
                    onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
                </g>
              );
            })}
          </svg>
        )}
        {hover != null && rows[hover] && (
          <Tooltip x={padL + band * hover + band / 2} y={10} width={width}>
            <p className="font-semibold text-slate-900 mb-1">{labels[hover]}</p>
            {cats.map((c) => {
              const v = pick(rows[hover].byCategory.find((b) => b.category === c) ?? { distanceKm: 0, hours: 0, count: 0 }, metric);
              return v > 0 ? <TipRow key={c} color={CATEGORY_META[c].color} label={CATEGORY_META[c].label} value={fmtMetric(v, metric)} /> : null;
            })}
            <div className="hairline my-1" />
            <TipRow label="Gesamt" value={fmtMetric(totals[hover], metric)} />
            {ghost?.[hover] != null && <TipRow label="Vorjahr" value={fmtMetric(ghost[hover]!, metric)} />}
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export function YearsChart({ years, metric, onMetric }: { years: YearStat[]; metric: Metric; onMetric: (m: Metric) => void }) {
  const shown = years.slice(-12);
  return (
    <Card title="Jahresvergleich" subtitle={`${shown[0]?.year ?? ''}–${shown[shown.length - 1]?.year ?? ''}, nach Sportart`}
      action={<Segmented label="Kennzahl" value={metric} onChange={onMetric} options={METRIC_OPTIONS} />}>
      <StackedColumns rows={shown} labels={shown.map((y) => String(y.year))} metric={metric} ariaLabel="Jahressummen nach Sportart" />
    </Card>
  );
}

export function MonthsChart({ months, years, metric, onMetric }: {
  months: MonthStat[]; years: number[]; metric: Metric; onMetric: (m: Metric) => void;
}) {
  const [year, setYear] = useState(years[years.length - 1]);
  const byKey = useMemo(() => new Map(months.map((m) => [m.month, m])), [months]);
  const empty = (k: string): MonthStat => ({ month: k, count: 0, distanceKm: 0, hours: 0, elevationM: 0, byCategory: [] });
  const rows = MONTHS_SHORT.map((_, i) => {
    const k = `${year}-${String(i + 1).padStart(2, '0')}`;
    return byKey.get(k) ?? empty(k);
  });
  const ghost = MONTHS_SHORT.map((_, i) => {
    const p = byKey.get(`${year - 1}-${String(i + 1).padStart(2, '0')}`);
    return p ? pick(p, metric) : null;
  });

  return (
    <Card title="Monate" subtitle={`${year} · Strich = gleicher Monat ${year - 1}`}
      action={
        <div className="flex gap-2 flex-wrap items-center">
          <select aria-label="Jahr" value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-slate-700">
            {[...years].reverse().map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <Segmented label="Kennzahl" value={metric} onChange={onMetric} options={METRIC_OPTIONS} />
        </div>
      }>
      <StackedColumns rows={rows} labels={MONTHS_SHORT} metric={metric} ghost={ghost} ariaLabel={`Monatssummen ${year}`} />
    </Card>
  );
}

/** Cumulative distance/time per year by day-of-year: "am I ahead of last year?" */
export function CumulativeChart({ days, metric }: { days: DayStat[]; metric: Metric }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hoverDoy, setHoverDoy] = useState<number | null>(null);
  const m = metric;

  const series = useMemo(() => {
    const byYear = new Map<number, number[]>();
    for (const d of days) {
      const date = new Date(`${d.date}T00:00:00`);
      const yr = date.getFullYear();
      const doy = Math.floor((date.getTime() - new Date(yr, 0, 1).getTime()) / 86400000);
      if (!byYear.has(yr)) byYear.set(yr, new Array(366).fill(0));
      byYear.get(yr)![doy] += pick(d, m);
    }
    const now = new Date();
    const todayDoy = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000);
    return [...byYear.entries()].sort((a, b) => a[0] - b[0]).slice(-6).map(([yr, arr]) => {
      const cum: number[] = [];
      let acc = 0;
      const last = yr === now.getFullYear() ? todayDoy : 365;
      for (let i = 0; i <= last; i++) { acc += arr[i]; cum.push(acc); }
      return { year: yr, cum };
    });
  }, [days, m]);

  const current = series[series.length - 1];
  const prev = series[series.length - 2];
  const padL = 44, padR = 56, padT = 10, padB = 22, height = 240;
  const innerW = Math.max(0, width - padL - padR);
  const maxV = Math.max(1, ...series.map((s) => s.cum[s.cum.length - 1]));
  const ticks = niceTicks(maxV, 4);
  const top = ticks[ticks.length - 1];
  const plotH = height - padT - padB;
  const x = (doy: number) => padL + (doy / 365) * innerW;
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const color = (yr: number) => (yr === current?.year ? '#2a78d6' : yr === prev?.year ? '#eb6834' : INK.neutralSeries);
  const path = (cum: number[]) => cum.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');

  if (!current) return null;
  const legend = [
    { label: String(current.year), color: color(current.year), line: true },
    ...(prev ? [{ label: String(prev.year), color: color(prev.year), line: true }] : []),
    ...(series.length > 2 ? [{ label: 'frühere Jahre', color: INK.neutralSeries, line: true }] : []),
  ];

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverDoy(Math.max(0, Math.min(365, Math.round(((e.clientX - rect.left) / rect.width) * 365))));
  }

  const hoverDate = hoverDoy != null ? new Date(2001, 0, 1 + hoverDoy) : null;

  return (
    <Card title="Jahr im Vergleich" subtitle={`Kumuliert ${m === 'distance' ? 'Kilometer' : m === 'hours' ? 'Stunden' : 'Aktivitäten'} ab 1. Januar`}>
      <div className="mb-3"><Legend items={legend} /></div>
      <div ref={ref} className="relative w-full">
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label="Kumulierter Jahresverlauf">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={padL + innerW} y1={y(t)} y2={y(t)} stroke={t === 0 ? INK.axis : INK.grid} />
                <text x={padL - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill={INK.muted}>{compact(t)}</text>
              </g>
            ))}
            {MONTHS_SHORT.map((mo, i) => (
              <text key={mo} x={x(Math.round((Date.UTC(2001, i, 15) - Date.UTC(2001, 0, 1)) / 86400000))}
                y={height - 6} textAnchor="middle" fontSize={10} fill={INK.muted}>{i % (innerW < 420 ? 3 : 1) === 0 ? mo : ''}</text>
            ))}
            {series.map((s) => (
              <path key={s.year} d={path(s.cum)} fill="none" stroke={color(s.year)}
                strokeWidth={s.year === current.year || s.year === prev?.year ? 2 : 1.5}
                strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {[prev, current].filter(Boolean).map((s) => (
              <g key={s!.year}>
                <circle cx={x(s!.cum.length - 1)} cy={y(s!.cum[s!.cum.length - 1])} r={4} fill={color(s!.year)} stroke="#fff" strokeWidth={2} />
                <text x={x(s!.cum.length - 1) + 8} y={y(s!.cum[s!.cum.length - 1])} dy="0.32em" fontSize={11} fill={INK.secondary}>
                  {compact(s!.cum[s!.cum.length - 1])}
                </text>
              </g>
            ))}
            {hoverDoy != null && <line x1={x(hoverDoy)} x2={x(hoverDoy)} y1={padT} y2={padT + plotH} stroke={INK.axis} pointerEvents="none" />}
            <rect x={padL} y={padT} width={innerW} height={plotH} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHoverDoy(null)} />
          </svg>
        )}
        {hoverDoy != null && hoverDate && (
          <Tooltip x={x(hoverDoy)} y={10} width={width}>
            <p className="font-semibold text-slate-900 mb-1">bis {hoverDate.getDate()}. {MONTHS_SHORT[hoverDate.getMonth()]}</p>
            {[...series].reverse().map((s) => (
              <TipRow key={s.year} color={color(s.year)} line label={String(s.year)}
                value={hoverDoy < s.cum.length ? (m === 'hours' ? fmtHours(s.cum[hoverDoy]) : fmtMetric(s.cum[hoverDoy], m)) : '–'} />
            ))}
          </Tooltip>
        )}
      </div>
      {prev && current.cum.length - 1 < prev.cum.length && (
        <AheadNote current={current.cum[current.cum.length - 1]} prev={prev.cum[current.cum.length - 1]} prevYear={prev.year} metric={m} />
      )}
    </Card>
  );
}

function AheadNote({ current, prev, prevYear, metric }: { current: number; prev: number; prevYear: number; metric: Metric }) {
  if (prev <= 0) return null;
  const diff = current - prev;
  const pct = (diff / prev) * 100;
  return (
    <p className="text-sm text-slate-600 mt-3">
      {diff >= 0 ? '▲' : '▼'} {metric === 'distance' ? `${fmt1(Math.abs(diff))} km` : metric === 'hours' ? fmtHours(Math.abs(diff)) : fmt0(Math.abs(diff))}{' '}
      ({fmt0(Math.abs(pct))} %) {diff >= 0 ? 'vor' : 'hinter'} {prevYear} zum gleichen Zeitpunkt.
    </p>
  );
}
