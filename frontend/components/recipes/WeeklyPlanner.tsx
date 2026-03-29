'use client';

/**
 * WeeklyPlanner — 7-column × 4-row meal plan grid.
 * - Columns: Mon–Sun
 * - Rows: BREAKFAST, LUNCH, DINNER, SNACK
 * - Today's column has a subtle highlight
 * - Opens RecipePicker modal when a slot is clicked
 * - Handles optimistic updates for set/remove actions
 */

import { useState, useCallback } from 'react';
import { MealSlotCell } from './MealSlotCell';
import { RecipePicker } from './RecipePicker';
import {
  MEAL_SLOTS,
  MEAL_SLOT_LABELS,
  formatDayLabel,
  toISODate,
  addDays,
  isSameDay,
  setMealPlan,
  removeMealPlan,
} from '@/lib/recipes-mealplan';
import type { MealPlan, MealSlot, RecipeSummary } from '@/lib/recipes-mealplan';

interface WeeklyPlannerProps {
  monday: Date;
  mealPlans: MealPlan[];
  recipes: RecipeSummary[];
  recipesLoading?: boolean;
  onMealPlansChange: (plans: MealPlan[]) => void;
}

interface PendingKey {
  date: string;
  slot: MealSlot;
}

export function WeeklyPlanner({
  monday,
  mealPlans,
  recipes,
  recipesLoading = false,
  onMealPlansChange,
}: WeeklyPlannerProps) {
  // Which slot the user clicked to open the picker
  const [pickerTarget, setPickerTarget] = useState<{ date: string; slot: MealSlot } | null>(null);
  // Slots currently in-flight (optimistic)
  const [pending, setPending] = useState<PendingKey[]>([]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build array of 7 column dates (Mon–Sun)
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  // Lookup helper: find meal plan for a date+slot
  function getMealForSlot(date: Date, slot: MealSlot): MealPlan | undefined {
    const dateStr = toISODate(date);
    return mealPlans.find((mp) => mp.date === dateStr && mp.slot === slot);
  }

  function isPending(date: Date, slot: MealSlot): boolean {
    const dateStr = toISODate(date);
    return pending.some((p) => p.date === dateStr && p.slot === slot);
  }

  function addPending(dateStr: string, slot: MealSlot) {
    setPending((prev) => [...prev, { date: dateStr, slot }]);
  }

  function removePending(dateStr: string, slot: MealSlot) {
    setPending((prev) => prev.filter((p) => !(p.date === dateStr && p.slot === slot)));
  }

  // Open picker for a slot
  const handleAdd = useCallback((date: Date, slot: MealSlot) => {
    setPickerTarget({ date: toISODate(date), slot });
  }, []);

  // Optimistic remove
  const handleRemove = useCallback(async (date: Date, slot: MealSlot) => {
    const dateStr = toISODate(date);

    // Optimistic: remove from local state immediately
    onMealPlansChange(
      mealPlans.filter((mp) => !(mp.date === dateStr && mp.slot === slot)),
    );

    addPending(dateStr, slot);
    try {
      await removeMealPlan(dateStr, slot);
    } catch (err) {
      // Revert: re-fetch by restoring (caller should ideally re-fetch; we can't here)
      console.warn('Failed to remove meal plan:', err);
    } finally {
      removePending(dateStr, slot);
    }
  }, [mealPlans, onMealPlansChange]);

  // Called when user selects a recipe in the picker
  const handleRecipeSelect = useCallback(async (recipe: RecipeSummary) => {
    if (!pickerTarget) return;
    const { date, slot } = pickerTarget;
    setPickerTarget(null); // close modal immediately

    // Capture current plans snapshot for revert
    const snapshot = [...mealPlans];

    // Optimistic: add to local state with a temporary ID
    const optimisticPlan: MealPlan = {
      id: `optimistic-${date}-${slot}`,
      date,
      slot,
      recipe,
    };
    onMealPlansChange([
      ...snapshot.filter((mp) => !(mp.date === date && mp.slot === slot)),
      optimisticPlan,
    ]);

    addPending(date, slot);
    try {
      const saved = await setMealPlan(date, slot, recipe.id);
      // Replace optimistic entry with the real server response
      // Note: use snapshot as base since mealPlans prop may be stale here
      onMealPlansChange([
        ...snapshot.filter((mp) => !(mp.date === date && mp.slot === slot)),
        saved,
      ]);
    } catch (err) {
      console.warn('Failed to set meal plan:', err);
      // Revert to snapshot
      onMealPlansChange(snapshot);
    } finally {
      removePending(date, slot);
    }
  }, [pickerTarget, mealPlans, onMealPlansChange]);

  return (
    <>
      {/* Grid */}
      <div className="w-full overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Header row: day names */}
          <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-1 mb-1">
            {/* Empty corner cell */}
            <div />
            {weekDates.map((date, idx) => {
              const isToday = isSameDay(date, today);
              return (
                <div
                  key={idx}
                  className={[
                    'rounded-xl px-2 py-2.5 text-center',
                    isToday ? 'bg-indigo-50' : '',
                  ].join(' ')}
                >
                  <p
                    className={[
                      'text-xs font-semibold leading-none',
                      isToday ? 'text-indigo-700' : 'text-slate-500',
                    ].join(' ')}
                  >
                    {formatDayLabel(date)}
                  </p>
                  {isToday && (
                    <span className="inline-block mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500" aria-label="Today" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Meal slot rows */}
          {MEAL_SLOTS.map((slot) => (
            <div key={slot} className="grid grid-cols-[80px_repeat(7,1fr)] gap-1 mb-1">
              {/* Row label */}
              <div className="flex items-center justify-end pr-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {MEAL_SLOT_LABELS[slot]}
                </span>
              </div>

              {/* 7 day cells */}
              {weekDates.map((date, idx) => {
                const isToday = isSameDay(date, today);
                const mealPlan = getMealForSlot(date, slot);
                const pending_ = isPending(date, slot);

                return (
                  <div
                    key={idx}
                    className={[
                      'rounded-xl',
                      isToday ? 'bg-indigo-50/60' : '',
                    ].join(' ')}
                  >
                    <MealSlotCell
                      slot={slot}
                      mealPlan={mealPlan}
                      isPending={pending_}
                      onAdd={(s) => handleAdd(date, s)}
                      onRemove={(s) => handleRemove(date, s)}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Recipe picker modal */}
      {pickerTarget && (
        <RecipePicker
          recipes={recipes}
          loading={recipesLoading}
          onSelect={handleRecipeSelect}
          onClose={() => setPickerTarget(null)}
        />
      )}
    </>
  );
}
