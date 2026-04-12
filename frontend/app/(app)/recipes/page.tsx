'use client';

/**
 * Recipes list page — /recipes
 * - Search bar (debounced 300ms)
 * - Grid of RecipeCard components (1-col mobile, 2-col md, 3-col lg)
 * - "Add Recipe" button
 * - Empty state with friendly message
 */

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { RecipeCard } from '@/components/recipes/RecipeCard';
import { getRecipes, searchRecipes, importPaprikaFile } from '@/lib/recipes';
import type { Recipe, PaprikaImportResult } from '@/lib/recipes';
import { useUser } from '@/lib/user-context';

// ─── Skeleton ────────────────────────────────────────────────────────────────

function RecipeCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden animate-pulse">
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RecipesPage() {
  const { sessionReady } = useUser();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<PaprikaImportResult[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionReady) loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const data = await getRecipes();
      setRecipes(data);
    } catch (err) {
      setError('Failed to load recipes. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Debounced search
  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const trimmed = value.trim();
        const data = trimmed ? await searchRecipes(trimmed) : await getRecipes();
        setRecipes(data);
      } catch (err) {
        setError('Search failed. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
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
      await loadAll(); // refresh the recipe list
    } catch (err) {
      setImportError('Import failed. Please check the file and try again.');
      console.error(err);
    } finally {
      setImporting(false);
      // Reset input so same file can be re-imported if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const isEmpty = !loading && recipes.length === 0;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Recipes</h1>
          <p className="text-slate-500 text-sm mt-1">Family recipe collection</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                       border border-slate-200 bg-white text-slate-700
                       hover:border-slate-300 hover:bg-slate-50
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                       transition-all duration-150 shrink-0"
          >
            {importing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 010 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z"/>
                </svg>
                Importing…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Import Paprika
              </>
            )}
          </button>

          <Link
            href="/recipes/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                       bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                       transition-all duration-150 shadow-sm shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Recipe
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
                : `Import complete: ${importResults!.filter(r => r.status === 'success').length} recipe(s) imported`
              }
            </span>
            <button
              onClick={() => { setImportResults(null); setImportError(null); }}
              className="ml-4 text-xs underline hover:no-underline"
              aria-label="Dismiss import result"
            >
              Dismiss
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

      {/* Search bar */}
      <div className="relative mb-8">
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
          placeholder="Search recipes…"
          aria-label="Search recipes"
          className="block w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-slate-900
                     border border-slate-200 bg-white placeholder:text-slate-300
                     hover:border-slate-300
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                     transition-colors duration-150"
        />
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6 flex items-center justify-between"
        >
          {error}
          <button
            onClick={loadAll}
            className="ml-4 text-xs font-medium text-red-700 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <RecipeCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl" aria-hidden="true">🍴</span>
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            {query.trim() ? `No recipes found for "${query.trim()}"` : 'No recipes yet'}
          </h3>
          <p className="text-sm text-slate-500 mb-6 max-w-xs mx-auto">
            {query.trim()
              ? 'Try a different search term.'
              : 'Start building the family cookbook!'}
          </p>
          {!query.trim() && (
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
              Add first recipe
            </Link>
          )}
        </div>
      )}

      {/* Recipe grid */}
      {!loading && !isEmpty && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
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
