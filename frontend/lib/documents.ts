import { apiFetch, apiFetchMultipart } from './api';

export interface Document {
  id: string;
  filename: string;
  contentType: string;
  fileSize: number;
  source: string;
  emailSubject: string | null;
  category: string | null;
  subcategory: string | null;
  year: number | null;
  downloadUrl: string;
  createdAt: string;
}

export interface ChatResponse {
  answer: string;
  sources: string[];
}

export function getDocuments(): Promise<Document[]> {
  return apiFetch<Document[]>('/api/documents');
}

export function uploadDocument(file: File): Promise<Document> {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetchMultipart<Document>('/api/documents', formData);
}

export function deleteDocument(id: string): Promise<void> {
  return apiFetch<void>(`/api/documents/${id}`, { method: 'DELETE' });
}

export function askQuestion(question: string): Promise<ChatResponse> {
  return apiFetch<ChatResponse>('/api/chat/query', {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
