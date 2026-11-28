'use client';

import { useState } from 'react';
import { searchDocuments, formatFileSize, type SearchHit, type SearchResult } from '@/lib/documents';

const EXAMPLES = ['Fernwärmevertrag', 'Rechnungen Fernwärme', 'Steuerbescheid 2024'];

/** "… der [[Fernwärme]] …" → text with highlighted matches, without injecting HTML. */
function Snippet({ text }: { text: string }) {
  const parts = text.split(/\[\[|\]\]/);
  return (
    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
      …{parts.map((p, i) => (i % 2 === 1
        ? <mark key={i} className="bg-amber-100 text-slate-800 rounded px-0.5">{p}</mark>
        : <span key={i}>{p}</span>))}…
    </p>
  );
}

function path(hit: { category: string | null; subcategory: string | null }) {
  return [hit.category, hit.subcategory].filter(Boolean).join(' › ').replaceAll('/', ' › ');
}

function HitRow({ hit, onOpen, onDownload }: {
  hit: SearchHit;
  onOpen: (url: string) => void;
  onDownload: (url: string) => void;
}) {
  return (
    <div className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50/60">
      <button type="button" onClick={() => onOpen(hit.downloadUrl)} className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium text-slate-800 break-words">{hit.filename}</p>
        <p className="text-xs text-slate-400 mt-0.5 break-words">
          {path(hit) || 'Ohne Ordner'}
          {hit.year && ` · ${hit.year}`}
          {` · ${formatFileSize(hit.fileSize)}`}
        </p>
        {hit.alsoIn.length > 0 && (
          <p className="text-[11px] text-slate-400 mt-0.5 break-words">
            auch in: {hit.alsoIn.map((p) => p.replaceAll('/', ' › ')).join(' · ')}
          </p>
        )}
        {hit.snippet && <Snippet text={hit.snippet} />}
        <div className="flex flex-wrap gap-1 mt-1.5">
          {hit.matchedBy.map((m) => (
            <span key={m} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
              {m}
            </span>
          ))}
        </div>
      </button>
      <button
        type="button"
        onClick={() => onDownload(hit.downloadUrl)}
        className="shrink-0 rounded-lg p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
        aria-label="Herunterladen"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
      </button>
    </div>
  );
}

export default function DocumentSearch({ onActiveChange, onOpen, onDownload }: {
  onActiveChange: (active: boolean) => void;
  onOpen: (url: string) => void;
  onDownload: (url: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(q: string) {
    const text = q.trim();
    if (!text) return;
    setQuery(text);
    setSearching(true);
    setError(null);
    onActiveChange(true);
    try {
      setResult(await searchDocuments(text));
    } catch {
      setError('Suche fehlgeschlagen.');
      setResult(null);
    } finally {
      setSearching(false);
    }
  }

  function clear() {
    setQuery('');
    setResult(null);
    setError(null);
    onActiveChange(false);
  }

  const active = searching || result !== null || error !== null;

  return (
    <div className="mb-6">
      <form
        onSubmit={(e) => { e.preventDefault(); run(query); }}
        className="glass rounded-2xl flex items-center gap-2 px-3 py-2"
      >
        <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (!e.target.value) clear(); }}
          placeholder="Dokumente suchen, z.B. „Fernwärmevertrag“ oder „Rechnungen Fernwärme“"
          className="flex-1 min-w-0 bg-transparent py-1.5 text-base sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
          enterKeyHint="search"
        />
        {active && (
          <button type="button" onClick={clear} className="text-xs text-slate-500 hover:underline shrink-0">
            Zurück
          </button>
        )}
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="rounded-xl bg-amber-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 shrink-0"
        >
          {searching ? 'Suche…' : 'Suchen'}
        </button>
      </form>

      {!active && (
        <div className="flex flex-wrap gap-1.5 mt-2 px-1">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => run(ex)}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50">
              {ex}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {searching && (
        <div className="mt-3 space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="glass rounded-2xl h-14 animate-pulse" />)}
        </div>
      )}

      {result && !searching && (
        <div className="mt-3">
          <p className="text-xs text-slate-500 px-1 mb-2">
            {result.results.length === 0 ? 'Nichts gefunden' : `${result.results.length} Treffer`}
            {result.terms.length > 0 && <> · gesucht nach {result.terms.join(', ')}</>}
            {result.types.length > 0 && <> · Art: {result.types[0]}</>}
            {result.years.length > 0 && <> · Jahr: {result.years.join(', ')}</>}
          </p>
          {result.results.length > 0 && (
            <div className="glass rounded-2xl overflow-hidden divide-y divide-slate-100">
              {result.results.map((hit) => (
                <HitRow key={hit.id} hit={hit} onOpen={onOpen} onDownload={onDownload} />
              ))}
            </div>
          )}
          {result.results.length === 0 && (
            <p className="text-sm text-slate-500 px-1">
              Versuch es mit anderen Worten oder frag die KI unter „KI Fragen“.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
