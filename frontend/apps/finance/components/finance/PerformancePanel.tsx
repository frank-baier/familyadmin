'use client';

import { useEffect, useState } from 'react';
import { getPortfolioPerformance } from '@/lib/portfolio';
import type { PortfolioPerformance } from '@/lib/portfolio';

type Preset = '1W' | '1M' | '3M' | '1Y' | 'YTD' | 'ALL' | 'CUSTOM';

const PRESETS: { key: Preset; label: string }[] = [
  { key: '1W', label: '1 Woche' },
  { key: '1M', label: '1 Monat' },
  { key: '3M', label: '3 Monate' },
  { key: '1Y', label: '1 Jahr' },
  { key: 'YTD', label: 'YTD' },
  { key: 'ALL', label: 'Gesamt' },
];

// Far enough back that it never becomes the limiting factor — the backend excludes any
// position without price history reaching this far anyway, so "ALL" just means "as far as we have".
const EPOCH = '2000-01-01';

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function presetToDate(preset: Preset): string {
  const now = new Date();
  switch (preset) {
    case '1W': { const d = new Date(now); d.setDate(d.getDate() - 7); return toISODate(d); }
    case '1M': { const d = new Date(now); d.setMonth(d.getMonth() - 1); return toISODate(d); }
    case '3M': { const d = new Date(now); d.setMonth(d.getMonth() - 3); return toISODate(d); }
    case '1Y': { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return toISODate(d); }
    case 'YTD': return `${now.getFullYear()}-01-01`;
    case 'ALL': return EPOCH;
    default: return EPOCH;
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(`${dateStr}T00:00:00`));
}

export function PerformancePanel({ portfolioId }: { portfolioId: string }) {
  const [preset, setPreset] = useState<Preset>('1M');
  const [customDate, setCustomDate] = useState('');
  const [performance, setPerformance] = useState<PortfolioPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sinceDate = preset === 'CUSTOM' ? (customDate || EPOCH) : presetToDate(preset);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getPortfolioPerformance(portfolioId, sinceDate)
      .then(setPerformance)
      .catch((err) => setError(err instanceof Error ? err.message : 'Wertentwicklung konnte nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, [portfolioId, sinceDate]);

  const isPositive = (performance?.delta ?? 0) >= 0;

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
          max={toISODate(new Date())}
          onChange={(e) => { setCustomDate(e.target.value); setPreset('CUSTOM'); }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
            preset === 'CUSTOM' ? 'border-amber-500 text-amber-700' : 'border-slate-200 text-slate-500'
          }`}
        />
      </div>

      {loading && <div className="h-12 animate-pulse bg-slate-100 rounded-xl" />}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {!loading && !error && performance && (
        performance.includedPositionCount === 0 ? (
          <p className="text-sm text-slate-400">
            Noch keine Kurshistorie für diesen Zeitraum — Preis wird täglich erfasst, ab morgen lassen sich
            erste Zeiträume vergleichen.
          </p>
        ) : (
          <>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className={`text-xl font-bold tabular-nums ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                {isPositive ? '+' : ''}{formatCurrency(performance.delta)}
              </span>
              <span className={`text-sm font-medium tabular-nums ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                ({isPositive ? '+' : ''}{performance.deltaPercent.toFixed(2)}%)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              seit {formatDate(performance.since)} · {performance.includedPositionCount} Position{performance.includedPositionCount !== 1 ? 'en' : ''} berücksichtigt
            </p>
            {performance.excludedPositionCount > 0 && (
              <p className="text-xs text-amber-600 mt-1">
                {performance.excludedPositionCount} Position{performance.excludedPositionCount !== 1 ? 'en' : ''}
                {' '}({performance.excludedTickers.join(', ')}) für diesen Zeitraum ausgeschlossen — neu hinzugekommen
                oder noch keine Kurshistorie so weit zurück. Deren Wert fließt nicht in den Vergleich ein.
              </p>
            )}
          </>
        )
      )}
    </div>
  );
}
