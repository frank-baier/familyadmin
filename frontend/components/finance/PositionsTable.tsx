'use client';

import { useState } from 'react';
import { deletePosition, updatePosition } from '@/lib/portfolio';
import type { PortfolioPosition } from '@/lib/portfolio';

function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(`${dateStr}T00:00:00`));
}

interface EditState {
  ticker: string;
  name: string;
  shares: string;
  purchasePrice: string;
  purchaseDate: string;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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

  function startEdit(p: PortfolioPosition) {
    setEditingId(p.id);
    setEditError(null);
    setEditState({
      ticker: p.ticker,
      name: p.name ?? '',
      shares: String(p.shares),
      purchasePrice: String(p.purchasePrice),
      purchaseDate: p.purchaseDate,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditState(null);
    setEditError(null);
  }

  async function saveEdit(positionId: string) {
    if (!editState) return;
    if (!editState.ticker.trim() || !editState.shares || !editState.purchasePrice || !editState.purchaseDate) {
      setEditError('Ticker, Stück, Kaufpreis und Kaufdatum sind erforderlich.');
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      await updatePosition(portfolioId, positionId, {
        ticker: editState.ticker.trim(),
        name: editState.name.trim() || undefined,
        shares: Number(editState.shares),
        purchasePrice: Number(editState.purchasePrice),
        purchaseDate: editState.purchaseDate,
      });
      cancelEdit();
      onChanged();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
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
              const isEditing = editingId === p.id;

              if (isEditing && editState) {
                return (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0 bg-amber-50/40">
                    <td className="px-4 py-2">
                      <input
                        value={editState.ticker}
                        onChange={(e) => setEditState({ ...editState, ticker: e.target.value })}
                        className="input-field py-1.5 text-sm w-24"
                      />
                      <input
                        value={editState.name}
                        onChange={(e) => setEditState({ ...editState, name: e.target.value })}
                        placeholder="Name (optional)"
                        className="input-field py-1.5 text-xs w-full mt-1"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number" step="any" min="0"
                        value={editState.shares}
                        onChange={(e) => setEditState({ ...editState, shares: e.target.value })}
                        className="input-field py-1.5 text-sm w-20"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number" step="any" min="0"
                        value={editState.purchasePrice}
                        onChange={(e) => setEditState({ ...editState, purchasePrice: e.target.value })}
                        className="input-field py-1.5 text-sm w-24"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="date"
                        value={editState.purchaseDate}
                        onChange={(e) => setEditState({ ...editState, purchaseDate: e.target.value })}
                        className="input-field py-1.5 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-400" colSpan={2}>
                      Kurs/Wert werden beim nächsten Refresh aktualisiert
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => saveEdit(p.id)}
                          disabled={saving}
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                        >
                          {saving ? 'Speichern…' : 'Speichern'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={saving}
                          className="text-xs font-medium text-slate-400 hover:text-slate-600"
                        >
                          Abbrechen
                        </button>
                      </div>
                      {editError && <p role="alert" className="text-xs text-red-600 mt-1">{editError}</p>}
                    </td>
                  </tr>
                );
              }

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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEdit(p)}
                          aria-label={`Position ${p.ticker} bearbeiten`}
                          className="text-slate-300 hover:text-amber-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                          </svg>
                        </button>
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
                      </div>
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
