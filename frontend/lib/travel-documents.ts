import { apiFetch, apiFetchMultipart } from './api';
import type { User } from './auth';

export type DocumentSource = 'UPLOAD' | 'EMAIL';

export interface TripDocument {
  id: string;
  filename: string;
  contentType: string;
  fileSize: number;
  source: DocumentSource;
  emailSubject: string | null;
  uploadedBy: User;
  downloadUrl: string;
  createdAt: string;
}

export async function getDocuments(tripId: string): Promise<TripDocument[]> {
  return apiFetch<TripDocument[]>(`/api/trips/${tripId}/documents`);
}

export async function uploadDocument(tripId: string, file: File): Promise<TripDocument> {
  const form = new FormData();
  form.append('file', file);
  return apiFetchMultipart<TripDocument>(`/api/trips/${tripId}/documents`, form);
}

export async function deleteDocument(tripId: string, documentId: string): Promise<void> {
  return apiFetch<void>(`/api/trips/${tripId}/documents/${documentId}`, {
    method: 'DELETE',
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
