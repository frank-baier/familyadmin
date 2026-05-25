'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { RecipeCard } from '@/components/recipes/RecipeCard';
import { getRecipes, searchRecipes, importPaprikaFile } from '@/lib/recipes';
import type { Recipe, PaprikaImportResult } from '@/lib/recipes';
import { useUser } from '@/lib/user-context';
import { useViewMode } from '@/lib/use-view-mode';

// ─── Skeleton ────────────────────────────────────────────────────────────────

function RecipeCardSkeleton() {
  return (
    <div className="glass rounded-3xl overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-slate-100" />
      <div className="p-4 space-y-2">
        <div className="h-4 w-3/4 bg-slate-100 rounded" />
        <div className="h-3 w-full bg-slate-50 rounded" />
        <div className="h-3 w-5/6 bg-slate-50 rounded" />
        <div className="flex items-center justify-between pt-1">
          <div className="h-3 w-16 bg-slate-100 rounded" />
          <div className="h-5 w-5 bg-slate-100 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// ─── Star rating display ──────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number | null }) {
  if (!rating || rating <= 0) return <span className="text-slate-300 text-xs">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={`w-3.5 h-3.5 ${i < rating ? 'text-amber-400' : 'text-slate-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

// ─── Table view ───────────────────────────────────────────────────────────────

function RecipeTableView({ recipes }: { recipes: Recipe[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Bewertung</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600">Kategorien</th>
          </tr>
        </thead>
        <tbody>
          {recipes.map((recipe, idx) => (
            <tr
              key={recipe.id}
              className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
            >
              <td className="px-4 py-3">
                <Link
                  href={`/recipes/${recipe.id}`}
                  className="font-medium text-slate-900 hover:text-indigo-600 transition-colors"
                >
                  {recipe.title}
                </Link>
              </td>
              <td className="px-4 py-3">
                <StarRating rating={recipe.rating} />
              </td>
              <td className="px-4 py-3 text-slate-500">
                {recipe.categories
                  ? recipe.categories.split(',').map(c => c.trim()).filter(Boolean).join(', ')
                  : <span className="text-slate-300">—</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RecipesPage() {
  const { sessionReady } = useUser();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextPage, setNextPage] = useState(0);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<PaprikaImportResult[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // View & filter state
  const [viewMode, setViewMode] = useViewMode('recipes');
  const [minRating, setMinRating] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Load a page of recipes and optionally replace the current list
  const loadPage = useCallback(async (pageNum: number, replace: boolean) => {
    if (replace) { setLoading(true); setError(null); }
    else setLoadingMore(true);
    try {
      const data = await getRecipes(pageNum);
      setRecipes(prev => replace ? data.content : [...prev, ...data.content]);
      setNextPage(data.page + 1);
      setHasMore(data.hasNext);
      setIsSearchMode(false);
    } catch (err) {
      setError('Rezepte konnten nicht geladen werden. Bitte erneut versuchen.');
      console.error(err);
    } finally {
      if (replace) setLoading(false);
      else setLoadingMore(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (sessionReady) loadPage(0, true);
  }, [sessionReady, loadPage]);

  // Infinite scroll: stable observer that reads latest state via ref
  const loadMoreRef = useRef<(() => void) | null>(null);
  loadMoreRef.current = () => {
    if (hasMore && !loadingMore && !loading && !isSearchMode) {
      loadPage(nextPage, false);
    }
  };

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMoreRef.current?.(); },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []); // set up once — loadMoreRef always has the latest callback

  // Debounced search
  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const trimmed = value.trim();
      if (trimmed) {
        setLoading(true);
        setError(null);
        try {
          const data = await searchRecipes(trimmed);
          setRecipes(data);
          setHasMore(false);
          setIsSearchMode(true);
        } catch (err) {
          setError('Suche fehlgeschlagen. Bitte erneut versuchen.');
          console.error(err);
        } finally {
          setLoading(false);
        }
      } else {
        loadPage(0, true);
      }
    }, 300);
  }

  async function handlePaprikaImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResults(null);
    setImportError(null);
    try {
      const results = await importPaprikaFile(file);
      setImportResults(results);
      loadPage(0, true);
    } catch (err) {
      setImportError('Import fehlgeschlagen. Bitte Datei prüfen und erneut versuchen.');
      console.error(err);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // Derive unique categories from loaded recipes
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const r of recipes) {
      if (r.categories) {
        r.categories.split(',').forEach(c => {
          const trimmed = c.trim();
          if (trimmed) cats.add(trimmed);
        });
      }
    }
    return Array.from(cats).sort();
  }, [recipes]);

  // Apply filters client-side to whatever is loaded
  const filteredRecipes = useMemo(() => {
    return recipes.filter(r => {
      if (minRating > 0 && (r.rating == null || r.rating < minRating)) return false;
      if (selectedCategory) {
        const cats = r.categories ? r.categories.split(',').map(c => c.trim()) : [];
        if (!cats.includes(selectedCategory)) return false;
      }
      return true;
    });
  }, [recipes, minRating, selectedCategory]);

  const isEmpty = !loading && filteredRecipes.length === 0;
  const hasFilters = minRating > 0 || selectedCategory !== '';

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Rezepte</h1>
          <p className="text-slate-500 text-sm mt-1">Familienrezeptsammlung</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="btn-secondary shrink-0"
          >
            {importing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 010 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z"/>
                </svg>
                Wird importiert…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Paprika importieren
              </>
            )}
          </button>

          <Link href="/recipes/new" className="btn-primary shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Rezept hinzufügen
          </Link>
        </div>
      </div>

      {/* Paprika import result panel */}
      {(importResults !== null || importError !== null) && (
        <div className={`rounded-xl border px-4 py-3 mb-6 text-sm ${
          importError
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-green-50 border-green-200 text-green-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className="font-medium">
              {importError
                ? importError
                : `Import abgeschlossen: ${importResults!.filter(r => r.status === 'success').length} Rezept(e) importiert`
              }
            </span>
            <button
              onClick={() => { setImportResults(null); setImportError(null); }}
              className="ml-4 text-xs underline hover:no-underline"
              aria-label="Importergebnis schließen"
            >
              Schließen
            </button>
          </div>
          {importResults && importResults.some(r => r.status === 'error') && (
            <ul className="mt-2 space-y-1 list-disc list-inside text-red-700">
              {importResults.filter(r => r.status === 'error').map((r, i) => (
                <li key={i}>{r.title}: {r.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Toolbar: search + filters + view toggle */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 pl-4 flex items-center" aria-hidden="true">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <input
            type="search"
            value={query}
            onChange={handleSearchChange}
            placeholder="Rezepte suchen…"
            aria-label="Rezepte suchen"
            className="input-field pl-10"
          />
        </div>

        {/* Category filter */}
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          aria-label="Nach Kategorie filtern"
          className="input-field shrink-0 w-auto px-3"
        >
          <option value="">Alle Kategorien</option>
          {allCategories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        {/* Min rating filter */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-slate-500 whitespace-nowrap">Min. Bewertung:</span>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onClick={() => setMinRating(minRating === star ? 0 : star)}
                aria-label={`Mindestens ${star} Stern${star !== 1 ? 'e' : ''}`}
                className="focus:outline-none focus:ring-1 focus:ring-indigo-400 rounded"
              >
                <svg
                  className={`w-5 h-5 transition-colors ${star <= minRating ? 'text-amber-400' : 'text-slate-200 hover:text-amber-200'}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </button>
            ))}
          </div>
          {minRating > 0 && (
            <button
              onClick={() => setMinRating(0)}
              className="text-xs text-slate-400 hover:text-slate-600 ml-1"
              aria-label="Bewertungsfilter zurücksetzen"
            >
              ✕
            </button>
          )}
        </div>

        {/* View toggle */}
        <div className="glass flex rounded-2xl overflow-hidden shrink-0" role="group" aria-label="Ansichtsmodus">
          <button
            onClick={() => setViewMode('grid')}
            aria-pressed={viewMode === 'grid'}
            className={`px-3 py-2 transition-colors ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
            title="Rasteransicht"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('table')}
            aria-pressed={viewMode === 'table'}
            className={`px-3 py-2 transition-colors ${viewMode === 'table' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
            title="Tabellenansicht"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 10h18M3 14h18M10 3v18M14 3v18M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Active filters summary */}
      {hasFilters && !loading && (
        <p className="text-xs text-slate-500 mb-4">
          {filteredRecipes.length} von {recipes.length} geladenen Rezepten
          {minRating > 0 && ` · ${minRating}+ Sterne`}
          {selectedCategory && ` · "${selectedCategory}"`}
          {' '}
          <button onClick={() => { setMinRating(0); setSelectedCategory(''); }} className="underline hover:no-underline">
            Filter zurücksetzen
          </button>
        </p>
      )}

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6 flex items-center justify-between"
        >
          {error}
          <button
            onClick={() => loadPage(0, true)}
            className="ml-4 text-xs font-medium text-red-700 underline hover:no-underline"
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {/* Initial loading skeleton */}
      {loading && viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <RecipeCardSkeleton key={i} />)}
        </div>
      )}
      {loading && viewMode === 'table' && (
        <div className="rounded-xl border border-slate-200 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4 px-4 py-3 border-b border-slate-100">
              <div className="h-4 bg-slate-100 rounded w-1/3" />
              <div className="h-4 bg-slate-100 rounded w-24" />
              <div className="h-4 bg-slate-100 rounded w-1/4" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, #fde68a, #fb923c)' }} aria-hidden="true">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-1.5-.75M3 16.5v-2.625a4.125 4.125 0 014.125-4.125h9.75A4.125 4.125 0 0121 13.875V16.5" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            {query.trim()
              ? `Keine Rezepte gefunden für "${query.trim()}"`
              : hasFilters
              ? 'Keine Rezepte entsprechen den aktuellen Filtern'
              : 'Noch keine Rezepte'}
          </h3>
          <p className="text-sm text-slate-500 mb-6 max-w-xs mx-auto">
            {query.trim() || hasFilters
              ? 'Suche oder Filter anpassen.'
              : 'Fang an, das Familienkochbuch aufzubauen!'}
          </p>
          {!query.trim() && !hasFilters && (
            <Link
              href="/recipes/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                         bg-indigo-600 text-white hover:bg-indigo-700
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                         transition-all duration-150"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Erstes Rezept hinzufügen
            </Link>
          )}
        </div>
      )}

      {/* Recipe grid */}
      {!loading && !isEmpty && viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}

      {/* Recipe table */}
      {!loading && !isEmpty && viewMode === 'table' && (
        <RecipeTableView recipes={filteredRecipes} />
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-1" aria-hidden="true" />

      {/* Loading more indicator */}
      {loadingMore && (
        <div className="flex justify-center py-8">
          <svg className="w-6 h-6 text-indigo-400 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 010 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
          </svg>
        </div>
      )}

      {/* Hidden file input for Paprika import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".paprikarecipes"
        className="hidden"
        onChange={handlePaprikaImport}
        aria-hidden="true"
      />
    </div>
  );
}
