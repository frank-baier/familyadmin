'use client';

/**
 * Edit Recipe page — /recipes/[id]/edit
 * Fetches recipe, passes to RecipeForm as initialData, redirects to detail on success.
 */

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { RecipeForm } from '@/components/recipes/RecipeForm';
import { getRecipe } from '@/lib/recipes';
import type { Recipe } from '@/lib/recipes';

// ─── Skeleton ────────────────────────────────────────────────────────────────

function EditFormSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Title */}
      <div className="space-y-1.5">
        <div className="h-4 w-16 bg-slate-100 rounded" />
        <div className="h-10 w-full bg-slate-100 rounded-xl" />
      </div>
      {/* Description */}
      <div className="space-y-1.5">
        <div className="h-4 w-24 bg-slate-100 rounded" />
        <div className="h-20 w-full bg-slate-100 rounded-xl" />
      </div>
      {/* Row */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-4 w-20 bg-slate-100 rounded" />
            <div className="h-10 w-full bg-slate-100 rounded-xl" />
          </div>
        ))}
      </div>
      {/* Submit */}
      <div className="h-10 w-32 bg-indigo-100 rounded-xl" />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditRecipePage({ params }: PageProps) {
  const { id } = use(params);

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRecipe(id)
      .then(setRecipe)
      .catch(() => setError('Recipe not found or you do not have access.'))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back link */}
      <Link
        href={`/recipes/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900
                   transition-colors mb-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Recipe
      </Link>

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          {recipe ? `Edit: ${recipe.title}` : 'Edit Recipe'}
        </h1>
        <p className="text-slate-500 text-sm mt-1">Update the recipe details.</p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl bg-red-50/80 border border-red-200/60 px-5 py-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Form card */}
      {!error && (
        <div className="glass rounded-3xl px-6 py-6">
          {loading ? (
            <EditFormSkeleton />
          ) : (
            <RecipeForm
              initialData={recipe}
              redirectTo={`/recipes/${id}`}
            />
          )}
        </div>
      )}
    </div>
  );
}
