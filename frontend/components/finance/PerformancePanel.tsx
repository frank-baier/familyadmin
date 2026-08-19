'use client';

import { useEffect, useState } from 'react';
import { getPortfolioSnapshots } from '@/lib/portfolio';
import type { PortfolioSnapshot } from '@/lib/portfolio';

type Preset = '1W' | '1M' | '3M' | '1Y' | 'YTD' | 'ALL' | 'CUSTOM';

const PRESETS: { key: Preset; label: string }[] = [
  { key: '1W', label: '1 Woche' },
  { key: '1M', label: '1 Monat' },
  { key: '3M', label: '3 Monate' },
  { key: '1Y', label: '1 Jahr' },
  { key: 'YTD', label: 'YTD' },
  { key: 'ALL', label: 'Gesamt' },
];

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function presetToDate(preset: Preset, earliestDate: string): string {
  const now = new Date();
  switch (preset) {
    case '1W': { const d = new Date(now); d.setDate(d.getDate() - 7); return toISODate(d); }
    case '1M': { const d = new Date(now); d.setMonth(d.getMonth() - 1); return toISODate(d); }
    case '3M': { const d = new Date(now); d.setMonth(d.getMonth() - 3); return toISODate(d); }
    case '1Y': { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return toISODate(d); }
    case 'YTD': return `${now.getFullYear()}-01-01`;
    case 'ALL': return earliestDate;
    default: return earliestDate;
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(`${dateStr}T00:00:00`));
}

export function PerformancePanel({
  portfolioId,
  currentTotalValue,
}: {
  portfolioId: string;
  currentTotalValue: number;
}) {
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<Preset>('1M');
  const [customDate, setCustomDate] = useState('');

  useEffect(() => {
    getPortfolioSnapshots(portfolioId)
      .then(setSnapshots)
      .catch(() => setSnapshots([]))
      .finally(() => setLoading(false));
  }, [portfolioId]);

  if (loading) {
    return <div className="glass rounded-3xl p-5 h-24 animate-pulse" />;
  }

  if (snapshots.length === 0) {
    return (
      <div className="glass rounded-3xl p-5">
        <p className="font-semibold text-slate-900">Wertentwicklung</p>
        <p className="text-sm text-slate-400 mt-1">
          Noch keine Kurshistorie. Ab dem nächsten Kurs-Refresh wird täglich ein Wert gespeichert,
          damit du die Entwicklung über Zeiträume vergleichen kannst.
        </p>
      </div>
    );
  }

  const earliestDate = snapshots[0].date;
  const targetDate = preset === 'CUSTOM' ? (customDate || earliestDate) : presetToDate(preset, earliestDate);

  const baseline = [...snapshots].reverse().find((s) => s.date <= targetDate) ?? snapshots[0];
  const delta = currentTotalValue - baseline.totalValue;
  const deltaPercent = baseline.totalValue !== 0 ? (delta / baseline.totalValue) * 100 : 0;
  const isPositive = delta >= 0;
  const exactMatch = baseline.date === targetDate;

  return (
    <div className="glass rounded-3xl p-5">
      <p className="font-semibold text-slate-900 mb-3">Wertentwicklung</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              preset === p.key
                ? 'bg-amber-500 text-white'
                : 'bg-white/60 text-slate-600 hover:bg-white'
            }`}
          >
            {p.label}
          </button>
        ))}
        <input
          type="date"
          value={customDate}
          min={earliestDate}
          max={toISODate(new Date())}
          onChange={(e) => { setCustomDate(e.target.value); setPreset('CUSTOM'); }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
            preset === 'CUSTOM' ? 'border-amber-500 text-amber-700' : 'border-slate-200 text-slate-500'
          }`}
        />
      </div>

      <div className="flex items-baseline gap-3 flex-wrap">
        <span className={`text-xl font-bold tabular-nums ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
          {isPositive ? '+' : ''}{formatCurrency(delta)}
        </span>
        <span className={`text-sm font-medium tabular-nums ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
          ({isPositive ? '+' : ''}{deltaPercent.toFixed(2)}%)
        </span>
      </div>
      <p className="text-xs text-slate-400 mt-1">
        seit {formatDate(baseline.date)}
        {!exactMatch && ' (ältester verfügbarer Wert für diesen Zeitraum)'}
      </p>
    </div>
  );
}
