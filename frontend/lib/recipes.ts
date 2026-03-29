/**
 * Recipes API client for FamilyAdmin
 * All functions use apiFetch from lib/api.ts (auth token injected automatically).
 * Backend: Spring Boot at http://localhost:8080
 */

import { apiFetch, getAccessToken } from './api';
import type { User } from './auth';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RecipeIngredient {
  id: string;
  name: string;
  amount: number | null;
  unit: string;
  position: number;
}

export interface RecipeStep {
  id: string;
  stepNumber: number;
  instruction: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  photoUrl: string | null;
  createdBy: User;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  createdAt: string;   // ISO datetime string
  updatedAt: string;   // ISO datetime string
}

export interface RecipeIngredientRequest {
  name: string;
  amount?: number;
  unit?: string;
  position: number;
}

export interface RecipeStepRequest {
  stepNumber: number;
  instruction: string;
}

export interface RecipeRequest {
  title: string;
  description?: string;
  servings?: number;
  prepMinutes?: number;
  cookMinutes?: number;
  ingredients?: RecipeIngredientRequest[];
  steps?: RecipeStepRequest[];
}

// ─── API Functions ──────────────────────────────────────────────────────────

/** Get all recipes */
export async function getRecipes(): Promise<Recipe[]> {
  return apiFetch<Recipe[]>('/api/recipes');
}

/** Search recipes by query */
export async function searchRecipes(q: string): Promise<Recipe[]> {
  const params = new URLSearchParams({ q });
  return apiFetch<Recipe[]>(`/api/recipes/search?${params}`);
}

/** Get a single recipe by id */
export async function getRecipe(id: string): Promise<Recipe> {
  return apiFetch<Recipe>(`/api/recipes/${id}`);
}

/** Create a new recipe */
export async function createRecipe(data: RecipeRequest): Promise<Recipe> {
  return apiFetch<Recipe>('/api/recipes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Update an existing recipe */
export async function updateRecipe(id: string, data: RecipeRequest): Promise<Recipe> {
  return apiFetch<Recipe>(`/api/recipes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/** Delete a recipe */
export async function deleteRecipe(id: string): Promise<void> {
  return apiFetch<void>(`/api/recipes/${id}`, {
    method: 'DELETE',
  });
}

/** Upload a photo for a recipe. Returns the updated photoUrl. */
export async function uploadPhoto(id: string, file: File): Promise<{ photoUrl: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';
  const token = getAccessToken();

  const response = await fetch(`${API_BASE}/api/recipes/${id}/photo`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    throw new Error(`Photo upload failed: ${response.statusText}`);
  }

  return response.json() as Promise<{ photoUrl: string }>;
}
