/**
 * Public (unauthenticated) recipe share links — server-side only.
 * Uses plain fetch instead of apiFetch: there is no session here, and apiFetch's
 * 401 → refresh → /login redirect logic must never run for anonymous visitors.
 */

import { cache } from 'react';

// Inside Docker the frontend reaches the backend directly; fall back to the public URL in dev
const API_BASE = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

export interface PublicRecipe {
  title: string;
  description: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  difficulty: string | null;
  categories: string | null;
  source: string | null;
  sourceUrl: string | null;
  photoUrl: string | null;
  ingredients: { name: string; amount: number | null; unit: string; position: number; section: string | null }[];
  steps: { text: string; position: number }[];
}

/** Returns null for unknown/revoked tokens. Cached per request (metadata + page share one fetch). */
export const getSharedRecipe = cache(async (token: string): Promise<PublicRecipe | null> => {
  const res = await fetch(`${API_BASE}/api/public/recipes/${encodeURIComponent(token)}`, {
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load shared recipe: ${res.status}`);
  return res.json();
});
