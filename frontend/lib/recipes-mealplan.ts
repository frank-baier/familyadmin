/**
 * Meal plan types and API client for FamilyAdmin.
 * Created by plan 03-03. If 03-02 has already created lib/recipes.ts,
 * migrate these exports there and update import paths.
 */

import { apiFetch } from './api';

// ─── Types ──────────────────────────────────────────────────────────────────

export type MealSlot = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';

/**
 * Minimal recipe shape needed by the meal planner.
 * Compatible with the full Recipe type from recipes.ts — use name/title bridging below.
 */
export interface RecipeSummary {
  id: string;
  name: string;
  imageUrl?: string | null;
}

export interface MealPlan {
  id: string;
  date: string;         // "YYYY-MM-DD"
  slot: MealSlot;
  recipe: RecipeSummary;
  notes?: string | null;
}

// ─── API Functions ───────────────────────────────────────────────────────────

/**
 * Get all meal plan entries between two dates (inclusive).
 * @param from ISO date "YYYY-MM-DD"
 * @param to   ISO date "YYYY-MM-DD"
 */
export async function getMealPlan(from: string, to: string): Promise<MealPlan[]> {
  return apiFetch<MealPlan[]>(`/api/meal-plans?from=${from}&to=${to}`);
}

/**
 * Assign a recipe to a meal slot.
 */
export async function setMealPlan(
  date: string,
  slot: MealSlot,
  recipeId: string,
  notes?: string,
): Promise<MealPlan> {
  return apiFetch<MealPlan>('/api/meal-plans', {
    method: 'POST',
    body: JSON.stringify({ date, slot, recipeId, notes }),
  });
}

/**
 * Remove a recipe from a meal slot.
 */
export async function removeMealPlan(date: string, slot: MealSlot): Promise<void> {
  return apiFetch<void>(`/api/meal-plans?date=${date}&slot=${slot}`, {
    method: 'DELETE',
  });
}

// ─── Date Helpers ────────────────────────────────────────────────────────────

/** Returns the Monday of the week containing the given date (local time). */
export function getMondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // getDay(): 0=Sun, 1=Mon, …, 6=Sat
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // roll back to Monday
  d.setDate(d.getDate() + diff);
  return d;
}

/** Format a Date as "YYYY-MM-DD" (local time). */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Add `days` days to a date and return a new Date. */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Returns true if two dates fall on the same calendar day. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Short label like "Mon 6 Jan". */
export function formatDayLabel(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}

/** Human-readable week range like "30 Mar – 5 Apr 2026". */
export function formatWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const startMonth = monday.getMonth() !== sunday.getMonth() ? ` ${months[monday.getMonth()]}` : '';
  return `${monday.getDate()}${startMonth} – ${sunday.getDate()} ${months[sunday.getMonth()]} ${sunday.getFullYear()}`;
}

/** Ordered meal slots for grid rows */
export const MEAL_SLOTS: MealSlot[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];

/** Display labels for meal slots */
export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  SNACK: 'Snack',
};
