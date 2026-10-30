'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { Recipe } from '@/lib/recipes';
import { EditableStarRating } from './EditableStarRating';

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}
function formatTime(minutes: number | null): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function PhotoPlaceholder() {
  return (
    <div className="w-full h-full flex items-center justify-center" aria-hidden="true"
      style={{ background: 'linear-gradient(135deg, #fde68a, #fb923c, #f97316)' }}>
      <svg className="w-10 h-10 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-1.5-.75M3 16.5v-2.625a4.125 4.125 0 014.125-4.125h9.75A4.125 4.125 0 0121 13.875V16.5" />
      </svg>
    </div>
  );
}

interface RecipeCardProps {
  recipe: Recipe;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onRatingChange?: (rating: number | null) => void | Promise<void>;
}

export function RecipeCard({ recipe, selectMode = false, selected = false, onToggleSelect, onRatingChange }: RecipeCardProps) {
  const totalMinutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  const prepLabel = formatTime(recipe.prepMinutes);
  const cookLabel = formatTime(recipe.cookMinutes);
  const totalLabel = formatTime(totalMinutes > 0 ? totalMinutes : null);

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      onClick={(e) => {
        if (selectMode) {
          e.preventDefault();
          onToggleSelect?.();
        }
      }}
      className={`glass-interactive rounded-2xl overflow-hidden flex flex-col group relative
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2
                 ${selected ? 'ring-2 ring-amber-500' : ''}`}
      aria-label={`Rezept: ${recipe.title}`}
    >
      {/* Selection checkbox */}
      {selectMode && (
        <div className="absolute top-2 left-2 z-10">
          <span
            className={`flex items-center justify-center w-6 h-6 rounded-full border-2 transition-colors
                       ${selected ? 'bg-stone-800 border-stone-800' : 'bg-white/90 border-stone-300'}`}
            aria-hidden="true"
          >
            {selected && (
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
          </span>
        </div>
      )}

      {/* Photo */}
      <div className="relative w-full aspect-[4/3] overflow-hidden shrink-0">
        {recipe.photoUrl ? (
          <Image
            src={recipe.photoUrl} alt={recipe.title} fill unoptimized
            className="object-cover group-hover:scale-103 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <PhotoPlaceholder />
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2 p-4 flex-1">
        <h3 className="text-sm font-semibold text-stone-900 leading-snug group-hover:text-amber-700 transition-colors line-clamp-2">
          {recipe.title}
        </h3>
        {recipe.description && (
          <p className="text-xs text-stone-500 leading-relaxed line-clamp-2">{recipe.description}</p>
        )}

        {/* Rating — interactive when onRatingChange is provided */}
        {onRatingChange && !selectMode ? (
          <div
            onClick={(e) => e.preventDefault()}
            className="mt-0.5"
          >
            <EditableStarRating rating={recipe.rating} onChange={onRatingChange} size="sm" />
          </div>
        ) : recipe.rating != null && recipe.rating > 0 ? (
          <div className="flex items-center gap-0.5 mt-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg
                key={i}
                className={`w-3.5 h-3.5 ${i < recipe.rating! ? 'text-amber-400' : 'text-stone-200'}`}
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 mt-auto pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            {prepLabel && (
              <span className="text-xs text-stone-400">Vorber. {prepLabel}</span>
            )}
            {cookLabel && (
              <span className="text-xs text-stone-400">Kochen {cookLabel}</span>
            )}
            {!prepLabel && !cookLabel && totalLabel == null && (
              <span className="text-xs text-stone-400 italic">Keine Zeitangabe</span>
            )}
          </div>
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 bg-stone-100 text-stone-500"
            title={recipe.createdBy.name}
            aria-label={`Erstellt von ${recipe.createdBy.name}`}
          >
            {getInitials(recipe.createdBy.name)}
          </div>
        </div>
      </div>
    </Link>
  );
}
