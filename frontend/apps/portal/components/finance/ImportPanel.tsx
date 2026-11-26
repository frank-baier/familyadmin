'use client';

import { useRef, useState } from 'react';
import { importPortfolioFile } from '@/lib/portfolio';
import type { Portfolio } from '@/lib/portfolio';

export function ImportPanel({
  portfolioId,
  onImported,
}: {
  portfolioId: string;
  onImported: (portfolio: Portfolio) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [lastImportedCount, setLastImportedCount] = useState<number | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setWarnings([]);
    setLastImportedCount(null);
    try {
      const result = await importPortfolioFile(portfolioId, file);
      setWarnings(result.warnings);
      setLastImportedCount(result.importedCount);
      onImported(result.portfolio);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import fehlgeschlagen.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="font-semibold text-slate-900">Portfolio importieren</p>
          <p className="text-xs text-slate-400 mt-0.5">
            CSV oder XLSX mit Spalten: ticker, shares, purchase_price, purchase_date
          </p>
        </div>
        <label className="btn-secondary cursor-pointer shrink-0">
          {uploading ? 'Wird importiert…' : 'Datei auswählen'}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>
      )}

      {lastImportedCount !== null && !error && (
        <p className="text-sm text-emerald-600 mt-3">
          {lastImportedCount} Position{lastImportedCount !== 1 ? 'en' : ''} importiert.
        </p>
      )}

      {warnings.length > 0 && (
        <ul className="text-xs text-amber-600 mt-2 space-y-0.5 list-disc list-inside">
          {warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}
    </div>
  );
}
