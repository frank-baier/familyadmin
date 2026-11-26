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

export interface ChatHistoryEntry {
  id: string;
  question: string;
  answer: string;
  sources: string[];
  status: string;
  createdAt: string;
  /** e.g. "claude-haiku-5-5" or "ollama:qwen2.5:3b"; null for older entries */
  model?: string | null;
  costUsd?: number | null;
  durationMs?: number | null;
}

/** "claude-haiku-5-5" → "Claude Haiku 5.5", "ollama:qwen2.5:3b" → "Lokal (qwen2.5:3b)" */
export function formatModelName(model: string): string {
  if (model.startsWith('ollama:')) return `Lokal (${model.slice('ollama:'.length)})`;
  const m = model.match(/^claude-([a-z]+)-(\d+)(?:-(\d+))?$/);
  if (!m) return model;
  const family = m[1].charAt(0).toUpperCase() + m[1].slice(1);
  return `Claude ${family} ${m[2]}${m[3] ? '.' + m[3] : ''}`;
}

export function formatCostUsd(cost: number): string {
  if (cost === 0) return 'kostenlos';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1).replace('.', ',')} s`;
  return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
}

export interface PagedDocuments {
  content: Document[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export function getDocuments(params?: {
  category?: string;
  year?: number;
  subcategory?: string;
  subcategoryPrefix?: string;
  page?: number;
  size?: number;
}): Promise<PagedDocuments> {
  const q = new URLSearchParams();
  if (params?.category) q.set('category', params.category);
  if (params?.year != null) q.set('year', String(params.year));
  if (params?.subcategory) q.set('subcategory', params.subcategory);
  if (params?.subcategoryPrefix) q.set('subcategoryPrefix', params.subcategoryPrefix);
  q.set('page', String(params?.page ?? 0));
  q.set('size', String(params?.size ?? 50));
  return apiFetch<PagedDocuments>(`/api/documents?${q}`);
}

export function getDocumentTree(): Promise<DocumentTreeNode[]> {
  return apiFetch<DocumentTreeNode[]>('/api/documents/tree');
}

export function getUnindexedDocuments(): Promise<PagedDocuments> {
  return apiFetch<PagedDocuments>('/api/documents/unindexed');
}

export function acceptUnindexedDocuments(): Promise<void> {
  return apiFetch<void>('/api/documents/accept-unindexed', { method: 'POST' });
}

export function uploadDocument(file: File): Promise<Document> {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetchMultipart<Document>('/api/documents', formData);
}

export function deleteDocument(id: string): Promise<void> {
  return apiFetch<void>(`/api/documents/${id}`, { method: 'DELETE' });
}

export function askQuestion(question: string): Promise<ChatHistoryEntry> {
  return apiFetch<ChatHistoryEntry>('/api/chat/query', {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
}

export interface ChatSession {
  id: string;
  createdAt: string;
  /** null while the session is open */
  closedAt: string | null;
  /** oldest first */
  entries: ChatHistoryEntry[];
}

/** The open chat session, or null if none has been started yet. */
export async function getOpenChatSession(): Promise<ChatSession | null> {
  return (await apiFetch<ChatSession | undefined>('/api/chat/session')) ?? null;
}

/** Ends the open session; it moves into the history. */
export function closeChatSession(): Promise<void> {
  return apiFetch<void>('/api/chat/session/close', { method: 'POST' });
}

/** Closed sessions, newest first. */
export function getChatHistory(): Promise<ChatSession[]> {
  return apiFetch<ChatSession[]>('/api/chat/history');
}

export function deleteChatSession(id: string): Promise<void> {
  return apiFetch<void>(`/api/chat/sessions/${id}`, { method: 'DELETE' });
}

export function reindexUnindexed(): Promise<{ queued: number }> {
  return apiFetch<{ queued: number }>('/api/admin/documents/reindex-unindexed', { method: 'POST' });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
