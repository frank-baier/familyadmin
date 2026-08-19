'use client';

import { useState } from 'react';
import { deletePosition } from '@/lib/portfolio';
import type { PortfolioPosition } from '@/lib/portfolio';

function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(`${dateStr}T00:00:00`));
}

export function PositionsTable({
  portfolioId,
  positions,
  onChanged,
  canEdit,
}: {
  portfolioId: string;
  positions: PortfolioPosition[];
  onChanged: () => void;
  canEdit: boolean;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(positionId: string) {
    setDeletingId(positionId);
    try {
      await deletePosition(portfolioId, positionId);
      onChanged();
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  }

  if (positions.length === 0) {
    return (
      <div className="glass rounded-3xl p-10 text-center text-slate-500">
        Noch keine Positionen. Importiere eine CSV/XLSX-Datei, um zu starten.
      </div>
    );
  }

  return (
    <div className="glass rounded-3xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100/80">
              <th className="px-4 py-3">Ticker</th>
              <th className="px-4 py-3">Stück</th>
              <th className="px-4 py-3">Kaufpreis</th>
              <th className="px-4 py-3">Kaufdatum</th>
              <th className="px-4 py-3">Kurs</th>
              <th className="px-4 py-3">Wert</th>
              <th className="px-4 py-3">Gewinn/Verlust</th>
              {canEdit && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const isPositive = (p.gainLoss ?? 0) >= 0;
              return (
                <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-white/40">
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {p.ticker}
                    {p.name && <span className="block text-xs text-slate-400 font-normal">{p.name}</span>}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">{p.shares}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">{formatCurrency(p.purchasePrice)}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(p.purchaseDate)}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">{formatCurrency(p.currentPrice)}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-900 font-medium">{formatCurrency(p.currentValue)}</td>
                  <td className={`px-4 py-3 tabular-nums font-medium ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                    {p.gainLoss !== null ? (
                      <>
                        {isPositive ? '+' : ''}{formatCurrency(p.gainLoss)}
                        <span className="block text-xs">
                          {isPositive ? '+' : ''}{p.gainLossPercent?.toFixed(2)}%
                        </span>
                      </>
                    ) : '—'}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deletingId === p.id}
                        aria-label={`Position ${p.ticker} löschen`}
                        className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                            d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
