/**
 * Itinerary types and API client for FamilyAdmin Travel module.
 * Created by plan 04-03.
 *
 * NOTE: If plan 04-02's travel.ts exists, these should be merged into it
 * and this file removed (updating import paths in travel components).
 */

import { apiFetch } from './api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ItineraryEntry {
  id: string;
  tripId: string;
  entryDate: string;       // "YYYY-MM-DD"
  entryTime?: string | null; // "HH:MM" or null for all-day
  title: string;
  description?: string | null;
  location?: string | null;
  position: number;
}

export interface ItineraryEntryRequest {
  entryDate: string;       // "YYYY-MM-DD"
  entryTime?: string | null;
  title: string;
  description?: string | null;
  location?: string | null;
  position?: number;
}

export interface KeyInfo {
  id: string;
  tripId: string;
  label: string;
  value: string;
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Get all itinerary entries for a trip.
 */
export async function getItinerary(tripId: string): Promise<ItineraryEntry[]> {
  return apiFetch<ItineraryEntry[]>(`/api/trips/${tripId}/itinerary`);
}

/**
 * Add a new itinerary entry to a trip.
 */
export async function addItineraryEntry(
  tripId: string,
  data: ItineraryEntryRequest,
): Promise<ItineraryEntry> {
  return apiFetch<ItineraryEntry>(`/api/trips/${tripId}/itinerary`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing itinerary entry.
 */
export async function updateItineraryEntry(
  tripId: string,
  entryId: string,
  data: ItineraryEntryRequest,
): Promise<ItineraryEntry> {
  return apiFetch<ItineraryEntry>(`/api/trips/${tripId}/itinerary/${entryId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Delete an itinerary entry.
 */
export async function deleteItineraryEntry(
  tripId: string,
  entryId: string,
): Promise<void> {
  return apiFetch<void>(`/api/trips/${tripId}/itinerary/${entryId}`, {
    method: 'DELETE',
  });
}

/**
 * Add a key info item to a trip.
 */
export async function addKeyInfo(
  tripId: string,
  label: string,
  value: string,
): Promise<KeyInfo> {
  return apiFetch<KeyInfo>(`/api/trips/${tripId}/key-info`, {
    method: 'POST',
    body: JSON.stringify({ label, value }),
  });
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────

/**
 * Format a "YYYY-MM-DD" date string as "Monday, 23 Jul" using Intl.DateTimeFormat.
 * Parses as UTC to avoid timezone offset shifting the day.
 */
export function formatItineraryDate(isoDate: string): string {
  // Append T00:00:00Z so the Date is interpreted in UTC
  const date = new Date(`${isoDate}T00:00:00Z`);
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
}

/**
 * Group an array of itinerary entries by date (YYYY-MM-DD).
 * Returns a sorted array of [dateKey, entries[]] tuples.
 */
export function groupEntriesByDate(
  entries: ItineraryEntry[],
): Array<{ date: string; label: string; entries: ItineraryEntry[] }> {
  const map = new Map<string, ItineraryEntry[]>();

  for (const entry of entries) {
    const existing = map.get(entry.entryDate);
    if (existing) {
      existing.push(entry);
    } else {
      map.set(entry.entryDate, [entry]);
    }
  }

  // Sort groups by date ascending, sort entries within each group by position then time
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayEntries]) => ({
      date,
      label: formatItineraryDate(date),
      entries: dayEntries.slice().sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position;
        const ta = a.entryTime ?? '99:99';
        const tb = b.entryTime ?? '99:99';
        return ta.localeCompare(tb);
      }),
    }));
}
