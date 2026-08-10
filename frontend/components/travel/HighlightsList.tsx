'use client';

import { useState, useEffect } from 'react';
import { getHighlights, deleteHighlight } from '@/lib/travel-highlights';
import type { LocationHighlights, HighlightItem } from '@/lib/travel-highlights';

const CATEGORY_COLOR: Record<string, string> = {
  Natur:    'bg-emerald-100 text-emerald-700',
  Strand:   'bg-sky-100 text-sky-700',
  Stadt:    'bg-slate-100 text-slate-600',
  Essen:    'bg-orange-100 text-orange-700',
  Kultur:   'bg-violet-100 text-violet-700',
  Abenteuer:'bg-rose-100 text-rose-700',
  Sport:    'bg-indigo-100 text-indigo-700',
  Tierwelt: 'bg-teal-100 text-teal-700',
};

function CategoryBadge({ category }: { category: string }) {
  const cls = CATEGORY_COLOR[category] ?? 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>
      {category}
    </span>
  );
}

function HighlightCard({ item }: { item: HighlightItem }) {
  return (
    <div className="flex gap-3 py-3">
      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-2" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800">{item.name}</span>
          <CategoryBadge category={item.category} />
        </div>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.description}</p>
      </div>
    </div>
  );
}

function formatDateRange(checkIn: string | null, checkOut: string | null): string | null {
  if (!checkIn && !checkOut) return null;
  if (checkIn && checkOut) {
    // Both DD.MM.YYYY — show "DD.MM. – DD.MM.YY"
    const inParts  = checkIn.split('.');
    const outParts = checkOut.split('.');
    const sameYear = inParts[2] === outParts[2];
    return `${inParts[0]}.${inParts[1]}.${sameYear ? '' : inParts[2] + ' '}– ${outParts[0]}.${outParts[1]}.${outParts[2].slice(2)}`;
  }
  return checkIn ?? checkOut ?? null;
}

function LocationSection({
  loc,
  onRefresh,
}: {
  loc: LocationHighlights;
  onRefresh: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const dateRange = formatDateRange(loc.checkIn, loc.checkOut);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/80 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-400"
      >
        <svg
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-700 truncate">{loc.location}</div>
          {dateRange && <div className="text-[11px] text-slate-400 font-mono">{dateRange}</div>}
        </div>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onRefresh(loc.id); }}
          title="Neu generieren"
          className="p-1 rounded-lg text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-400"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 divide-y divide-slate-50">
          {loc.highlights.map((item, i) => <HighlightCard key={i} item={item} />)}
        </div>
      )}
    </div>
  );
}

interface HighlightsListProps {
  tripId: string;
}

export function HighlightsList({ tripId }: HighlightsListProps) {
  const [locations, setLocations] = useState<LocationHighlights[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  useEffect(() => { load(); }, [tripId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setLocations(await getHighlights(tripId));
    } catch {
      setError('Highlights konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh(highlightId: string) {
    setRefreshingId(highlightId);
    try {
      await deleteHighlight(tripId, highlightId);
      setLocations(await getHighlights(tripId));
    } catch {
      // ignore
    } finally {
      setRefreshingId(null);
    }
  }

  if (loading || refreshingId) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <svg className="w-4 h-4 animate-spin text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          {loading ? 'Highlights werden generiert… (kann beim ersten Mal etwas dauern)' : 'Wird neu generiert…'}
        </div>
        {[1, 2, 3].map(n => <div key={n} className="h-16 bg-slate-100 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-2xl bg-red-50/80 border border-red-200/60 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
        {error}
        <button onClick={load} className="ml-4 text-xs font-medium underline hover:no-underline">Erneut versuchen</button>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <p className="text-sm text-slate-400 italic text-center py-8">
        Keine Unterkünfte mit Highlights gefunden. Füge Unterkünfte mit Check-in/Check-out unter Wichtige Infos hinzu.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {locations.map(loc => (
        <LocationSection key={loc.id} loc={loc} onRefresh={handleRefresh} />
      ))}
    </div>
  );
}
