import { apiFetch } from './api';

export type TransportType = 'FLIGHT' | 'TRAIN' | 'BUS' | 'CAR' | 'FERRY' | 'OTHER';

export interface TransportLeg {
  id: string;
  type: TransportType;
  fromLocation: string;
  toLocation: string;
  departureAt: string;
  arrivalAt: string;
  carrier: string | null;
  bookingReference: string | null;
  seat: string | null;
  notes: string | null;
  baggageAllowance: string | null;
  position: number;
  flightNumber: string | null;
  flightStatus: string | null;
  actualDepartureAt: string | null;
  actualArrivalAt: string | null;
  departureGate: string | null;
  departureTerminal: string | null;
  arrivalGate: string | null;
  arrivalTerminal: string | null;
  delayMinutes: number | null;
  statusCheckedAt: string | null;
}

export interface TransportLegRequest {
  type: TransportType;
  fromLocation: string;
  toLocation: string;
  departureAt: string;
  arrivalAt: string;
  carrier?: string;
  bookingReference?: string;
  seat?: string;
  notes?: string;
  baggageAllowance?: string;
  position: number;
  flightNumber?: string;
}

export const TRANSPORT_TYPE_LABELS: Record<TransportType, string> = {
  FLIGHT: 'Flug',
  TRAIN: 'Zug',
  BUS: 'Bus',
  CAR: 'Auto',
  FERRY: 'Fähre',
  OTHER: 'Sonstiges',
};

export const TRANSPORT_TYPE_ICONS: Record<TransportType, string> = {
  FLIGHT: '✈️',
  TRAIN: '🚂',
  BUS: '🚌',
  CAR: '🚗',
  FERRY: '⛴️',
  OTHER: '🚀',
};

export async function getLegs(tripId: string): Promise<TransportLeg[]> {
  return apiFetch<TransportLeg[]>(`/api/trips/${tripId}/transport`);
}

export async function addLeg(tripId: string, req: TransportLegRequest): Promise<TransportLeg> {
  return apiFetch<TransportLeg>(`/api/trips/${tripId}/transport`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
}

export async function updateLeg(tripId: string, legId: string, req: TransportLegRequest): Promise<TransportLeg> {
  return apiFetch<TransportLeg>(`/api/trips/${tripId}/transport/${legId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
}

export async function deleteLeg(tripId: string, legId: string): Promise<void> {
  return apiFetch<void>(`/api/trips/${tripId}/transport/${legId}`, {
    method: 'DELETE',
  });
}

export async function refreshFlightStatus(tripId: string, legId: string): Promise<TransportLeg> {
  return apiFetch<TransportLeg>(`/api/trips/${tripId}/transport/${legId}/check-flight`, {
    method: 'POST',
  });
}

export interface FlightLookupResult {
  flightIata: string;
  depCode: string;
  depCity: string;
  arrCode: string;
  arrCity: string;
  airlineName: string;
  durationMinutes: number | null;
  departureAt: string | null;
  arrivalAt: string | null;
}

export async function lookupFlight(flightIata: string, date?: string): Promise<FlightLookupResult> {
  const params = new URLSearchParams({ flight_iata: flightIata });
  if (date) params.set('date', date);
  return apiFetch<FlightLookupResult>(`/api/transport/flights/lookup?${params}`);
}

const APP_TZ = 'Europe/Zurich';

// Formats parts of a Date in the app timezone — used by both toDatetimeLocalValue and fromDatetimeLocalValue
function zurichStr(d: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const { type, value } of fmt.formatToParts(d)) parts[type] = value;
  const h = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${h}:${parts.minute}`;
}

export function formatInstant(iso: string | null, timeZone = APP_TZ): string {
  if (!iso) return '–';
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso));
}

// Converts a UTC ISO string → "YYYY-MM-DDTHH:MM" in Swiss local time (for datetime-local inputs).
// Uses Intl.DateTimeFormat so the result is identical on server (UTC) and browser.
export function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return '';
  return zurichStr(new Date(iso));
}

// Converts a "YYYY-MM-DDTHH:MM" value (Swiss local time from datetime-local input) → UTC ISO string.
// Works by computing the UTC offset for APP_TZ at that date and applying it.
export function fromDatetimeLocalValue(value: string): string {
  if (!value) return '';
  // Treat input as UTC to get a reference Date, then correct for the actual Zurich offset
  const naive = new Date(value + ':00Z');
  const naiveInZurich = zurichStr(naive);
  const offsetMs = naive.getTime() - new Date(naiveInZurich + ':00Z').getTime();
  return new Date(naive.getTime() + offsetMs).toISOString();
}
