import { apiFetch } from '@familyadmin/shared/api';

export interface HealthDay { date: string; metrics: Record<string, number> }
export interface HealthDaily { days: HealthDay[]; lastSyncAt: string | null }
export interface HealthToken { exists: boolean; createdAt: string | null; lastUsedAt: string | null; token: string | null }

export const getHealthDaily = (days = 90) => apiFetch<HealthDaily>(`/api/health/daily?days=${days}`);
export const getHealthToken = () => apiFetch<HealthToken>('/api/health/token');
export const rotateHealthToken = () => apiFetch<HealthToken>('/api/health/token', { method: 'POST' });
export const revokeHealthToken = () => apiFetch<void>('/api/health/token', { method: 'DELETE' });

/** Display order + formatting. `lowerIsBetter` only flips the colour of the trend arrow. */
export const HEALTH_METRICS: { key: string; label: string; unit: string; decimals: number; lowerIsBetter?: boolean; neutral?: boolean }[] = [
  { key: 'steps', label: 'Schritte', unit: '', decimals: 0 },
  { key: 'active_energy_kcal', label: 'Aktivenergie', unit: 'kcal', decimals: 0 },
  { key: 'exercise_minutes', label: 'Trainingsminuten', unit: 'min', decimals: 0 },
  { key: 'walking_distance_km', label: 'Gehdistanz', unit: 'km', decimals: 1 },
  { key: 'flights_climbed', label: 'Stockwerke', unit: '', decimals: 0 },
  { key: 'sleep_hours', label: 'Schlaf', unit: 'h', decimals: 1 },
  { key: 'resting_hr', label: 'Ruhepuls', unit: 'bpm', decimals: 0, lowerIsBetter: true },
  { key: 'hrv_ms', label: 'HRV', unit: 'ms', decimals: 0 },
  { key: 'vo2max', label: 'VO₂max', unit: '', decimals: 1 },
  { key: 'weight_kg', label: 'Gewicht', unit: 'kg', decimals: 1, neutral: true },
  { key: 'body_fat_pct', label: 'Körperfett', unit: '%', decimals: 1, neutral: true },
];
