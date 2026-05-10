'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useUser } from '@/lib/user-context';
import { useRouter } from 'next/navigation';

interface PhotoStats {
  total: number;
  withPhoto: number;
  withoutPhoto: number;
  missingRecipes: { id: string; title: string }[];
}

interface FetchResult {
  updated: number;
  failed: number;
}

export default function RecipePhotosPage() {
  const { user } = useUser();
  const router = useRouter();
  const [stats, setStats] = useState<PhotoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<FetchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== 'ADMIN') router.replace('/dashboard');
  }, [user, router]);

  async function loadStats() {
    try {
      const data = await apiFetch<PhotoStats>('/api/admin/recipes/photo-stats');
      setStats(data);
    } catch {
      setError('Statistiken konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStats(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFetch() {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const data = await apiFetch<FetchResult>('/api/admin/recipes/fetch-photos', { method: 'POST' });
      setResult(data);
      await loadStats();
    } catch {
      setError('Download fehlgeschlagen. Bitte prüfe die Logs.');
    } finally {
      setRunning(false);
    }
  }

  const coveragePct = stats && stats.total > 0
    ? Math.round((stats.withPhoto / stats.total) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        Wird geladen…
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Rezept-Fotos</h1>
          <p className="text-sm text-slate-500 mt-1">
            Automatischer Foto-Download via Unsplash für Rezepte ohne Bild.
          </p>
        </div>
        <button
          onClick={handleFetch}
          disabled={running || stats?.withoutPhoto === 0}
          className="btn-primary shrink-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {running ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Lädt…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Download starten
            </>
          )}
        </button>
      </div>

      {/* Feedback */}
      {running && (
        <div className="px-4 py-3 rounded-2xl bg-amber-50/80 text-amber-700 text-sm border border-amber-200/60">
          Fotos werden heruntergeladen — bis zu 2 Sek. pro Rezept, bitte warten…
        </div>
      )}
      {result && (
        <div className="px-4 py-3 rounded-2xl bg-emerald-50/80 text-emerald-700 text-sm border border-emerald-200/60">
          {result.updated} {result.updated === 1 ? 'Foto' : 'Fotos'} heruntergeladen
          {result.failed > 0 && ` · ${result.failed} fehlgeschlagen`}
        </div>
      )}
      {error && (
        <div className="px-4 py-3 rounded-2xl bg-red-50/80 text-red-700 text-sm border border-red-200/60">
          {error}
        </div>
      )}

      {/* Stats cards */}
      {stats && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="glass rounded-2xl px-4 py-4 text-center">
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-xs text-slate-500 mt-0.5">Rezepte gesamt</p>
            </div>
            <div className="glass rounded-2xl px-4 py-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{stats.withPhoto}</p>
              <p className="text-xs text-slate-500 mt-0.5">Mit Foto</p>
            </div>
            <div className="glass rounded-2xl px-4 py-4 text-center">
              <p className="text-2xl font-bold text-amber-500">{stats.withoutPhoto}</p>
              <p className="text-xs text-slate-500 mt-0.5">Ohne Foto</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="glass rounded-2xl px-5 py-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">Abdeckung</span>
              <span className="font-bold text-slate-900">{coveragePct}%</span>
            </div>
            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${coveragePct}%`,
                  background: coveragePct === 100
                    ? 'linear-gradient(90deg, #10b981, #059669)'
                    : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                }}
              />
            </div>
          </div>

          {/* Missing recipes list */}
          {stats.missingRecipes.length > 0 && (
            <div className="glass rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100/80">
                <p className="text-sm font-semibold text-slate-700">
                  Ohne Foto ({stats.missingRecipes.length})
                </p>
              </div>
              <ul>
                {stats.missingRecipes.map((r, idx) => (
                  <li
                    key={r.id}
                    className={[
                      'flex items-center gap-3 px-5 py-3 text-sm text-slate-700',
                      idx < stats.missingRecipes.length - 1 ? 'border-b border-slate-100/60' : '',
                    ].join(' ')}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" aria-hidden="true" />
                    {r.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {stats.withoutPhoto === 0 && (
            <div className="px-4 py-3 rounded-2xl bg-emerald-50/80 text-emerald-700 text-sm border border-emerald-200/60 text-center">
              Alle Rezepte haben ein Foto.
            </div>
          )}
        </>
      )}
    </div>
  );
}
