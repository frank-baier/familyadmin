import { apiFetch } from '@familyadmin/shared/api';

export type ScanStatus = 'ANALYZING' | 'PENDING' | 'APPROVED' | 'DONE' | 'REJECTED' | 'GONE';

export interface ScanItem {
  id: string;
  /** File name as it lies in iCloud "Dokumente/_Wohin?" */
  sourceName: string;
  contentType: string;
  fileSize: number;
  status: ScanStatus;
  /** PDF_TEXT = existing OCR text used, DOCUMENT/IMAGE = read by the AI, NONE = file name only */
  analysisInput: string | null;
  userHint: string | null;
  /** Path below "Dokumente", e.g. "Behörden/Finanzamt/Steuerunterlagen 2025/10 Versicherungen" */
  suggestedFolder: string | null;
  suggestedFilename: string | null;
  taxRelevant: boolean | null;
  suggestionReason: string | null;
  suggestionModel: string | null;
  suggestionCostUsd: number | null;
  analysisError: string | null;
  targetFolder: string | null;
  targetFilename: string | null;
  finalPath: string | null;
  moveError: string | null;
  createdAt: string;
  movedAt: string | null;
  previewUrl: string | null;
}

export interface ScanInboxStatusInfo {
  pending: number;
  aiConfigured: boolean;
  catalogUpdatedAt: string | null;
}

const BASE = '/api/documents/scan';

export function getScanItems(): Promise<ScanItem[]> {
  return apiFetch<ScanItem[]>(BASE);
}

export function getScanStatus(): Promise<ScanInboxStatusInfo> {
  return apiFetch<ScanInboxStatusInfo>(`${BASE}/status`);
}

export function getScanFolders(): Promise<string[]> {
  return apiFetch<string[]>(`${BASE}/folders`);
}

/** Without arguments: exactly as suggested. */
export function approveScan(id: string, folder?: string, filename?: string): Promise<ScanItem> {
  return apiFetch<ScanItem>(`${BASE}/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ folder, filename }),
  });
}

export function rejectScan(id: string): Promise<ScanItem> {
  return apiFetch<ScanItem>(`${BASE}/${id}/reject`, { method: 'POST' });
}

export function undoScan(id: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${id}/undo`, { method: 'POST' });
}

export function reanalyzeScan(id: string, hint: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${id}/reanalyze`, {
    method: 'POST',
    body: JSON.stringify({ hint }),
  });
}
