'use client';

/**
 * Portfolio detail page — /finance/[id]
 * - Summary header: total value, gain/loss
 * - Import panel (CSV/XLSX upload)
 * - Positions table
 * - Analyses list + "Jetzt analysieren" / "Kurse aktualisieren" actions
 */

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getPortfolio, deletePortfolio, refreshPrices, runAnalysis } from '@/lib/portfolio';
import { getCurrentUser } from '@/lib/auth';
import { ImportPanel } from '@/components/finance/ImportPanel';
import { AddPositionForm } from '@/components/finance/AddPositionForm';
import { PositionsTable } from '@/components/finance/PositionsTable';
import { AnalysisList } from '@/components/finance/AnalysisList';
import { SharePanel } from '@/components/finance/SharePanel';
import { PerformancePanel } from '@/components/finance/PerformancePanel';
import type { Portfolio } from '@/lib/portfolio';
import type { User } from '@/lib/auth';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

function PortfolioDetailSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="glass rounded-3xl p-6 h-32" />
      <div className="glass rounded-3xl p-6 h-24" />
      <div className="glass rounded-3xl p-6 h-48" />
    </div>
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PortfolioDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [portfolioData, userData] = await Promise.all([getPortfolio(id), getCurrentUser()]);
      setPortfolio(portfolioData);
      setCurrentUser(userData);
      setLoading(false);

      // Auto-refresh prices on every visit so the page never shows stale data —
      // only possible for the owner/admin (view-only shared users just see the last refresh).
      const canEditNow = userData?.role === 'ADMIN' || portfolioData.createdBy.id === userData?.id;
      if (canEditNow) {
        refreshPrices(id).then(setPortfolio).catch(() => {});
      }
    } catch {
      setError('Depot nicht gefunden oder kein Zugriff.');
      setLoading(false);
    }
  }

  async function handleRefreshPrices() {
    if (!portfolio) return;
    setRefreshing(true);
    setActionError(null);
    try {
      const updated = await refreshPrices(portfolio.id);
      setPortfolio(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Kurse konnten nicht aktualisiert werden.');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleAnalyze() {
    if (!portfolio) return;
    setAnalyzing(true);
    setActionError(null);
    try {
      await runAnalysis(portfolio.id, 'ON_DEMAND');
      const updated = await getPortfolio(portfolio.id);
      setPortfolio(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Analyse fehlgeschlagen.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleDelete() {
    if (!portfolio || deleting) return;
    setDeleting(true);
    try {
      await deletePortfolio(portfolio.id);
      router.push('/finance');
    } catch {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  if (loading) {
    return <div className="max-w-4xl mx-auto"><PortfolioDetailSkeleton /></div>;
  }

  if (error || !portfolio) {
    return (
      <div className="max-w-4xl mx-auto">
        <Link href="/finance" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-8">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Zurück zu Finanzen
        </Link>
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-red-700 text-sm">
          {error ?? 'Depot nicht gefunden.'}
        </div>
      </div>
    );
  }

  const isPositive = portfolio.totalGainLoss >= 0;
  const canEdit = !currentUser || currentUser.role === 'ADMIN' || portfolio.createdBy.id === currentUser.id;

  const gainSinceYesterday = portfolio.positions.reduce(
    (sum, p) => sum + (p.gainLossSinceYesterday ?? 0),
    0,
  );
  const valueYesterday = portfolio.totalCurrentValue - gainSinceYesterday;
  const gainSinceYesterdayPercent = valueYesterday !== 0 ? (gainSinceYesterday / valueYesterday) * 100 : 0;
  const isPositiveSinceYesterday = gainSinceYesterday >= 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/finance" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Zurück zu Finanzen
      </Link>

      {/* Summary header */}
      <div className="glass rounded-3xl px-6 py-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{portfolio.name}</h1>
            <p className="text-slate-400 text-xs mt-1">Erstellt von {portfolio.createdBy.name}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{formatCurrency(portfolio.totalCurrentValue)}</p>
            <p className={`text-sm font-medium tabular-nums ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
              {isPositive ? '+' : ''}{formatCurrency(portfolio.totalGainLoss)} ({isPositive ? '+' : ''}{portfolio.totalGainLossPercent.toFixed(2)}%)
            </p>
            <p className={`text-xs font-medium tabular-nums mt-0.5 ${isPositiveSinceYesterday ? 'text-emerald-600/80' : 'text-red-600/80'}`}>
              {isPositiveSinceYesterday ? '+' : ''}{formatCurrency(gainSinceYesterday)} ({isPositiveSinceYesterday ? '+' : ''}{gainSinceYesterdayPercent.toFixed(2)}%) seit gestern
            </p>
          </div>
        </div>

        {canEdit && (
          <div className="flex flex-wrap gap-3 mt-5">
            <button onClick={handleRefreshPrices} disabled={refreshing} className="btn-secondary">
              {refreshing ? 'Kurse werden aktualisiert…' : 'Kurse aktualisieren'}
            </button>
            <button onClick={handleAnalyze} disabled={analyzing} className="btn-primary">
              {analyzing ? 'Analyse läuft…' : 'Jetzt analysieren'}
            </button>
          </div>
        )}

        {actionError && (
          <p role="alert" className="text-sm text-red-600 mt-3">{actionError}</p>
        )}
      </div>

      {/* Positions — the portfolio itself, front and center */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Positionen</h2>
        <PositionsTable
          portfolioId={portfolio.id}
          positions={portfolio.positions}
          onChanged={() => getPortfolio(portfolio.id).then(setPortfolio)}
          canEdit={canEdit}
        />
      </div>

      {/* Performance over time */}
      <PerformancePanel portfolioId={portfolio.id} />

      {/* Analyses */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Analysen</h2>
        <AnalysisList analyses={portfolio.analyses} />
      </div>

      {/* Manual add */}
      {canEdit && <AddPositionForm portfolioId={portfolio.id} onAdded={setPortfolio} />}

      {/* Import */}
      {canEdit && <ImportPanel portfolioId={portfolio.id} onImported={setPortfolio} />}

      {/* Sharing — management actions live below the portfolio itself */}
      {canEdit && <SharePanel portfolio={portfolio} onChanged={setPortfolio} />}

      {/* Delete */}
      {canEdit && (
        <div className="glass rounded-3xl px-6 py-4 flex justify-end">
          {showDeleteConfirm ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600">Dieses Depot löschen?</span>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg transition-all duration-150"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-60 transition-all duration-150"
              >
                {deleting ? 'Wird gelöscht…' : 'Ja, löschen'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
            >
              Depot löschen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
