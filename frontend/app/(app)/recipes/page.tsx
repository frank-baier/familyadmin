'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { RecipeCard } from '@/components/recipes/RecipeCard';
import { EditableStarRating } from '@/components/recipes/EditableStarRating';
import { getRecipes, searchRecipes, importPaprikaFile, importFromUrl, updateRecipeRating, deleteRecipe } from '@/lib/recipes';
import type { Recipe, PaprikaImportResult, UrlImportResult } from '@/lib/recipes';
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

// ─── Table view ───────────────────────────────────────────────────────────────

interface RecipeTableViewProps {
  recipes: Recipe[];
  selectMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onRatingChange: (id: string, rating: number | null) => void | Promise<void>;
}

function RecipeTableView({ recipes, selectMode, selectedIds, onToggleSelect, onRatingChange }: RecipeTableViewProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {selectMode && <th className="px-4 py-3 w-10" aria-label="Auswahl" />}
            <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Bewertung</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600">Kategorien</th>
          </tr>
        </thead>
        <tbody>
          {recipes.map((recipe, idx) => (
            <tr
              key={recipe.id}
              onClick={() => selectMode && onToggleSelect(recipe.id)}
              className={`border-b border-slate-100 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                         ${selectMode ? 'cursor-pointer' : 'hover:bg-slate-50'}
                         ${selectedIds.has(recipe.id) ? 'bg-indigo-50/70' : ''}`}
            >
              {selectMode && (
                <td className="px-4 py-3">
                  <span
                    className={`flex items-center justify-center w-5 h-5 rounded border-2 transition-colors
                               ${selectedIds.has(recipe.id) ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}
                    aria-hidden="true"
                  >
                    {selectedIds.has(recipe.id) && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </span>
                </td>
              )}
              <td className="px-4 py-3">
                {selectMode ? (
                  <span className="font-medium text-slate-900">{recipe.title}</span>
                ) : (
                  <Link
                    href={`/recipes/${recipe.id}`}
                    className="font-medium text-slate-900 hover:text-indigo-600 transition-colors"
                  >
                    {recipe.title}
                  </Link>
                )}
              </td>
              <td className="px-4 py-3">
                <EditableStarRating
                  rating={recipe.rating}
                  onChange={(rating) => onRatingChange(recipe.id, rating)}
                  disabled={selectMode}
                />
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
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState('');
  const [importingUrl, setImportingUrl] = useState(false);
  const [urlImportResult, setUrlImportResult] = useState<UrlImportResult | null>(null);
  const [urlImportError, setUrlImportError] = useState<string | null>(null);

  // View & filter state
  const [viewMode, setViewMode] = useViewMode('recipes');
  const [minRating, setMinRating] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Multiselect state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

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

  async function handleUrlImport() {
    const trimmed = urlInputValue.trim();
    if (!trimmed) return;
    setImportingUrl(true);
    setUrlImportResult(null);
    setUrlImportError(null);
    try {
      const result = await importFromUrl(trimmed);
      setUrlImportResult(result);
      if (result.status === 'success') {
        setUrlInputValue('');
        setShowUrlInput(false);
        loadPage(0, true);
      }
    } catch {
      setUrlImportError('Import fehlgeschlagen. Bitte URL prüfen und erneut versuchen.');
    } finally {
      setImportingUrl(false);
    }
  }

  async function handleRatingChange(id: string, rating: number | null) {
    const previous = recipes;
    setRecipes(prev => prev.map(r => r.id === id ? { ...r, rating } : r));
    try {
      await updateRecipeRating(id, rating);
    } catch (err) {
      setRecipes(previous);
      console.error(err);
    }
  }

  function toggleSelectMode() {
    setSelectMode(v => !v);
    setSelectedIds(new Set());
  }

  function toggleSelectRecipe(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0 || bulkDeleting) return;
    setBulkDeleting(true);
    setBulkDeleteError(null);
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(ids.map(id => deleteRecipe(id)));
    const failedIds = ids.filter((_, i) => results[i].status === 'rejected');
    setRecipes(prev => prev.filter(r => !ids.includes(r.id) || failedIds.includes(r.id)));
    setBulkDeleting(false);
    setShowBulkDeleteConfirm(false);
    if (failedIds.length > 0) {
      setBulkDeleteError(`${failedIds.length} von ${ids.length} Rezept(en) konnten nicht gelöscht werden.`);
      setSelectedIds(new Set(failedIds));
    } else {
      setSelectMode(false);
      setSelectedIds(new Set());
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
            onClick={toggleSelectMode}
            className={selectMode ? 'btn-primary shrink-0' : 'btn-secondary shrink-0'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {selectMode ? 'Auswahl beenden' : 'Auswählen'}
          </button>

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

          <button
            onClick={() => {
              setShowUrlInput(v => !v);
              setUrlImportResult(null);
              setUrlImportError(null);
            }}
            disabled={importingUrl}
            className="btn-secondary shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Von URL importieren
          </button>

          <Link href="/recipes/new" className="btn-primary shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Rezept hinzufügen
          </Link>
        </div>
      </div>

      {/* URL import input panel */}
      {showUrlInput && (
        <div className="glass rounded-xl px-4 py-3 mb-4 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <input
            type="url"
            value={urlInputValue}
            onChange={e => setUrlInputValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleUrlImport(); }}
            placeholder="https://www.chefkoch.de/rezepte/..."
            aria-label="Rezept-URL eingeben"
            className="input-field flex-1"
            disabled={importingUrl}
            autoFocus
          />
          <button
            onClick={handleUrlImport}
            disabled={importingUrl || !urlInputValue.trim()}
            className="btn-primary shrink-0"
          >
            {importingUrl ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 010 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z"/>
                </svg>
                Importiere…
              </>
            ) : 'Importieren'}
          </button>
        </div>
      )}

      {/* URL import result panel */}
      {(urlImportResult !== null || urlImportError !== null) && (
        <div className={`rounded-xl border px-4 py-3 mb-4 text-sm ${
          urlImportError || urlImportResult?.status === 'error'
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-green-50 border-green-200 text-green-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className="font-medium">
              {urlImportError
                ? urlImportError
                : urlImportResult?.status === 'success'
                ? `"${urlImportResult.title}" wurde importiert`
                : `Import fehlgeschlagen: ${urlImportResult?.error ?? 'Unbekannter Fehler'}`
              }
            </span>
            <button
              onClick={() => { setUrlImportResult(null); setUrlImportError(null); }}
              className="ml-4 text-xs underline hover:no-underline"
              aria-label="Ergebnis schließen"
            >
              Schließen
            </button>
          </div>
        </div>
      )}

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
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              selectMode={selectMode}
              selected={selectedIds.has(recipe.id)}
              onToggleSelect={() => toggleSelectRecipe(recipe.id)}
            />
          ))}
        </div>
      )}

      {/* Recipe table */}
      {!loading && !isEmpty && viewMode === 'table' && (
        <RecipeTableView
          recipes={filteredRecipes}
          selectMode={selectMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelectRecipe}
          onRatingChange={handleRatingChange}
        />
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

      {/* Bulk selection action bar */}
      {selectMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-2rem)] max-w-md">
          <div className="glass rounded-2xl px-4 py-3 shadow-lg flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-700">
              {selectedIds.size} {selectedIds.size === 1 ? 'Rezept' : 'Rezepte'} ausgewählt
            </span>
            {showBulkDeleteConfirm ? (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  disabled={bulkDeleting}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800
                             border border-slate-200 rounded-lg
                             focus:outline-none focus:ring-2 focus:ring-slate-400
                             transition-all duration-150"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                             text-white bg-red-600 hover:bg-red-700 rounded-lg
                             disabled:opacity-60 disabled:cursor-not-allowed
                             focus:outline-none focus:ring-2 focus:ring-red-500
                             transition-all duration-150"
                >
                  {bulkDeleting ? 'Wird gelöscht…' : 'Ja, löschen'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                disabled={selectedIds.size === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                           text-white bg-red-600 hover:bg-red-700 shrink-0
                           disabled:opacity-40 disabled:cursor-not-allowed
                           focus:outline-none focus:ring-2 focus:ring-red-500
                           transition-all duration-150"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                Löschen
              </button>
            )}
          </div>
          {bulkDeleteError && (
            <div className="mt-2 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-xs text-red-700">
              {bulkDeleteError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
