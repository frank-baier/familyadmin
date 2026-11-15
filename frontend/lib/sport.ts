import { apiFetch, apiFetchMultipart, ApiError } from '@/lib/api';

export type SportCategory = 'RUN' | 'RIDE' | 'SWIM' | 'WALK' | 'WINTER' | 'STRENGTH' | 'OTHER';

export interface CategoryTotals { category: SportCategory; count: number; distanceKm: number; hours: number; elevationM: number }
export interface YearStat { year: number; count: number; distanceKm: number; hours: number; elevationM: number; activeDays: number; byCategory: CategoryTotals[] }
export interface MonthStat { month: string; count: number; distanceKm: number; hours: number; elevationM: number; byCategory: CategoryTotals[] }
export interface DayStat { date: string; count: number; distanceKm: number; hours: number; load: number }
export interface FitnessPoint { date: string; fitness: number; fatigue: number; form: number }
export interface MonthValue { month: string; value: number; samples: number }

export type FormStatus = 'NONE' | 'DETRAINED' | 'FRESH' | 'READY' | 'NEUTRAL' | 'PRODUCTIVE' | 'OVERREACHING';

export interface Fitness {
  maxHr: number; maxHrEstimated: boolean; restingHr: number; restingHrEstimated: boolean;
  age: number | null; sex: 'MALE' | 'FEMALE' | null;
  hrCoverage: number;
  currentFitness: number; currentFatigue: number; currentForm: number; rampRate: number;
  formStatus: FormStatus;
  peakFitness: number; peakFitnessDate: string | null;
  series: FitnessPoint[];
  vo2max: number | null; vo2maxTrend: MonthValue[];
  runEfficiency: MonthValue[]; rideEfficiency: MonthValue[];
  intensity90d: { easyHours: number; moderateHours: number; hardHours: number };
}

export interface PersonalRecord {
  category: SportCategory; kind: 'DISTANCE' | 'DURATION' | 'ELEVATION' | 'SPEED';
  label: string; value: number; activityName: string | null; date: string;
}

export interface Insight { tone: 'POSITIVE' | 'NEUTRAL' | 'WARNING'; title: string; text: string }

export interface ActivityItem {
  id: string; name: string | null; sportType: string; category: SportCategory; start: string;
  distanceKm: number; hours: number; elevationM: number; avgHr: number | null; load: number;
}

export interface SportStats {
  summary: { activities: number; distanceKm: number; hours: number; elevationM: number; calories: number; firstDate: string | null; lastDate: string | null; activeDays: number };
  ytd: { year: number; asOf: string; count: number; distanceKm: number; hours: number; prevCount: number; prevDistanceKm: number; prevHours: number };
  years: YearStat[];
  months: MonthStat[];
  days: DayStat[];
  fitness: Fitness;
  records: PersonalRecord[];
  consistency: { currentWeekStreak: number; longestWeekStreak: number; longestStreakEnd: string | null; weekdayCounts: number[]; hourCounts: number[]; avgPerWeek12: number };
  insights: Insight[];
  recent: ActivityItem[];
}

export interface SportProfile { maxHeartRate: number | null; restingHeartRate: number | null; birthYear: number | null; sex: 'MALE' | 'FEMALE' | null }
export interface SportImportResult { imported: number; updated: number; totalActivities: number; warnings: string[] }

export const getSportStats = () => apiFetch<SportStats>('/api/sport/stats');
export const getSportProfile = () => apiFetch<SportProfile>('/api/sport/profile');
export const updateSportProfile = (p: SportProfile) =>
  apiFetch<SportProfile>('/api/sport/profile', { method: 'PUT', body: JSON.stringify(p) });
export const deleteAllActivities = () => apiFetch<{ deleted: number }>('/api/sport/activities', { method: 'DELETE' });

export async function importStravaExport(file: File): Promise<SportImportResult> {
  const form = new FormData();
  form.append('file', file);
  return apiFetchMultipart<SportImportResult>('/api/sport/import/strava', form);
}

export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const body = err.body as { error?: string } | undefined;
    if (body?.error) return body.error;
    if (err.status === 413) return 'Datei zu groß (max. 100 MB). Lade stattdessen nur die activities.csv aus dem ZIP hoch.';
  }
  return fallback;
}

// ─── Presentation helpers ────────────────────────────────────────────────────

/** Categorical slots in fixed order (validated palette, light mode). Color follows the sport, never its rank. */
export const CATEGORY_META: Record<SportCategory, { label: string; color: string }> = {
  RUN:      { label: 'Laufen',     color: '#2a78d6' },
  RIDE:     { label: 'Radfahren',  color: '#eb6834' },
  SWIM:     { label: 'Schwimmen',  color: '#1baf7a' },
  WALK:     { label: 'Gehen & Wandern', color: '#eda100' },
  WINTER:   { label: 'Wintersport', color: '#e87ba4' },
  STRENGTH: { label: 'Kraft & Workout', color: '#008300' },
  OTHER:    { label: 'Sonstiges',  color: '#6250d6' },
};
export const CATEGORY_ORDER: SportCategory[] = ['RUN', 'RIDE', 'SWIM', 'WALK', 'WINTER', 'STRENGTH', 'OTHER'];

const nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export const fmt0 = (v: number) => nf0.format(v);
export const fmt1 = (v: number) => nf1.format(v);

export function compact(v: number): string {
  if (Math.abs(v) >= 10000) return `${nf1.format(v / 1000)}K`;
  return nf0.format(v);
}

export function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${m.toString().padStart(2, '0')} min` : `${m} min`;
}

export function fmtHours(hours: number): string {
  return fmtDuration(hours * 3600);
}

/** Pace (min/km) for running/walking/swimming per 100 m, speed (km/h) otherwise. */
export function fmtSpeed(mps: number, category: SportCategory): string {
  if (mps <= 0) return '–';
  if (category === 'SWIM') {
    const s = 100 / mps;
    return `${Math.floor(s / 60)}:${Math.round(s % 60).toString().padStart(2, '0')} /100 m`;
  }
  if (category === 'RUN' || category === 'WALK') {
    const s = 1000 / mps;
    return `${Math.floor(s / 60)}:${Math.round(s % 60).toString().padStart(2, '0')} /km`;
  }
  return `${fmt1(mps * 3.6)} km/h`;
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  return new Intl.DateTimeFormat('de-DE', opts).format(new Date(iso.length === 10 ? `${iso}T00:00:00` : iso));
}

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
export const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export const FORM_STATUS_META: Record<FormStatus, { label: string; tone: 'good' | 'neutral' | 'warning' }> = {
  NONE:         { label: 'Keine Daten', tone: 'neutral' },
  DETRAINED:    { label: 'Pause', tone: 'neutral' },
  FRESH:        { label: 'Topfrisch', tone: 'good' },
  READY:        { label: 'Erholt', tone: 'good' },
  NEUTRAL:      { label: 'Ausgeglichen', tone: 'neutral' },
  PRODUCTIVE:   { label: 'Aufbauphase', tone: 'good' },
  OVERREACHING: { label: 'Überlastet', tone: 'warning' },
};

/**
 * Rough VO2max norm classes (ml/kg/min) by age band, after ACSM / Cooper Institute tables.
 * Returns null without age+sex. Thresholds are lower bounds for: Mittel, Gut, Sehr gut, Exzellent.
 */
export function vo2maxClass(vo2: number, age: number | null, sex: 'MALE' | 'FEMALE' | null): string | null {
  if (age == null || sex == null) return null;
  const male: [number, number[]][] = [
    [29, [38, 43, 48, 53]], [39, [36, 41, 46, 51]], [49, [34, 38, 43, 48]],
    [59, [31, 35, 40, 45]], [69, [28, 32, 36, 41]], [200, [25, 29, 33, 37]],
  ];
  const female: [number, number[]][] = [
    [29, [32, 37, 41, 46]], [39, [30, 34, 39, 44]], [49, [28, 32, 36, 41]],
    [59, [25, 29, 33, 37]], [69, [23, 26, 30, 34]], [200, [21, 24, 27, 31]],
  ];
  const table = sex === 'FEMALE' ? female : male;
  const [, t] = table.find(([maxAge]) => age <= maxAge)!;
  if (vo2 >= t[3]) return 'Exzellent';
  if (vo2 >= t[2]) return 'Sehr gut';
  if (vo2 >= t[1]) return 'Gut';
  if (vo2 >= t[0]) return 'Mittel';
  return 'Unterdurchschnittlich';
}
