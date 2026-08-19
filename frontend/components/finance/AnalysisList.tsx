'use client';

import type { PortfolioAnalysis, AnalysisType } from '@/lib/portfolio';

const TYPE_LABELS: Record<AnalysisType, string> = {
  WEEKLY: 'Wöchentlich',
  REBALANCING: 'Rebalancing',
  ON_DEMAND: 'Analyse',
};

function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(dateStr));
}

export function AnalysisList({ analyses }: { analyses: PortfolioAnalysis[] }) {
  if (analyses.length === 0) {
    return (
      <div className="glass rounded-3xl p-10 text-center text-slate-500">
        Noch keine Analyse vorhanden. Klicke auf &bdquo;Jetzt analysieren&ldquo; oder warte auf die
        wöchentliche Analyse (freitags 9 Uhr).
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {analyses.map((a) => (
        <div key={a.id} className="glass rounded-3xl p-5">
          <div className="flex items-center justify-between gap-4 mb-2">
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
              {TYPE_LABELS[a.analysisType]}
            </span>
            <span className="text-xs text-slate-400">{formatDateTime(a.createdAt)}</span>
          </div>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{a.content}</p>
        </div>
      ))}
    </div>
  );
}
