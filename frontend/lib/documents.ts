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

export interface DocumentTreeNode {
  category: string | null;
  year: number | null;
  subcategory: string | null;
  count: number;
}

export interface ChatResponse {
  answer: string;
  sources: string[];
}

export interface ChatHistoryEntry {
  id: string;
  question: string;
  answer: string;
  sources: string[];
  createdAt: string;
}

export function getDocuments(params?: { category?: string; year?: number; subcategory?: string }): Promise<Document[]> {
  if (!params || (!params.category && !params.year && !params.subcategory)) {
    return apiFetch<Document[]>('/api/documents');
  }
  const q = new URLSearchParams();
  if (params.category) q.set('category', params.category);
  if (params.year != null) q.set('year', String(params.year));
  if (params.subcategory) q.set('subcategory', params.subcategory);
  return apiFetch<Document[]>(`/api/documents?${q}`);
}

export function getDocumentTree(): Promise<DocumentTreeNode[]> {
  return apiFetch<DocumentTreeNode[]>('/api/documents/tree');
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

export function getChatHistory(): Promise<ChatHistoryEntry[]> {
  return apiFetch<ChatHistoryEntry[]>('/api/chat/history');
}

export function deleteChatHistoryEntry(id: string): Promise<void> {
  return apiFetch<void>(`/api/chat/history/${id}`, { method: 'DELETE' });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
