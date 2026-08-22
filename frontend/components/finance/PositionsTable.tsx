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
  purchaseCurrency: string;
  purchaseDate: string;
}

const CURRENCIES = ['EUR', 'USD', 'CHF', 'GBP', 'JPY', 'CAD', 'AUD'];

type SortColumn = 'ticker' | 'shares' | 'purchasePrice' | 'purchaseDate' | 'currentPrice' | 'currentValue' | 'gainLoss';
type SortDirection = 'asc' | 'desc';

const SORT_ACCESSORS: Record<SortColumn, (p: PortfolioPosition) => string | number | null> = {
  ticker: (p) => p.ticker,
  shares: (p) => p.shares,
  purchasePrice: (p) => p.purchasePrice,
  purchaseDate: (p) => p.purchaseDate,
  currentPrice: (p) => p.currentPrice,
  currentValue: (p) => p.currentValue,
  gainLoss: (p) => p.gainLoss,
};

function sortPositions(positions: PortfolioPosition[], column: SortColumn, direction: SortDirection): PortfolioPosition[] {
  const accessor = SORT_ACCESSORS[column];
  const factor = direction === 'asc' ? 1 : -1;
  return [...positions].sort((a, b) => {
    const va = accessor(a);
    const vb = accessor(b);
    if (va === null && vb === null) return 0;
    if (va === null) return 1; // nulls always last, regardless of direction
    if (vb === null) return -1;
    if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb) * factor;
    return ((va as number) - (vb as number)) * factor;
  });
}

function SortableHeader({
  column,
  activeColumn,
  direction,
  onSort,
  children,
}: {
  column: SortColumn;
  activeColumn: SortColumn | null;
  direction: SortDirection;
  onSort: (column: SortColumn) => void;
  children: React.ReactNode;
}) {
  return (
    <th className="px-4 py-3">
      <button
        onClick={() => onSort(column)}
        className="flex items-center gap-1 hover:text-slate-700 transition-colors"
      >
        {children}
        <SortIcon direction={activeColumn === column ? direction : null} />
      </button>
    </th>
  );
}

function SortIcon({ direction }: { direction: SortDirection | null }) {
  if (!direction) {
    return (
      <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
      </svg>
    );
  }
  return direction === 'asc' ? (
    <svg className="w-3 h-3 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.5 15.75l7.5-7.5 7.5 7.5" />
    </svg>
  ) : (
    <svg className="w-3 h-3 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
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
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }

  const sortedPositions = sortColumn ? sortPositions(positions, sortColumn, sortDirection) : positions;

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
      purchaseCurrency: 'EUR', // stored purchasePrice is already EUR; only change this if entering a new raw foreign-currency number
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
        purchaseCurrency: editState.purchaseCurrency,
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
              <SortableHeader column="ticker" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort}>Ticker</SortableHeader>
              <SortableHeader column="shares" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort}>Stück</SortableHeader>
              <SortableHeader column="purchasePrice" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort}>Kaufpreis</SortableHeader>
              <SortableHeader column="purchaseDate" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort}>Kaufdatum</SortableHeader>
              <SortableHeader column="currentPrice" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort}>Kurs</SortableHeader>
              <SortableHeader column="currentValue" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort}>Wert</SortableHeader>
              <SortableHeader column="gainLoss" activeColumn={sortColumn} direction={sortDirection} onSort={handleSort}>Gewinn/Verlust</SortableHeader>
              {canEdit && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {sortedPositions.map((p) => {
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
                      <div className="flex gap-1">
                        <input
                          type="number" step="any" min="0"
                          value={editState.purchasePrice}
                          onChange={(e) => setEditState({ ...editState, purchasePrice: e.target.value })}
                          className="input-field py-1.5 text-sm w-16"
                        />
                        <select
                          value={editState.purchaseCurrency}
                          onChange={(e) => setEditState({ ...editState, purchaseCurrency: e.target.value })}
                          className="input-field py-1.5 text-sm w-20"
                        >
                          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
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
                    <span className="inline-flex items-center gap-1.5">
                      {p.ticker}
                      {p.currency !== 'EUR' && (
                        <span
                          title={`Kurs in ${p.currency}, für Wert/Vergleich in EUR umgerechnet`}
                          className="text-[0.625rem] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700"
                        >
                          {p.currency}→EUR
                        </span>
                      )}
                    </span>
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
