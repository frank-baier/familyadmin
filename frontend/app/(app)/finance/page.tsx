'use client';

/**
 * Finance list page — /finance
 * Grid of portfolio cards with total value + performance, "Depot anlegen" button.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getPortfolios } from '@/lib/portfolio';
import type { Portfolio } from '@/lib/portfolio';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

function PortfolioCardSkeleton() {
  return (
    <div className="glass rounded-3xl p-5 animate-pulse space-y-3">
      <div className="h-4 w-2/3 bg-slate-100 rounded" />
      <div className="h-7 w-1/2 bg-slate-100 rounded" />
      <div className="h-3 w-1/3 bg-slate-50 rounded" />
    </div>
  );
}

function PortfolioCard({ portfolio }: { portfolio: Portfolio }) {
  const isPositive = portfolio.totalGainLoss >= 0;
  return (
    <Link
      href={`/finance/${portfolio.id}`}
      className="glass-interactive rounded-3xl p-5 flex flex-col gap-3 group"
    >
      <div className="flex items-center gap-3">
        <span
          className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            boxShadow: '0 6px 16px rgb(245 158 11 / 0.35)',
          }}
          aria-hidden="true"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M3 13.5l4.5-4.5 4.5 3 6-6M18 6h3v3" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 truncate">{portfolio.name}</p>
          <p className="text-xs text-slate-400">{portfolio.positions.length} Position{portfolio.positions.length !== 1 ? 'en' : ''}</p>
        </div>
      </div>

      <div>
        <p className="text-xl font-bold text-slate-900 tabular-nums">
          {formatCurrency(portfolio.totalCurrentValue)}
        </p>
        <p className={`text-sm font-medium tabular-nums ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
          {isPositive ? '+' : ''}{formatCurrency(portfolio.totalGainLoss)} ({isPositive ? '+' : ''}{portfolio.totalGainLossPercent.toFixed(2)}%)
        </p>
      </div>
    </Link>
  );
}

export default function FinancePage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getPortfolios();
      setPortfolios(data);
    } catch (err) {
      setError('Depots konnten nicht geladen werden. Bitte erneut versuchen.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Finanzen</h1>
          <p className="text-slate-500 text-sm mt-1">Aktiendepots &amp; Performance-Analysen</p>
        </div>

        <Link href="/finance/new" className="btn-primary shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Depot anlegen
        </Link>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6 flex items-center justify-between"
        >
          {error}
          <button onClick={load} className="font-medium underline shrink-0 ml-4">
            Erneut versuchen
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <PortfolioCardSkeleton key={i} />)}
        </div>
      ) : portfolios.length === 0 ? (
        <div className="glass rounded-3xl p-10 text-center">
          <p className="text-slate-500">Noch kein Depot angelegt.</p>
          <Link href="/finance/new" className="btn-primary inline-flex mt-4">
            Erstes Depot anlegen
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {portfolios.map((p) => <PortfolioCard key={p.id} portfolio={p} />)}
        </div>
      )}
    </div>
  );
}
