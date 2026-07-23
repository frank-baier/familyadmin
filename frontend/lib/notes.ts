/**
 * Notes API client for FamilyAdmin
 * All functions use apiFetch from lib/api.ts (auth token injected automatically).
 * Notes are strictly personal — the backend scopes every query to the current user.
 */

import { apiFetch } from './api';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface NoteCategory {
  id: string;
  name: string;
  position: number;
  createdAt: string;
}

export interface NoteNode {
  id: string;
  categoryId: string;
  parentId: string | null;
  name: string;
  content: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface NoteNodeRequest {
  parentId?: string | null;
  name: string;
  content?: string | null;
}

// ─── Category API ────────────────────────────────────────────────────────────

export async function getNoteCategories(): Promise<NoteCategory[]> {
  return apiFetch<NoteCategory[]>('/api/notes/categories');
}

export async function createNoteCategory(name: string): Promise<NoteCategory> {
  return apiFetch<NoteCategory>('/api/notes/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function renameNoteCategory(id: string, name: string): Promise<NoteCategory> {
  return apiFetch<NoteCategory>(`/api/notes/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export async function deleteNoteCategory(id: string): Promise<void> {
  return apiFetch<void>(`/api/notes/categories/${id}`, {
    method: 'DELETE',
  });
}

// ─── Node API ────────────────────────────────────────────────────────────────

export async function getNoteNodes(categoryId: string): Promise<NoteNode[]> {
  return apiFetch<NoteNode[]>(`/api/notes/categories/${categoryId}/nodes`);
}

export async function createNoteNode(categoryId: string, data: NoteNodeRequest): Promise<NoteNode> {
  return apiFetch<NoteNode>(`/api/notes/categories/${categoryId}/nodes`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateNoteNode(id: string, data: NoteNodeRequest): Promise<NoteNode> {
  return apiFetch<NoteNode>(`/api/notes/nodes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteNoteNode(id: string): Promise<void> {
  return apiFetch<void>(`/api/notes/nodes/${id}`, {
    method: 'DELETE',
  });
}

export async function searchNoteNodes(query: string): Promise<NoteNode[]> {
  return apiFetch<NoteNode[]>(`/api/notes/search?q=${encodeURIComponent(query)}`);
}
