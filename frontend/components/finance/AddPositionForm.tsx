'use client';

import { useState } from 'react';
import { addPosition } from '@/lib/portfolio';
import type { Portfolio } from '@/lib/portfolio';

export function AddPositionForm({
  portfolioId,
  onAdded,
}: {
  portfolioId: string;
  onAdded: (portfolio: Portfolio) => void;
}) {
  const [ticker, setTicker] = useState('');
  const [name, setName] = useState('');
  const [shares, setShares] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ticker.trim() || !shares || !purchasePrice || !purchaseDate) {
      setError('Ticker, Stück, Kaufpreis und Kaufdatum sind erforderlich.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const updated = await addPosition(portfolioId, {
        ticker: ticker.trim(),
        name: name.trim() || undefined,
        shares: Number(shares),
        purchasePrice: Number(purchasePrice),
        purchaseDate,
      });
      onAdded(updated);
      setTicker('');
      setName('');
      setShares('');
      setPurchasePrice('');
      setPurchaseDate('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Position konnte nicht hinzugefügt werden.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="glass rounded-3xl p-5">
      <p className="font-semibold text-slate-900 mb-1">Position manuell hinzufügen</p>
      <p className="text-xs text-slate-400 mb-4">Für einzelne Symbole, ohne Datei-Import.</p>

      <form onSubmit={handleSubmit} className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <input
          type="text"
          placeholder="Ticker*"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          className="input-field col-span-2 sm:col-span-1"
        />
        <input
          type="text"
          placeholder="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input-field col-span-2 sm:col-span-1"
        />
        <input
          type="number"
          step="any"
          min="0"
          placeholder="Stück*"
          value={shares}
          onChange={(e) => setShares(e.target.value)}
          className="input-field"
        />
        <input
          type="number"
          step="any"
          min="0"
          placeholder="Kaufpreis*"
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
          className="input-field"
        />
        <input
          type="date"
          value={purchaseDate}
          onChange={(e) => setPurchaseDate(e.target.value)}
          className="input-field"
        />
        <div className="col-span-2 sm:col-span-5">
          <button type="submit" disabled={submitting} className="btn-secondary">
            {submitting ? 'Wird hinzugefügt…' : 'Position hinzufügen'}
          </button>
        </div>
      </form>

      {error && <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  );
}
