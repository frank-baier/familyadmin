'use client';

import { useMemo, useState } from 'react';
import type { Fitness } from '@/lib/sport';
import { fmt0, fmtDate, FORM_STATUS_META } from '@/lib/sport';
import { Card, INK, Legend, niceTicks, Segmented, TipRow, Tooltip, useWidth } from './chart-kit';

type Range = '3M' | '6M' | '1Y' | 'ALL';
const RANGE_DAYS: Record<Range, number> = { '3M': 91, '6M': 182, '1Y': 365, ALL: 1e9 };

const FITNESS = '#2a78d6';
const FATIGUE = '#eb6834';

/** Form zones (TSB) — drawn as recessive bands, labeled at the right edge. */
const ZONES = [
  { from: 5, to: 60, label: 'Erholt', fill: '#f3f7fd' },
  { from: -10, to: 5, label: 'Neutral', fill: '#ffffff' },
  { from: -30, to: -10, label: 'Aufbau', fill: '#f5f5f2' },
  { from: -80, to: -30, label: 'Überlastung', fill: '#fdf1f0' },
];

export function FitnessChart({ fitness }: { fitness: Fitness }) {
  const [range, setRange] = useState<Range>('6M');
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const points = useMemo(() => {
    const s = fitness.series;
    if (!s.length) return s;
    const last = new Date(s[s.length - 1].date).getTime();
    const from = last - RANGE_DAYS[range] * 86400000;
    return s.filter((p) => new Date(p.date).getTime() >= from);
  }, [fitness.series, range]);

  const status = FORM_STATUS_META[fitness.formStatus];
  const padL = 36, padR = range === 'ALL' ? 12 : 76, topH = 180, formH = 110, gap = 28;
  const innerW = Math.max(0, width - padL - padR);
  const n = points.length;
  // Time-based x: older history is sampled weekly, so index spacing would distort time.
  const ts = useMemo(() => points.map((p) => new Date(`${p.date}T00:00:00`).getTime()), [points]);
  const t0 = ts[0] ?? 0, t1 = ts[n - 1] ?? 1;
  const x = (i: number) => padL + (n <= 1 ? 0 : ((ts[i] - t0) / (t1 - t0 || 1)) * innerW);

  const yMax = Math.max(10, ...points.map((p) => Math.max(p.fitness, p.fatigue)));
  const yTicks = niceTicks(yMax, 4);
  const yTop = (v: number) => topH - (v / yTicks[yTicks.length - 1]) * (topH - 8);

  const fMin = Math.min(-35, ...points.map((p) => p.form));
  const fMax = Math.max(20, ...points.map((p) => p.form));
  const fy0 = topH + gap;
  const yForm = (v: number) => fy0 + ((fMax - v) / (fMax - fMin)) * formH;

  const line = (get: (p: (typeof points)[number]) => number, y: (v: number) => number) =>
    points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(get(p)).toFixed(1)}`).join('');

  const height = fy0 + formH + 22;
  const h = hover != null ? points[hover] : null;

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = t0 + ((e.clientX - rect.left) / rect.width) * (t1 - t0);
    let lo = 0, hi = n - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (ts[mid] < t) lo = mid + 1; else hi = mid; }
    setHover(lo > 0 && t - ts[lo - 1] < ts[lo] - t ? lo - 1 : lo);
  }

  const xLabels = useMemo(() => {
    if (n < 2) return [];
    const count = Math.max(2, Math.min(6, Math.floor(innerW / 90)));
    return Array.from({ length: count }, (_, k) => {
      const t = t0 + (k / (count - 1)) * (t1 - t0);
      let best = 0;
      for (let i = 0; i < n; i++) if (Math.abs(ts[i] - t) < Math.abs(ts[best] - t)) best = i;
      return best;
    });
  }, [n, innerW, ts, t0, t1]);

  return (
    <Card
      title="Fitness & Form"
      subtitle="Fitness = Trainingslast der letzten 6 Wochen, Ermüdung = letzte Woche, Form = Differenz"
      action={<Segmented label="Zeitraum" value={range} onChange={setRange}
        options={[{ key: '3M', label: '3 M' }, { key: '6M', label: '6 M' }, { key: '1Y', label: '1 J' }, { key: 'ALL', label: 'Alle' }]} />}
    >
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="Fitness" value={fmt0(fitness.currentFitness)} swatch={FITNESS} />
        <Stat label="Ermüdung" value={fmt0(fitness.currentFatigue)} swatch={FATIGUE} />
        <div>
          <p className="text-xs text-slate-500">Form</p>
          <p className="text-xl font-semibold text-slate-900 tabular-nums">
            {fitness.currentForm > 0 ? '+' : ''}{fmt0(fitness.currentForm)}
          </p>
          <span className={`pill mt-1 ${status.tone === 'warning' ? 'bg-amber-50 text-amber-800' : status.tone === 'good' ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-700'}`}>
            {status.tone === 'warning' ? '⚠︎' : status.tone === 'good' ? '✓' : '•'} {status.label}
          </span>
        </div>
      </div>

      <div className="mb-3"><Legend items={[{ label: 'Fitness', color: FITNESS, line: true }, { label: 'Ermüdung', color: FATIGUE, line: true }, { label: 'Form', color: INK.secondary, line: true }]} /></div>

      <div ref={ref} className="relative w-full">
        {width > 0 && n > 1 && (
          <svg width={width} height={height} role="img" aria-label="Verlauf von Fitness, Ermüdung und Form">
            {/* top chart grid */}
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={padL + innerW} y1={yTop(t)} y2={yTop(t)} stroke={INK.grid} />
                <text x={padL - 6} y={yTop(t)} dy="0.32em" textAnchor="end" fontSize={10} fill={INK.muted}>{t}</text>
              </g>
            ))}
            <path d={`${line((p) => p.fitness, yTop)}L${x(n - 1)},${topH}L${padL},${topH}Z`} fill={FITNESS} opacity={0.1} />
            <path d={line((p) => p.fatigue, yTop)} fill="none" stroke={FATIGUE} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
            <path d={line((p) => p.fitness, yTop)} fill="none" stroke={FITNESS} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {range !== 'ALL' && (
              <text x={x(n - 1) + 8} y={yTop(points[n - 1].fitness)} dy="0.32em" fontSize={11} fill={INK.secondary}>
                Fitness {fmt0(points[n - 1].fitness)}
              </text>
            )}

            {/* form chart with zones */}
            {ZONES.map((z) => {
              const y1 = yForm(Math.min(z.to, fMax)), y2 = yForm(Math.max(z.from, fMin));
              if (y2 <= y1) return null;
              return (
                <g key={z.label}>
                  <rect x={padL} y={y1} width={innerW} height={y2 - y1} fill={z.fill} />
                  {range !== 'ALL' && <text x={padL + innerW + 8} y={(y1 + y2) / 2} dy="0.32em" fontSize={10} fill={INK.muted}>{z.label}</text>}
                </g>
              );
            })}
            <line x1={padL} x2={padL + innerW} y1={yForm(0)} y2={yForm(0)} stroke={INK.axis} />
            <text x={padL - 6} y={yForm(0)} dy="0.32em" textAnchor="end" fontSize={10} fill={INK.muted}>0</text>
            <text x={padL} y={fy0 - 8} fontSize={10} fill={INK.muted}>Form</text>
            <path d={line((p) => p.form, yForm)} fill="none" stroke={INK.secondary} strokeWidth={1.5} strokeLinejoin="round" />

            {/* x labels */}
            {xLabels.map((i) => (
              <text key={i} x={x(i)} y={height - 4} fontSize={10} fill={INK.muted}
                textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
                {fmtDate(points[i].date, range === 'ALL' ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' })}
              </text>
            ))}

            {/* crosshair */}
            {h && hover != null && (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={0} y2={fy0 + formH} stroke={INK.axis} />
                <circle cx={x(hover)} cy={yTop(h.fitness)} r={4} fill={FITNESS} stroke="#fff" strokeWidth={2} />
                <circle cx={x(hover)} cy={yTop(h.fatigue)} r={4} fill={FATIGUE} stroke="#fff" strokeWidth={2} />
                <circle cx={x(hover)} cy={yForm(h.form)} r={4} fill={INK.secondary} stroke="#fff" strokeWidth={2} />
              </g>
            )}
            <rect x={padL} y={0} width={innerW} height={fy0 + formH} fill="transparent"
              onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
          </svg>
        )}
        {h && hover != null && (
          <Tooltip x={x(hover)} y={20} width={width}>
            <p className="font-semibold text-slate-900 mb-1">{fmtDate(h.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>
            <TipRow color={FITNESS} line label="Fitness" value={fmt0(h.fitness)} />
            <TipRow color={FATIGUE} line label="Ermüdung" value={fmt0(h.fatigue)} />
            <TipRow color={INK.secondary} line label="Form" value={`${h.form > 0 ? '+' : ''}${fmt0(h.form)}`} />
          </Tooltip>
        )}
      </div>

      <p className="text-xs text-slate-400 mt-3 leading-relaxed">
        {fitness.hrCoverage < 0.5
          ? `Nur ${Math.round(fitness.hrCoverage * 100)} % deiner Aktivitäten haben Pulsdaten — der Rest wird über Dauer und Sportart geschätzt.`
          : `Trainingslast aus Herzfrequenz (TRIMP) mit Max-Puls ${fitness.maxHr}${fitness.maxHrEstimated ? ' (geschätzt)' : ''} und Ruhepuls ${fitness.restingHr}${fitness.restingHrEstimated ? ' (Standardwert)' : ''}.`}
        {fitness.peakFitnessDate && ` Höchste Fitness: ${fmt0(fitness.peakFitness)} am ${fmtDate(fitness.peakFitnessDate)}.`}
      </p>
    </Card>
  );
}

function Stat({ label, value, swatch }: { label: string; value: string; swatch: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500 flex items-center gap-1.5">
        <span className="inline-block w-3 h-0.5 rounded-full" style={{ background: swatch }} />{label}
      </p>
      <p className="text-xl font-semibold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}
