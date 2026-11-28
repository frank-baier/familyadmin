import { apiFetch, apiFetchMultipart } from '@familyadmin/shared/api';

export type JobStatus = 'IDLE' | 'RUNNING' | 'ERROR';
export type ItemSource = 'BASELINE' | 'PRIOR_YEAR' | 'RETURN' | 'MANUAL';
export type AiStatus = 'FOUND' | 'PARTIAL' | 'MISSING' | 'UNKNOWN';
export type UserStatus = 'DONE' | 'NOT_NEEDED';
export type HintStatus = 'PENDING' | 'COPY_REQUESTED' | 'COPIED' | 'DISMISSED';

export interface TaxFile {
  /** Path below iCloud "Dokumente" */
  path: string;
  name: string;
  rubric: string;
  size: number | null;
  modified: string | null;
}

export interface TaxItem {
  id: string;
  rubric: string | null;
  title: string;
  person: string | null;
  note: string | null;
  source: ItemSource;
  aiStatus: AiStatus;
  matchedFiles: string[];
  priorFiles: string[];
  userStatus: UserStatus | null;
}

export interface TaxHint {
  id: string;
  documentId: string;
  filename: string;
  /** Archive location, e.g. "Gesundheit / Petra / 2025" */
  documentPath: string | null;
  status: HintStatus;
  rubric: string | null;
  reason: string | null;
  targetFolder: string | null;
  finalPath: string | null;
  copyError: string | null;
}

export interface JobInfo {
  status: JobStatus;
  error: string | null;
  finishedAt: string | null;
  costUsd: number | null;
}

export interface TaxOverview {
  year: number;
  years: number[];
  aiConfigured: boolean;
  folder: string;
  listingUpdatedAt: string | null;
  files: TaxFile[];
  rubrics: string[];
  items: TaxItem[];
  checklistSummary: string | null;
  checklist: JobInfo;
  checklistStale: boolean;
  hints: JobInfo;
  uncheckedDocuments: number;
  hintItems: TaxHint[];
  priorReturn: JobInfo;
  priorReturnFilename: string | null;
  priorReturnSummary: string | null;
}

const BASE = '/api/documents/tax';

export function getTaxOverview(year?: number): Promise<TaxOverview> {
  return apiFetch<TaxOverview>(year ? `${BASE}?year=${year}` : BASE);
}

export function refreshChecklist(year: number): Promise<void> {
  return apiFetch<void>(`${BASE}/${year}/checklist/refresh`, { method: 'POST' });
}

export function scanHints(year: number): Promise<void> {
  return apiFetch<void>(`${BASE}/${year}/hints/scan`, { method: 'POST' });
}

/** Return of year - 1 (PDF). */
export function importPriorReturn(year: number, file: File): Promise<void> {
  const fd = new FormData();
  fd.append('file', file);
  return apiFetchMultipart<void>(`${BASE}/${year}/prior-return`, fd);
}

export function addTaxItem(year: number, item: { rubric?: string; title: string; person?: string; note?: string }) {
  return apiFetch<TaxItem>(`${BASE}/${year}/items`, { method: 'POST', body: JSON.stringify(item) });
}

export function setTaxItemStatus(id: string, userStatus: UserStatus | null) {
  return apiFetch<TaxItem>(`${BASE}/items/${id}`, { method: 'PATCH', body: JSON.stringify({ userStatus }) });
}

export function deleteTaxItem(id: string) {
  return apiFetch<void>(`${BASE}/items/${id}`, { method: 'DELETE' });
}

export function copyHint(id: string, folder?: string) {
  return apiFetch<TaxHint>(`${BASE}/hints/${id}/copy`, { method: 'POST', body: JSON.stringify({ folder }) });
}

export function dismissHint(id: string) {
  return apiFetch<TaxHint>(`${BASE}/hints/${id}/dismiss`, { method: 'POST' });
}

export function undoHint(id: string) {
  return apiFetch<TaxHint>(`${BASE}/hints/${id}/undo`, { method: 'POST' });
}
