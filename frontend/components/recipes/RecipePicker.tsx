'use client';

/**
 * RecipePicker — modal overlay for selecting a recipe.
 * - Search input with live filter on recipe name
 * - Scrollable list of matching recipes
 * - Click recipe → calls onSelect(recipe)
 * - ESC key or backdrop click → calls onClose
 */

import { useState, useEffect, useRef } from 'react';
import type { RecipeSummary } from '@/lib/recipes-mealplan';

interface RecipePickerProps {
  recipes: RecipeSummary[];
  loading?: boolean;
  onSelect: (recipe: RecipeSummary) => void;
  onClose: () => void;
}

export function RecipePicker({ recipes, loading = false, onSelect, onClose }: RecipePickerProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus search on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on ESC
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const filtered = query.trim()
    ? recipes.filter((r) => r.name.toLowerCase().includes(query.trim().toLowerCase()))
    : recipes;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label="Pick a recipe"
    >
      {/* Modal panel */}
      <div
        className="glass-strong relative w-full max-w-md mx-4 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 hairline">
          <h2 className="text-base font-semibold text-slate-900">Choose a Recipe</h2>
          <button
            onClick={onClose}
            aria-label="Close recipe picker"
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400
                       hover:bg-white/60 hover:text-slate-700 transition-colors duration-150
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 hairline">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              ref={inputRef}
              type="search"
              placeholder="Search recipes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input-field pl-9"
            />
          </div>
        </div>

        {/* Recipe list */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-12 px-5">
              <p className="text-sm text-slate-500">
                {query ? `No recipes match "${query}"` : 'No recipes available yet.'}
              </p>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <ul role="listbox" aria-label="Recipes" className="py-2">
              {filtered.map((recipe) => (
                <li key={recipe.id} role="option" aria-selected={false}>
                  <button
                    onClick={() => onSelect(recipe)}
                    className="w-full text-left px-5 py-3 flex items-center gap-3
                               hover:bg-white/50 transition-colors duration-100
                               focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <div className="w-9 h-9 rounded-xl bg-white/60 shrink-0 flex items-center justify-center overflow-hidden">
                      {recipe.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={recipe.imageUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-1.5-.75M3 16.5v-2.625a4.125 4.125 0 014.125-4.125h9.75A4.125 4.125 0 0121 13.875V16.5" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm font-medium text-slate-800 truncate">{recipe.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
