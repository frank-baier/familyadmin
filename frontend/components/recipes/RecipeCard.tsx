'use client';

/**
 * RecipeCard — compact recipe summary card for the recipe list.
 * Shows: photo thumbnail (or placeholder), title, prep+cook time, servings, creator initials.
 * Click navigates to /recipes/[id].
 */

import Link from 'next/link';
import Image from 'next/image';
import type { Recipe } from '@/lib/recipes';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(minutes: number | null): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Photo placeholder ───────────────────────────────────────────────────────

function PhotoPlaceholder() {
  return (
    <div
      className="w-full h-full bg-slate-100 flex items-center justify-center"
      aria-hidden="true"
    >
      <span className="text-4xl select-none" role="img" aria-label="Recipe placeholder">
        🍴
      </span>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

interface RecipeCardProps {
  recipe: Recipe;
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  const totalMinutes =
    (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  const prepLabel = formatTime(recipe.prepMinutes);
  const cookLabel = formatTime(recipe.cookMinutes);
  const totalLabel = formatTime(totalMinutes > 0 ? totalMinutes : null);

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group flex flex-col bg-white rounded-2xl border border-slate-100
                 hover:border-slate-200 hover:shadow-md hover:shadow-slate-100/80
                 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                 transition-all duration-200 overflow-hidden cursor-pointer"
      aria-label={`Recipe: ${recipe.title}`}
    >
      {/* Photo */}
      <div className="relative w-full aspect-[4/3] bg-slate-100 overflow-hidden shrink-0">
        {recipe.photoUrl ? (
          <Image
            src={recipe.photoUrl}
            alt={recipe.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <PhotoPlaceholder />
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2 p-4 flex-1">
        {/* Title */}
        <h3 className="text-sm font-semibold text-slate-900 leading-snug
                       group-hover:text-indigo-700 transition-colors line-clamp-2">
          {recipe.title}
        </h3>

        {/* Description preview */}
        {recipe.description && (
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
            {recipe.description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center justify-between gap-2 mt-auto pt-1">
          {/* Time badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {prepLabel && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-slate-400">Prep</span> {prepLabel}
              </span>
            )}
            {cookLabel && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <svg className="w-3 h-3 shrink-0 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.047 8.287 8.287 0 009 9.601a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                </svg>
                <span className="text-slate-400">Cook</span> {cookLabel}
              </span>
            )}
            {!prepLabel && !cookLabel && totalLabel == null && (
              <span className="text-xs text-slate-400 italic">No time info</span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Servings */}
            {recipe.servings != null && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                {recipe.servings}
              </span>
            )}

            {/* Creator initials */}
            <div
              className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0"
              title={recipe.createdBy.name}
              aria-label={`Created by ${recipe.createdBy.name}`}
            >
              {getInitials(recipe.createdBy.name)}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
