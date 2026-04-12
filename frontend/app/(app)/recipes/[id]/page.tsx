'use client';

/**
 * Recipe detail page — /recipes/[id]
 * Shows: photo header, metadata (time, servings), ingredients list, numbered steps.
 * Edit and Delete buttons shown (creator or admin only — currently always shown, auth check can be added).
 */

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getRecipe, deleteRecipe } from '@/lib/recipes';
import type { Recipe } from '@/lib/recipes';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(minutes: number | null): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatAmount(amount: number | null, unit: string): string {
  if (amount == null) return unit || '';
  const amtStr = Number.isInteger(amount) ? String(amount) : amount.toFixed(1).replace(/\.0$/, '');
  return unit ? `${amtStr} ${unit}` : amtStr;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RecipeDetailSkeleton() {
  return (
    <div className="max-w-3xl mx-auto animate-pulse">
      <div className="h-4 w-24 bg-slate-100 rounded mb-8" />
      <div className="aspect-[16/7] bg-slate-100 rounded-2xl mb-6" />
      <div className="space-y-3">
        <div className="h-7 w-2/3 bg-slate-100 rounded" />
        <div className="flex gap-4">
          <div className="h-5 w-20 bg-slate-100 rounded-full" />
          <div className="h-5 w-20 bg-slate-100 rounded-full" />
          <div className="h-5 w-16 bg-slate-100 rounded-full" />
        </div>
        <div className="h-4 w-full bg-slate-50 rounded mt-2" />
        <div className="h-4 w-5/6 bg-slate-50 rounded" />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function RecipeDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    getRecipe(id)
      .then(setRecipe)
      .catch(() => setError('Recipe not found or you do not have access.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!recipe || deleting) return;
    setDeleting(true);
    try {
      await deleteRecipe(recipe.id);
      router.push('/recipes');
    } catch {
      console.error('Failed to delete recipe');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <RecipeDetailSkeleton />
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="max-w-3xl mx-auto">
        <Link
          href="/recipes"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900
                     transition-colors mb-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Recipes
        </Link>
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-red-700 text-sm">
          {error ?? 'Recipe not found.'}
        </div>
      </div>
    );
  }

  const sortedIngredients = [...recipe.ingredients].sort((a, b) => a.position - b.position);
  const sortedSteps = [...recipe.steps].sort((a, b) => a.position - b.position);
  const totalMinutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back link */}
      <Link
        href="/recipes"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900
                   transition-colors mb-6 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Recipes
      </Link>

      {/* Photo header */}
      <div className="relative w-full aspect-[16/7] rounded-2xl overflow-hidden bg-slate-100 mb-6">
        {recipe.photoUrl ? (
          <Image
            src={recipe.photoUrl}
            alt={recipe.title}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 768px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-100">
            <span className="text-6xl select-none" aria-label="Recipe placeholder">🍴</span>
          </div>
        )}
      </div>

      {/* Main card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-xl font-bold text-slate-900 leading-snug tracking-tight">
              {recipe.title}
            </h1>

            {/* Edit button */}
            <Link
              href={`/recipes/${recipe.id}/edit`}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                         text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-slate-700
                         focus:outline-none focus:ring-2 focus:ring-indigo-500
                         transition-all duration-150"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
              </svg>
              Edit
            </Link>
          </div>

          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-3 mt-3">
            {recipe.prepMinutes != null && (
              <div className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Prep: <strong className="text-slate-700">{formatTime(recipe.prepMinutes)}</strong></span>
              </div>
            )}
            {recipe.cookMinutes != null && (
              <div className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.047 8.287 8.287 0 009 9.601a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                </svg>
                <span>Cook: <strong className="text-slate-700">{formatTime(recipe.cookMinutes)}</strong></span>
              </div>
            )}
            {totalMinutes > 0 && recipe.prepMinutes != null && recipe.cookMinutes != null && (
              <div className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                <span className="text-slate-400">Total:</span>
                <strong className="text-slate-700">{formatTime(totalMinutes)}</strong>
              </div>
            )}
            {recipe.servings != null && (
              <div className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                <span>Serves <strong className="text-slate-700">{recipe.servings}</strong></span>
              </div>
            )}

            {/* Rating */}
            {recipe.rating != null && recipe.rating > 0 && (
              <div className="inline-flex items-center gap-0.5" aria-label={`Rating: ${recipe.rating} out of 5`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} className={`w-4 h-4 ${i < recipe.rating! ? 'text-amber-400' : 'text-slate-200'}`}
                    fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            )}

            {/* Creator */}
            <div className="inline-flex items-center gap-1.5 ml-auto">
              <div
                className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold"
                title={`Created by ${recipe.createdBy.name}`}
                aria-label={`Created by ${recipe.createdBy.name}`}
              >
                {getInitials(recipe.createdBy.name)}
              </div>
              <span className="text-xs text-slate-400">{recipe.createdBy.name}</span>
            </div>
          </div>
        </div>

        {/* Description */}
        {recipe.description && (
          <>
            <div className="border-t border-slate-50" />
            <div className="px-6 py-4">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {recipe.description}
              </p>
            </div>
          </>
        )}

        {/* Notes */}
        {recipe.notes && (
          <>
            <div className="border-t border-slate-100" />
            <div className="px-6 py-5">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Notes</h2>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{recipe.notes}</p>
            </div>
          </>
        )}

        {/* Ingredients */}
        {sortedIngredients.length > 0 && (
          <>
            <div className="border-t border-slate-100" />
            <div className="px-6 py-5">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
                Ingredients
                <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">
                  ({sortedIngredients.length})
                </span>
              </h2>
              <ul className="space-y-2" aria-label="Ingredients list">
                {sortedIngredients.map((ing) => (
                  <li key={ing.id} className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 shrink-0" aria-hidden="true" />
                    <span className="text-sm text-slate-500 w-24 shrink-0 text-right">
                      {ing.amount != null || ing.unit
                        ? formatAmount(ing.amount, ing.unit)
                        : ''}
                    </span>
                    <span className="text-sm text-slate-800 font-medium">{ing.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Steps */}
        {sortedSteps.length > 0 && (
          <>
            <div className="border-t border-slate-100" />
            <div className="px-6 py-5">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
                Instructions
                <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">
                  ({sortedSteps.length} step{sortedSteps.length !== 1 ? 's' : ''})
                </span>
              </h2>
              <ol className="space-y-4" aria-label="Recipe instructions">
                {sortedSteps.map((step) => (
                  <li key={step.id} className="flex items-start gap-4">
                    <div
                      className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center
                                 text-xs font-bold shrink-0 mt-0.5"
                      aria-hidden="true"
                    >
                      {step.position + 1}
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed flex-1">
                      {step.text}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}

        {/* Footer: delete */}
        <div className="border-t border-slate-100 px-6 py-4 flex justify-end">
          {showDeleteConfirm ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600">Delete this recipe?</span>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800
                           border border-slate-200 rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-slate-400
                           transition-all duration-150"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                           text-white bg-red-600 hover:bg-red-700 rounded-lg
                           disabled:opacity-60 disabled:cursor-not-allowed
                           focus:outline-none focus:ring-2 focus:ring-red-500
                           transition-all duration-150"
              >
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                         text-red-500 hover:text-red-700 hover:bg-red-50
                         border border-transparent hover:border-red-200
                         focus:outline-none focus:ring-2 focus:ring-red-400
                         transition-all duration-150"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Delete recipe
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
