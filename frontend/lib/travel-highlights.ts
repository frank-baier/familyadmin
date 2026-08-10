import { apiFetch } from './api';

export interface HighlightItem {
  name: string;
  description: string;
  category: string;
}

export interface LocationHighlights {
  id: string;
  location: string;
  checkIn: string | null;
  checkOut: string | null;
  highlights: HighlightItem[];
  generatedAt: string;
}

export async function getHighlights(tripId: string): Promise<LocationHighlights[]> {
  return apiFetch<LocationHighlights[]>(`/api/trips/${tripId}/highlights`);
}

export async function deleteHighlight(tripId: string, highlightId: string): Promise<void> {
  return apiFetch<void>(`/api/trips/${tripId}/highlights/${highlightId}`, { method: 'DELETE' });
}
