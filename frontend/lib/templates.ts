/**
 * Task templates API client for FamilyAdmin.
 */

import { apiFetch } from './api';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface TemplateSubtask {
  id: string;
  text: string;
  position: number;
}

export interface TaskTemplate {
  id: string;
  name: string;
  description: string | null;
  subtasks: TemplateSubtask[];
  createdByName: string;
  createdAt: string;
}

export interface TaskTemplateRequest {
  name: string;
  description?: string;
  subtasks: { text: string; position: number }[];
}

// ─── API Functions ──────────────────────────────────────────────────────────

export async function getTemplates(): Promise<TaskTemplate[]> {
  return apiFetch<TaskTemplate[]>('/api/task-templates');
}

export async function getTemplate(id: string): Promise<TaskTemplate> {
  return apiFetch<TaskTemplate>(`/api/task-templates/${id}`);
}

export async function createTemplate(data: TaskTemplateRequest): Promise<TaskTemplate> {
  return apiFetch<TaskTemplate>('/api/task-templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTemplate(id: string, data: TaskTemplateRequest): Promise<TaskTemplate> {
  return apiFetch<TaskTemplate>(`/api/task-templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteTemplate(id: string): Promise<void> {
  return apiFetch<void>(`/api/task-templates/${id}`, { method: 'DELETE' });
}

export async function useTemplate(
  id: string,
  selectedSubtaskIds: string[],
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/api/task-templates/${id}/use`, {
    method: 'POST',
    body: JSON.stringify({ selectedSubtaskIds }),
  });
}
