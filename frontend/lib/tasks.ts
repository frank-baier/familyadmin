/**
 * Tasks API client for FamilyAdmin
 * All functions use apiFetch from lib/api.ts (auth token injected automatically).
 * Backend: Spring Boot at http://localhost:8080
 */

import { apiFetch } from './api';
import type { User } from './auth';

// ─── Types ─────────────────────────────────────────────────────────────────

export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  position: number;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignee: User | null;
  createdBy: User;
  dueDate: string | null;          // ISO date string "YYYY-MM-DD"
  completedAt: string | null;      // ISO datetime string
  checklistItems: ChecklistItem[];
  createdAt: string;               // ISO datetime string
}

export interface TaskRequest {
  title: string;
  description?: string;
  assigneeId?: string;
  dueDate?: string;                // "YYYY-MM-DD"
  checklistItems?: { text: string; position: number }[];
}

// ─── API Functions ──────────────────────────────────────────────────────────

/** Get all family tasks */
export async function getTasks(): Promise<Task[]> {
  return apiFetch<Task[]>('/api/tasks');
}

/** Get tasks assigned to the current user */
export async function getMyTasks(): Promise<Task[]> {
  return apiFetch<Task[]>('/api/tasks/mine');
}

/** Get a single task by id */
export async function getTask(id: string): Promise<Task> {
  return apiFetch<Task>(`/api/tasks/${id}`);
}

/** Create a new task */
export async function createTask(data: TaskRequest): Promise<Task> {
  return apiFetch<Task>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Update an existing task */
export async function updateTask(id: string, data: TaskRequest): Promise<Task> {
  return apiFetch<Task>(`/api/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/** Mark a task as complete (sets status to DONE) */
export async function completeTask(id: string): Promise<Task> {
  return apiFetch<Task>(`/api/tasks/${id}/complete`, {
    method: 'PATCH',
  });
}

/** Toggle a checklist item's done state */
export async function toggleChecklistItem(
  taskId: string,
  itemId: string,
): Promise<ChecklistItem> {
  return apiFetch<ChecklistItem>(`/api/tasks/${taskId}/checklist/${itemId}/toggle`, {
    method: 'PATCH',
  });
}

/** Delete a task */
export async function deleteTask(id: string): Promise<void> {
  return apiFetch<void>(`/api/tasks/${id}`, {
    method: 'DELETE',
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returns true if the task's due date is in the past and it is not DONE */
export function isOverdue(task: Pick<Task, 'dueDate' | 'status'>): boolean {
  if (!task.dueDate || task.status === 'DONE') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.dueDate);
  return due < today;
}

/** Returns true if the task is due today */
export function isDueToday(task: Pick<Task, 'dueDate' | 'status'>): boolean {
  if (!task.dueDate || task.status === 'DONE') return false;
  const today = new Date();
  const due = new Date(task.dueDate);
  return (
    due.getFullYear() === today.getFullYear() &&
    due.getMonth() === today.getMonth() &&
    due.getDate() === today.getDate()
  );
}

/** Checklist progress: [doneCount, totalCount] */
export function checklistProgress(task: Pick<Task, 'checklistItems'>): [number, number] {
  const total = task.checklistItems.length;
  const done = task.checklistItems.filter((i) => i.done).length;
  return [done, total];
}
