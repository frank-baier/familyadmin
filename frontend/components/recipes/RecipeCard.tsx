'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { Recipe } from '@/lib/recipes';

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

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const totalMinutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  const prepLabel = formatTime(recipe.prepMinutes);
  const cookLabel = formatTime(recipe.cookMinutes);
  const totalLabel = formatTime(totalMinutes > 0 ? totalMinutes : null);

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="glass-interactive rounded-3xl overflow-hidden flex flex-col group
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      aria-label={`Recipe: ${recipe.title}`}
    >
      {/* Photo */}
      <div className="relative w-full aspect-[4/3] overflow-hidden shrink-0">
        {recipe.photoUrl ? (
          <Image
            src={recipe.photoUrl} alt={recipe.title} fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <PhotoPlaceholder />
        )}
        {/* Star rating overlay */}
        {recipe.rating != null && recipe.rating > 0 && (
          <div className="absolute bottom-2 right-2">
            <span className="glass rounded-full px-2 py-0.5 text-xs font-semibold text-amber-600 flex items-center gap-0.5">
              <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {recipe.rating}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2 p-4 flex-1">
        <h3 className="text-sm font-bold text-slate-900 leading-snug group-hover:text-orange-600 transition-colors line-clamp-2">
          {recipe.title}
        </h3>
        {recipe.description && (
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{recipe.description}</p>
        )}
        <div className="flex items-center justify-between gap-2 mt-auto pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            {prepLabel && (
              <span className="text-xs text-slate-400">Prep {prepLabel}</span>
            )}
            {cookLabel && (
              <span className="text-xs text-slate-400">Cook {cookLabel}</span>
            )}
            {!prepLabel && !cookLabel && totalLabel == null && (
              <span className="text-xs text-slate-400 italic">No time info</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {recipe.servings != null && (
              <span className="text-xs text-slate-400">{recipe.servings} srv</span>
            )}
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
              style={{ background: 'linear-gradient(135deg, #e0e7ff, #ede9fe)', color: '#4f46e5' }}
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
