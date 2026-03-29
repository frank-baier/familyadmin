'use client';

/**
 * MealSlotCell — a single cell in the weekly meal planner grid.
 * - Empty: "+" button with slot label
 * - Filled: recipe name + "×" remove button
 * - Optimistic updates with loading spinner
 */

import { MEAL_SLOT_LABELS } from '@/lib/recipes-mealplan';
import type { MealSlot, MealPlan, RecipeSummary } from '@/lib/recipes-mealplan';

interface MealSlotCellProps {
  slot: MealSlot;
  mealPlan?: MealPlan | null;
  isPending?: boolean;
  onAdd: (slot: MealSlot) => void;
  onRemove: (slot: MealSlot) => void;
}

export function MealSlotCell({
  slot,
  mealPlan,
  isPending = false,
  onAdd,
  onRemove,
}: MealSlotCellProps) {
  const label = MEAL_SLOT_LABELS[slot];
  const recipe = mealPlan?.recipe;

  if (isPending) {
    return (
      <div
        className="min-h-[72px] rounded-xl border border-slate-100 bg-slate-50
                   flex items-center justify-center"
        aria-busy="true"
        aria-label={`${label} — loading`}
      >
        <div className="w-5 h-5 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
      </div>
    );
  }

  if (recipe) {
    return (
      <div
        className="min-h-[72px] rounded-xl border border-indigo-100 bg-white px-3 py-3
                   flex items-start justify-between gap-2 group"
        aria-label={`${label}: ${recipe.name}`}
      >
        <div className="flex items-start gap-2 min-w-0">
          {/* Slot colour dot */}
          <span
            className={[
              'mt-0.5 shrink-0 w-2 h-2 rounded-full',
              slotDotColor(slot),
            ].join(' ')}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 leading-none mb-1">
              {label}
            </p>
            <p className="text-sm font-medium text-slate-800 leading-snug line-clamp-2">
              {recipe.name}
            </p>
          </div>
        </div>

        {/* Remove button */}
        <button
          onClick={() => onRemove(slot)}
          aria-label={`Remove ${recipe.name} from ${label}`}
          className="shrink-0 mt-0.5 w-6 h-6 flex items-center justify-center rounded-lg
                     text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors duration-150
                     opacity-0 group-hover:opacity-100 focus:opacity-100
                     focus:outline-none focus:ring-2 focus:ring-red-400"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  // Empty slot
  return (
    <button
      onClick={() => onAdd(slot)}
      aria-label={`Add recipe to ${label}`}
      className="min-h-[72px] w-full rounded-xl border border-dashed border-slate-200
                 bg-transparent hover:border-indigo-300 hover:bg-indigo-50/50
                 flex flex-col items-center justify-center gap-1 group
                 transition-colors duration-150
                 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400"
    >
      <span
        className={[
          'w-6 h-6 rounded-full flex items-center justify-center',
          'bg-slate-100 group-hover:bg-indigo-100 transition-colors duration-150',
          slotIconColor(slot),
        ].join(' ')}
        aria-hidden="true"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 group-hover:text-indigo-400 transition-colors duration-150">
        {label}
      </span>
    </button>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slotDotColor(slot: MealSlot): string {
  const map: Record<MealSlot, string> = {
    BREAKFAST: 'bg-amber-400',
    LUNCH: 'bg-green-400',
    DINNER: 'bg-indigo-500',
    SNACK: 'bg-rose-400',
  };
  return map[slot];
}

function slotIconColor(slot: MealSlot): string {
  const map: Record<MealSlot, string> = {
    BREAKFAST: 'group-hover:text-amber-500',
    LUNCH: 'group-hover:text-green-500',
    DINNER: 'group-hover:text-indigo-600',
    SNACK: 'group-hover:text-rose-500',
  };
  return map[slot];
}

// Re-export so WeeklyPlanner can import RecipeSummary from here conveniently
export type { RecipeSummary };
