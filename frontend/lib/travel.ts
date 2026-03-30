/**
 * Travel API client for FamilyAdmin
 * All functions use apiFetch from lib/api.ts (auth token injected automatically).
 * Backend: Spring Boot at http://localhost:8080
 */

import { apiFetch } from './api';
import type { User } from './auth';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface TripKeyInfo {
  id: string;
  label: string;
  value: string;
  position: number;
}

export interface ItineraryEntry {
  id: string;
  date: string;         // ISO date string
  title: string;
  description: string | null;
  position: number;
}

export interface Trip {
  id: string;
  title: string;
  destination: string;
  startDate: string;    // ISO date string "YYYY-MM-DD"
  endDate: string;      // ISO date string "YYYY-MM-DD"
  description: string | null;
  coverPhotoUrl: string | null;
  createdBy: User;
  keyInfos: TripKeyInfo[];
  itinerary: ItineraryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface PackingItem {
  id: string;
  label: string;
  packed: boolean;
  personal: boolean;
  addedBy: User;
  createdAt: string;
}

export interface TripRequest {
  title: string;
  destination: string;
  startDate: string;    // "YYYY-MM-DD"
  endDate: string;      // "YYYY-MM-DD"
  description?: string;
}

export interface PackingItemRequest {
  label: string;
  personal?: boolean;
}

// ─── API Functions ──────────────────────────────────────────────────────────

/** Get all trips */
export async function getTrips(): Promise<Trip[]> {
  return apiFetch<Trip[]>('/api/trips');
}

/** Get a single trip by id */
export async function getTrip(id: string): Promise<Trip> {
  return apiFetch<Trip>(`/api/trips/${id}`);
}

/** Create a new trip */
export async function createTrip(data: TripRequest): Promise<Trip> {
  return apiFetch<Trip>('/api/trips', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Delete a trip */
export async function deleteTrip(id: string): Promise<void> {
  return apiFetch<void>(`/api/trips/${id}`, {
    method: 'DELETE',
  });
}

/** Get packing items for a trip. Pass personal=true for personal items only. */
export async function getPackingItems(tripId: string, personal?: boolean): Promise<PackingItem[]> {
  const path =
    personal !== undefined
      ? `/api/trips/${tripId}/packing?personal=${personal}`
      : `/api/trips/${tripId}/packing`;
  return apiFetch<PackingItem[]>(path);
}

/** Add a packing item to a trip */
export async function addPackingItem(
  tripId: string,
  data: PackingItemRequest,
): Promise<PackingItem> {
  return apiFetch<PackingItem>(`/api/trips/${tripId}/packing`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Toggle the packed status of a packing item */
export async function togglePackingItem(
  tripId: string,
  itemId: string,
): Promise<PackingItem> {
  return apiFetch<PackingItem>(`/api/trips/${tripId}/packing/${itemId}/toggle`, {
    method: 'POST',
  });
}

/** Delete a packing item */
export async function deletePackingItem(tripId: string, itemId: string): Promise<void> {
  return apiFetch<void>(`/api/trips/${tripId}/packing/${itemId}`, {
    method: 'DELETE',
  });
}
