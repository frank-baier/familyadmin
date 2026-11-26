'use client';

import { useMemo, useState } from 'react';
import type { ActivityItem, DayStat, Insight, PersonalRecord, SportStats } from '@/lib/sport';
import {
  CATEGORY_META, CATEGORY_ORDER, compact, fmt0, fmt1, fmtDate, fmtDuration, fmtHours, fmtSpeed, MONTHS_SHORT, WEEKDAYS_SHORT,
} from '@/lib/sport';
import { BLUE_RAMP, Card, columnPath, INK, Tooltip, useWidth } from './chart-kit';

// ─── Headline numbers ────────────────────────────────────────────────────────

export function KpiTiles({ stats }: { stats: SportStats }) {
  const { summary, ytd } = stats;
  const delta = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);
  const tiles = [
    { label: `Distanz ${ytd.year}`, value: `${fmt0(ytd.distanceKm)} km`, d: delta(ytd.distanceKm, ytd.prevDistanceKm) },
    { label: `Zeit ${ytd.year}`, value: `${fmt0(ytd.hours)} h`, d: delta(ytd.hours, ytd.prevHours) },
    { label: `Aktivitäten ${ytd.year}`, value: fmt0(ytd.count), d: delta(ytd.count, ytd.prevCount) },
    { label: 'Wochen-Serie', value: `${stats.consistency.currentWeekStreak}`, sub: `Rekord ${stats.consistency.longestWeekStreak} Wochen` },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {tiles.map((t) => (
        <div key={t.label} className="glass rounded-2xl p-4">
          <p className="text-xs text-slate-500">{t.label}</p>
          <p className="text-2xl font-semibold text-slate-900 tabular-nums mt-0.5">{t.value}</p>
          {'d' in t && t.d != null ? (
            <p className={`text-xs font-medium mt-0.5 ${t.d >= 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
              {t.d >= 0 ? '▲' : '▼'} {fmt0(Math.abs(t.d))} % ggü. Vorjahr
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-0.5">{'sub' in t ? t.sub : 'kein Vorjahr'}</p>
          )}
        </div>
      ))}
      <p className="sr-only">Seit {summary.firstDate}: {summary.activities} Aktivitäten.</p>
    </div>
  );
}

/** Lifetime totals expressed in tangible comparisons. */
export function LifetimeCard({ stats }: { stats: SportStats }) {
  const s = stats.summary;
  const facts = [
    { big: `${fmt1(s.distanceKm / 40075)}×`, text: 'um die Erde', sub: `${fmt0(s.distanceKm)} km gesamt` },
    { big: `${fmt1(s.elevationM / 8849)}×`, text: 'auf den Everest', sub: `${fmt0(s.elevationM)} Höhenmeter` },
    { big: `${fmt0(s.hours / 24)} Tage`, text: 'nonstop in Bewegung', sub: `${fmt0(s.hours)} Stunden` },
    ...(s.calories > 0 ? [{ big: `${fmt0(s.calories / 250)}`, text: 'Tafeln Schokolade verbrannt', sub: `${compact(s.calories)} kcal` }] : []),
  ];
  return (
    <Card title="Seit Beginn" subtitle={s.firstDate ? `${s.activities} Aktivitäten an ${fmt0(s.activeDays)} Tagen seit ${fmtDate(s.firstDate, { month: 'long', year: 'numeric' })}` : undefined}>
      <ul className="grid grid-cols-2 gap-4">
        {facts.map((f) => (
          <li key={f.text}>
            <p className="text-2xl font-semibold text-slate-900 tabular-nums">{f.big}</p>
            <p className="text-sm text-slate-600">{f.text}</p>
            <p className="text-xs text-slate-400">{f.sub}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ─── Insights ────────────────────────────────────────────────────────────────

const TONE: Record<Insight['tone'], { icon: string; cls: string }> = {
  POSITIVE: { icon: '↗', cls: 'bg-emerald-50 text-emerald-700' },
  NEUTRAL: { icon: 'i', cls: 'bg-stone-100 text-stone-600' },
  WARNING: { icon: '!', cls: 'bg-amber-50 text-amber-700' },
};

export function Insights({ insights }: { insights: Insight[] }) {
  if (!insights.length) return null;
  return (
    <section aria-labelledby="insights-h">
      <h2 id="insights-h" className="section-label mb-3">Erkenntnisse</h2>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {insights.map((i) => (
          <li key={i.title} className="glass rounded-2xl p-4 flex gap-3">
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${TONE[i.tone].cls}`} aria-hidden="true">
              {TONE[i.tone].icon}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 text-sm">{i.title}</p>
              <p className="text-sm text-slate-600 leading-relaxed">{i.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Calendar heatmap (last 53 weeks) ────────────────────────────────────────

export function Heatmap({ days }: { days: DayStat[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ d: string; v?: DayStat; x: number; y: number } | null>(null);
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);

  const { weeks, monthMarks } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - 52 * 7 - ((today.getDay() + 6) % 7)); // Monday, 52 weeks back
    const weeks: string[][] = [];
    const monthMarks: { col: number; label: string }[] = [];
    for (let d = new Date(start), col = -1; d <= today; d.setDate(d.getDate() + 1)) {
      if ((d.getDay() + 6) % 7 === 0) { weeks.push([]); col++; if (d.getDate() <= 7) monthMarks.push({ col, label: MONTHS_SHORT[d.getMonth()] }); }
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      weeks[weeks.length - 1].push(iso);
    }
    return { weeks, monthMarks };
  }, []);

  const level = (h: number) => (h <= 0 ? 0 : h < 0.5 ? 1 : h < 1 ? 2 : h < 2 ? 3 : h < 3.5 ? 4 : 5);
  const padL = 22, padT = 16;
  const cell = Math.max(6, Math.min(14, Math.floor((width - padL) / weeks.length) - 2));
  const step = cell + 2;
  const height = padT + 7 * step;
  const active = weeks.flat().filter((d) => byDate.has(d)).length;

  return (
    <Card title="Aktivitätskalender" subtitle={`${active} aktive Tage in den letzten 12 Monaten · Farbe = Trainingszeit`}>
      <div ref={ref} className="relative w-full overflow-hidden">
        {width > 0 && (
          <svg width={Math.min(width, padL + weeks.length * step)} height={height} role="img" aria-label="Kalender der Trainingstage">
            {monthMarks.map((m) => (
              <text key={`${m.col}-${m.label}`} x={padL + m.col * step} y={10} fontSize={10} fill={INK.muted}>{m.label}</text>
            ))}
            {[0, 2, 4].map((r) => (
              <text key={r} x={0} y={padT + r * step + cell / 2} dy="0.32em" fontSize={9} fill={INK.muted}>{WEEKDAYS_SHORT[r]}</text>
            ))}
            {weeks.map((w, c) => w.map((d, r) => {
              const v = byDate.get(d);
              const cx = padL + c * step, cy = padT + r * step;
              return (
                <rect key={d} x={cx} y={cy} width={cell} height={cell} rx={2} fill={BLUE_RAMP[level(v?.hours ?? 0)]}
                  onPointerEnter={() => setHover({ d, v, x: cx + cell / 2, y: cy })} onPointerLeave={() => setHover(null)} />
              );
            }))}
          </svg>
        )}
        {hover && (
          <Tooltip x={hover.x} y={hover.y + 18} width={width}>
            <p className="font-semibold text-slate-900">{fmtDate(hover.d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>
            <p className="text-slate-600">
              {hover.v ? `${hover.v.count} Aktivität${hover.v.count > 1 ? 'en' : ''} · ${fmtHours(hover.v.hours)}${hover.v.distanceKm > 0 ? ` · ${fmt1(hover.v.distanceKm)} km` : ''}` : 'Ruhetag'}
            </p>
          </Tooltip>
        )}
      </div>
      <div className="flex items-center gap-1 mt-3 text-[11px] text-slate-400" aria-hidden="true">
        weniger {BLUE_RAMP.map((c) => <span key={c} className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: c }} />)} mehr
      </div>
    </Card>
  );
}

// ─── Habits: weekday + time of day ───────────────────────────────────────────

function MiniColumns({ values, labels, labelEvery = 1, ariaLabel, unit }: {
  values: number[]; labels: string[]; labelEvery?: number; ariaLabel: string; unit: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 110, padB = 18, padT = 6;
  const band = width / values.length;
  const barW = Math.min(24, band * 0.7);
  const max = Math.max(1, ...values);
  const plotH = height - padB - padT;
  const best = values.indexOf(Math.max(...values));
  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          <line x1={0} x2={width} y1={padT + plotH} y2={padT + plotH} stroke={INK.axis} />
          {values.map((v, i) => {
            const cx = band * i + band / 2;
            const top = padT + plotH - (v / max) * plotH;
            return (
              <g key={i}>
                <path d={columnPath(cx - barW / 2, top, barW, padT + plotH)} fill={i === best ? '#2a78d6' : '#9ec5f4'} />
                {i % labelEvery === 0 && <text x={cx} y={height - 4} textAnchor="middle" fontSize={10} fill={INK.muted}>{labels[i]}</text>}
                <rect x={band * i} y={0} width={band} height={height} fill="transparent"
                  onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
              </g>
            );
          })}
        </svg>
      )}
      {hover != null && (
        <Tooltip x={band * hover + band / 2} y={0} width={width}>
          <p className="font-semibold text-slate-900">{labels[hover]}{unit}</p>
          <p className="text-slate-600 tabular-nums">{values[hover]} Aktivitäten</p>
        </Tooltip>
      )}
    </div>
  );
}

export function HabitsCard({ stats }: { stats: SportStats }) {
  const c = stats.consistency;
  return (
    <Card title="Gewohnheiten" subtitle={`Ø ${fmt1(c.avgPerWeek12)} Aktivitäten pro Woche (letzte 12 Wochen)`}>
      <p className="text-xs text-slate-500 mb-1">Wochentag</p>
      <MiniColumns values={c.weekdayCounts} labels={WEEKDAYS_SHORT} ariaLabel="Aktivitäten pro Wochentag" unit="" />
      <p className="text-xs text-slate-500 mt-4 mb-1">Startzeit</p>
      <MiniColumns values={c.hourCounts} labels={Array.from({ length: 24 }, (_, h) => `${h}`)} labelEvery={3}
        ariaLabel="Aktivitäten nach Startzeit" unit=" Uhr" />
    </Card>
  );
}

// ─── Records & recent activities ─────────────────────────────────────────────

function recordValue(r: PersonalRecord): string {
  switch (r.kind) {
    case 'DISTANCE': return `${fmt1(r.value / 1000)} km`;
    case 'DURATION': return fmtDuration(r.value);
    case 'ELEVATION': return `${fmt0(r.value)} m`;
    case 'SPEED': return fmtSpeed(r.value, r.category);
  }
}

export function RecordsCard({ records }: { records: PersonalRecord[] }) {
  const cats = CATEGORY_ORDER.filter((c) => records.some((r) => r.category === c));
  const [cat, setCat] = useState(cats[0]);
  if (!cats.length) return null;
  return (
    <Card title="Persönliche Bestwerte"
      action={cats.length > 1 ? (
        <select aria-label="Sportart" value={cat} onChange={(e) => setCat(e.target.value as typeof cat)}
          className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-slate-700">
          {cats.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
        </select>
      ) : undefined}>
      <ul className="divide-y divide-stone-100">
        {records.filter((r) => r.category === cat).map((r) => (
          <li key={r.kind} className="py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-slate-500">{r.label}</p>
              <p className="text-sm text-slate-700 truncate">{r.activityName ?? 'Aktivität'} · {fmtDate(r.date)}</p>
            </div>
            <p className="text-lg font-semibold text-slate-900 tabular-nums shrink-0">{recordValue(r)}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function RecentCard({ recent }: { recent: ActivityItem[] }) {
  return (
    <Card title="Letzte Aktivitäten">
      <ul className="divide-y divide-stone-100">
        {recent.map((a) => (
          <li key={a.id} className="py-2.5 flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CATEGORY_META[a.category].color }} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 truncate">{a.name ?? a.sportType}</p>
              <p className="text-xs text-slate-400">{a.sportType} · {fmtDate(a.start, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <div className="text-right shrink-0 tabular-nums">
              <p className="text-sm font-semibold text-slate-900">{a.distanceKm > 0 ? `${fmt1(a.distanceKm)} km` : fmtHours(a.hours)}</p>
              <p className="text-xs text-slate-400">{a.distanceKm > 0 ? fmtHours(a.hours) : ''}{a.avgHr ? ` · ♥ ${fmt0(a.avgHr)}` : ''}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
