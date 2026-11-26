'use client';

import { useState } from 'react';
import type { Fitness, MonthValue } from '@/lib/sport';
import { fmt0, fmt1, MONTHS_SHORT, vo2maxClass } from '@/lib/sport';
import { Card, INK, niceTicks, Tooltip, useWidth } from './chart-kit';

const monthLabel = (m: string) => `${MONTHS_SHORT[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;

/** Single-series monthly trend line (last 24 months), hover per point. */
function TrendLine({ values, format, color = '#2a78d6', label }: {
  values: MonthValue[]; format: (v: number) => string; color?: string; label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pts = values.slice(-24);
  const height = 140, padL = 36, padR = 8, padT = 10, padB = 20;
  const innerW = Math.max(0, width - padL - padR);
  const plotH = height - padT - padB;
  if (pts.length < 2) {
    return <p className="text-sm text-slate-400 py-6 text-center">Noch zu wenig Daten für einen Verlauf.</p>;
  }
  const lo = Math.min(...pts.map((p) => p.value)), hi = Math.max(...pts.map((p) => p.value));
  const pad = (hi - lo) * 0.15 || hi * 0.05 || 1;
  const ticks = niceTicks(hi + pad, 3, Math.max(0, lo - pad));
  const tMin = ticks[0], tMax = ticks[ticks.length - 1];
  const x = (i: number) => padL + (i / (pts.length - 1)) * innerW;
  const y = (v: number) => padT + plotH - ((v - tMin) / (tMax - tMin)) * plotH;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const last = pts.length - 1;

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={padL + innerW} y1={y(t)} y2={y(t)} stroke={INK.grid} />
              <text x={padL - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill={INK.muted}>{format(t)}</text>
            </g>
          ))}
          <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(last)} cy={y(pts[last].value)} r={4} fill={color} stroke="#fff" strokeWidth={2} />
          {[0, Math.floor(last / 2), last].map((i) => (
            <text key={i} x={x(i)} y={height - 4} fontSize={10} fill={INK.muted}
              textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'}>{monthLabel(pts[i].month)}</text>
          ))}
          {hover != null && <circle cx={x(hover)} cy={y(pts[hover].value)} r={5} fill={color} stroke="#fff" strokeWidth={2} pointerEvents="none" />}
          {pts.map((p, i) => (
            <rect key={p.month} x={x(i) - innerW / (pts.length - 1) / 2} y={padT} width={innerW / (pts.length - 1)} height={plotH}
              fill="transparent" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
          ))}
        </svg>
      )}
      {hover != null && (
        <Tooltip x={x(hover)} y={0} width={width}>
          <p className="font-semibold text-slate-900">{monthLabel(pts[hover].month)}</p>
          <p className="text-slate-700 tabular-nums">{format(pts[hover].value)}</p>
          <p className="text-slate-400">{pts[hover].samples} Aktivität{pts[hover].samples !== 1 ? 'en' : ''}</p>
        </Tooltip>
      )}
    </div>
  );
}

export function Vo2maxCard({ fitness }: { fitness: Fitness }) {
  const cls = fitness.vo2max != null ? vo2maxClass(fitness.vo2max, fitness.age, fitness.sex) : null;
  return (
    <Card title="VO₂max (Schätzung)" subtitle="Aus Tempo und Puls deiner Läufe — je höher, desto besser deine Ausdauer">
      {fitness.vo2max == null ? (
        <p className="text-sm text-slate-400">
          Für eine Schätzung braucht es mindestens drei Läufe mit Pulsdaten (ab 15 min, 2 km) in den letzten sechs Monaten.
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 flex-wrap mb-1">
            <span className="text-4xl font-semibold text-slate-900 tabular-nums">{fmt1(fitness.vo2max)}</span>
            <span className="text-sm text-slate-500">ml/kg/min</span>
            {cls && <span className="pill bg-stone-100 text-stone-700 ml-1">{cls} für dein Alter</span>}
          </div>
          {!cls && <p className="text-xs text-slate-400 mb-2">Geburtsjahr und Geschlecht in den Einstellungen ergänzen für eine Alterseinordnung.</p>}
          <TrendLine values={fitness.vo2maxTrend} format={(v) => fmt0(v)} label="VO2max-Verlauf pro Monat" />
        </>
      )}
    </Card>
  );
}

export function EfficiencyCard({ fitness }: { fitness: Fitness }) {
  const hasRun = fitness.runEfficiency.length >= 2;
  const hasRide = fitness.rideEfficiency.length >= 2;
  const [mode, setMode] = useState<'run' | 'ride'>(hasRun || !hasRide ? 'run' : 'ride');
  const values = mode === 'run' ? fitness.runEfficiency : fitness.rideEfficiency;
  return (
    <Card title="Aerobe Effizienz"
      subtitle={mode === 'run' ? 'Meter pro Herzschlag beim Laufen — steigt, wenn dein Herz effizienter arbeitet' : 'Watt pro Herzschlag auf dem Rad'}
      action={hasRun && hasRide ? (
        <div className="inline-flex rounded-full bg-stone-100 p-0.5 text-xs">
          {(['run', 'ride'] as const).map((k) => (
            <button key={k} onClick={() => setMode(k)} aria-pressed={mode === k}
              className={`px-3 py-1 rounded-full font-medium ${mode === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              {k === 'run' ? 'Laufen' : 'Rad'}
            </button>
          ))}
        </div>
      ) : undefined}>
      {values.length < 2 ? (
        <p className="text-sm text-slate-400">Braucht Aktivitäten mit Pulsdaten{mode === 'ride' ? ' und Wattmessung' : ''} aus mindestens zwei Monaten.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-4xl font-semibold text-slate-900 tabular-nums">{fmt1(values[values.length - 1].value)}</span>
            <span className="text-sm text-slate-500">{mode === 'run' ? 'm / Schlag' : 'W / Schlag'}</span>
          </div>
          <TrendLine values={values} format={(v) => v.toFixed(1).replace('.', ',')} color={mode === 'run' ? '#2a78d6' : '#eb6834'}
            label="Effizienz-Verlauf pro Monat" />
        </>
      )}
    </Card>
  );
}

const INTENSITY = [
  { key: 'easyHours', label: 'Locker', hint: '< 77 % Max-Puls', color: '#86b6ef' },
  { key: 'moderateHours', label: 'Mittel', hint: '77–87 %', color: '#2a78d6' },
  { key: 'hardHours', label: 'Hart', hint: '> 87 %', color: '#0d366b' },
] as const;

export function IntensityCard({ fitness }: { fitness: Fitness }) {
  const i = fitness.intensity90d;
  const total = i.easyHours + i.moderateHours + i.hardHours;
  return (
    <Card title="Intensitätsverteilung" subtitle="Letzte 90 Tage, nach Durchschnittspuls je Aktivität · Ziel: ~80 % locker">
      {total < 1 ? (
        <p className="text-sm text-slate-400">Keine Aktivitäten mit Pulsdaten in den letzten 90 Tagen.</p>
      ) : (
        <>
          <div className="flex h-4 w-full gap-0.5 rounded-full overflow-hidden" role="img"
            aria-label={INTENSITY.map((s) => `${s.label} ${Math.round((i[s.key] / total) * 100)} %`).join(', ')}>
            {INTENSITY.map((s) => i[s.key] > 0 && (
              <div key={s.key} style={{ width: `${(i[s.key] / total) * 100}%`, background: s.color }} title={`${s.label}: ${fmt1(i[s.key])} h`} />
            ))}
          </div>
          <div className="relative h-3 mt-1" aria-hidden="true">
            <span className="absolute top-0 w-px h-3 bg-slate-400" style={{ left: '80%' }} />
            <span className="absolute -top-0.5 text-[10px] text-slate-400" style={{ left: 'calc(80% + 4px)' }}>80 %</span>
          </div>
          <ul className="grid grid-cols-3 gap-2 mt-3">
            {INTENSITY.map((s) => (
              <li key={s.key}>
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: s.color }} />{s.label}
                </p>
                <p className="text-lg font-semibold text-slate-900 tabular-nums">{Math.round((i[s.key] / total) * 100)} %</p>
                <p className="text-[11px] text-slate-400">{fmt1(i[s.key])} h · {s.hint}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
