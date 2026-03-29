'use client';

/**
 * New Recipe page — /recipes/new
 * Wraps RecipeForm. On submit: creates recipe and redirects to detail page.
 */

import Link from 'next/link';
import { RecipeForm } from '@/components/recipes/RecipeForm';

export default function NewRecipePage() {
  return (
    <div className="max-w-2xl mx-auto">
      {/* Back link */}
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

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">New Recipe</h1>
        <p className="text-slate-500 text-sm mt-1">
          Add a new recipe to the family cookbook.
        </p>
      </div>

      {/* Form card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-6">
        <RecipeForm />
      </div>
    </div>
  );
}
