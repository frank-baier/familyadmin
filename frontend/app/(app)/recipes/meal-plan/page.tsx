'use client';

/**
 * Meal Plan page — /recipes/meal-plan
 * - Shows a weekly grid (Mon–Sun) with 4 meal slots per day
 * - Prev / Next week navigation
 * - "This week" button resets to current Monday
 * - Fetches meal plans and recipes on mount and when week changes
 */

import { useState, useEffect, useCallback } from 'react';
import { WeeklyPlanner } from '@/components/recipes/WeeklyPlanner';
import {
  getMealPlan,
  getMondayOf,
  toISODate,
  addDays,
  formatWeekRange,
} from '@/lib/recipes-mealplan';
import type { MealPlan, RecipeSummary } from '@/lib/recipes-mealplan';
import { getRecipes } from '@/lib/recipes';
import type { Recipe } from '@/lib/recipes';

/** Map a full Recipe to the slim RecipeSummary shape used by the planner */
function toRecipeSummary(r: Recipe): RecipeSummary {
  return { id: r.id, name: r.title, imageUrl: r.photoUrl };
}

export default function MealPlanPage() {
  // Week state: the Monday of the displayed week
  const [monday, setMonday] = useState<Date>(() => getMondayOf(new Date()));

  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Fetch meal plans for current week ─────────────────────────────────────
  const fetchMealPlans = useCallback(async (weekMonday: Date) => {
    setLoadingPlans(true);
    setError(null);
    try {
      const from = toISODate(weekMonday);
      const to = toISODate(addDays(weekMonday, 6));
      const data = await getMealPlan(from, to);
      setMealPlans(data);
    } catch (err) {
      console.error('Failed to load meal plans:', err);
      setError('Could not load meal plans. Please try again.');
    } finally {
      setLoadingPlans(false);
    }
  }, []);

  // ─── Fetch recipes once ─────────────────────────────────────────────────────
  useEffect(() => {
    async function loadRecipes() {
      setLoadingRecipes(true);
      try {
        const data = await getRecipes();
        setRecipes(data.map(toRecipeSummary));
      } catch (err) {
        console.error('Failed to load recipes:', err);
        // Non-fatal: picker will show empty list
      } finally {
        setLoadingRecipes(false);
      }
    }
    loadRecipes();
  }, []);

  // Fetch meal plans whenever the week changes
  useEffect(() => {
    fetchMealPlans(monday);
  }, [monday, fetchMealPlans]);

  // ─── Week navigation ────────────────────────────────────────────────────────
  function goToPrevWeek() {
    setMonday((prev) => addDays(prev, -7));
  }

  function goToNextWeek() {
    setMonday((prev) => addDays(prev, 7));
  }

  function goToThisWeek() {
    setMonday(getMondayOf(new Date()));
  }

  const isCurrentWeek = toISODate(monday) === toISODate(getMondayOf(new Date()));

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Meal Plan</h1>
          <p className="text-slate-500 text-sm mt-1">Plan your family meals for the week</p>
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button
          onClick={goToPrevWeek}
          aria-label="Previous week"
          className="glass w-9 h-9 flex items-center justify-center rounded-2xl
                     text-slate-600 hover:text-slate-900
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
                     transition-colors duration-150"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        <span className="text-sm font-semibold text-slate-800 min-w-[180px] text-center">
          {formatWeekRange(monday)}
        </span>

        <button
          onClick={goToNextWeek}
          aria-label="Next week"
          className="glass w-9 h-9 flex items-center justify-center rounded-2xl
                     text-slate-600 hover:text-slate-900
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
                     transition-colors duration-150"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        {!isCurrentWeek && (
          <button
            onClick={goToThisWeek}
            className="btn-secondary ml-2"
          >
            This week
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="rounded-2xl bg-red-50/80 border border-red-200/60 px-5 py-3 text-sm text-red-700 mb-6
                     flex items-center justify-between"
        >
          {error}
          <button
            onClick={() => fetchMealPlans(monday)}
            className="ml-4 text-xs font-medium text-red-700 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loadingPlans && (
        <div className="space-y-2 animate-pulse">
          <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-1">
            <div />
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-10 rounded-2xl bg-white/40" />
            ))}
          </div>
          {Array.from({ length: 4 }).map((_, row) => (
            <div key={row} className="grid grid-cols-[80px_repeat(7,1fr)] gap-1">
              <div className="h-[72px] flex items-center justify-end pr-3">
                <div className="h-3 w-14 bg-white/40 rounded" />
              </div>
              {Array.from({ length: 7 }).map((_, col) => (
                <div key={col} className="h-[72px] rounded-2xl bg-white/40" />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Planner grid */}
      {!loadingPlans && (
        <WeeklyPlanner
          monday={monday}
          mealPlans={mealPlans}
          recipes={recipes}
          recipesLoading={loadingRecipes}
          onMealPlansChange={setMealPlans}
        />
      )}
    </div>
  );
}
