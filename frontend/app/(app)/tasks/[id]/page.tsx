'use client';

/**
 * Task detail page — /tasks/[id]
 * Shows all task fields, toggleable checklist, Mark Complete, Delete with confirm.
 */

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChecklistItem } from '@/components/tasks/ChecklistItem';
import { getTask, completeTask, deleteTask, isOverdue, isDueToday } from '@/lib/tasks';
import type { Task, ChecklistItem as ChecklistItemType } from '@/lib/tasks';
import { useUser } from '@/lib/user-context';

// ─── Status badge config ─────────────────────────────────────────────────────

const STATUS_CONFIG = {
  OPEN: { label: 'Open', classes: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' },
  IN_PROGRESS: { label: 'In Progress', classes: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
  DONE: { label: 'Done', classes: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function TaskDetailSkeleton() {
  return (
    <div className="max-w-2xl mx-auto animate-pulse">
      <div className="h-4 w-24 bg-slate-100 rounded mb-8" />
      <div className="space-y-4">
        <div className="h-7 w-3/4 bg-slate-100 rounded" />
        <div className="flex gap-2">
          <div className="h-6 w-16 bg-slate-100 rounded-full" />
          <div className="h-6 w-24 bg-slate-100 rounded-full" />
        </div>
        <div className="h-4 w-full bg-slate-50 rounded mt-4" />
        <div className="h-4 w-5/6 bg-slate-50 rounded" />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TaskDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useUser();
  const isAdmin = user?.role === 'ADMIN';

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    getTask(id)
      .then(setTask)
      .catch(() => setError('Task not found or you do not have access.'))
      .finally(() => setLoading(false));
  }, [id]);

  function handleChecklistToggle(updatedItem: ChecklistItemType) {
    setTask((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        checklistItems: prev.checklistItems.map((i) =>
          i.id === updatedItem.id ? updatedItem : i,
        ),
      };
    });
  }

  async function handleComplete() {
    if (!task || completing) return;
    setCompleting(true);
    try {
      const updated = await completeTask(task.id);
      setTask(updated);
    } catch {
      // Could show a toast here in a future iteration
      console.error('Failed to complete task');
    } finally {
      setCompleting(false);
    }
  }

  async function handleDelete() {
    if (!task || deleting) return;
    setDeleting(true);
    try {
      await deleteTask(task.id);
      router.push('/tasks');
    } catch {
      console.error('Failed to delete task');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto">
      <TaskDetailSkeleton />
    </div>
  );

  if (error || !task) {
    return (
      <div className="max-w-2xl mx-auto">
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900
                     transition-colors mb-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Tasks
        </Link>
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-red-700 text-sm">
          {error ?? 'Task not found.'}
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[task.status];
  const overdue = isOverdue(task);
  const dueToday = isDueToday(task);
  const isDone = task.status === 'DONE';
  const sortedChecklist = [...task.checklistItems].sort((a, b) => a.position - b.position);
  const doneCount = sortedChecklist.filter((i) => i.done).length;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back link */}
      <Link
        href="/tasks"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900
                   transition-colors mb-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Tasks
      </Link>

      {/* Main card */}
      <div className="glass rounded-3xl overflow-hidden">
        {/* Overdue banner */}
        {overdue && !isDone && (
          <div className="bg-red-50/80 border-b border-red-100/80 px-6 py-2.5 flex items-center gap-2">
            <svg className="w-4 h-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium text-red-700">
              This task is overdue — was due {formatDate(task.dueDate!)}
            </span>
          </div>
        )}

        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <h1
              className={[
                'text-xl font-bold leading-snug tracking-tight',
                isDone ? 'line-through text-slate-400' : 'text-slate-900',
              ].join(' ')}
            >
              {task.title}
            </h1>

            {/* Edit button — admins only */}
            {isAdmin && (
              <Link
                href={`/tasks/${task.id}/edit`}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                           text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-slate-700
                           focus:outline-none focus:ring-2 focus:ring-indigo-500
                           transition-all duration-150"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                </svg>
                Edit
              </Link>
            )}
          </div>

          {/* Status + actions row */}
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.classes}`}>
              {statusConfig.label}
            </span>

            {!isDone && (
              <button
                onClick={handleComplete}
                disabled={completing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                           text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100
                           disabled:opacity-60 disabled:cursor-not-allowed
                           focus:outline-none focus:ring-2 focus:ring-emerald-500
                           transition-all duration-150"
              >
                {completing ? (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
                Mark Complete
              </button>
            )}

            {isDone && task.completedAt && (
              <span className="text-xs text-slate-400">
                Completed {formatDateTime(task.completedAt)}
              </span>
            )}
          </div>
        </div>

        <div className="hairline mx-4" />

        {/* Meta info */}
        <dl className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Assignee */}
          <div>
            <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Assigned to</dt>
            <dd>
              {task.assignee ? (
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold"
                    aria-hidden="true"
                  >
                    {getInitials(task.assignee.name)}
                  </div>
                  <span className="text-sm text-slate-700 font-medium">{task.assignee.name}</span>
                </div>
              ) : (
                <span className="text-sm text-slate-400 italic">Unassigned</span>
              )}
            </dd>
          </div>

          {/* Due date */}
          <div>
            <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Due date</dt>
            <dd>
              {task.dueDate ? (
                <span className={[
                  'text-sm font-medium',
                  overdue && !isDone ? 'text-red-600' : dueToday && !isDone ? 'text-amber-600' : 'text-slate-700',
                ].join(' ')}>
                  {formatDate(task.dueDate)}
                </span>
              ) : (
                <span className="text-sm text-slate-400 italic">No due date</span>
              )}
            </dd>
          </div>

          {/* Created by */}
          <div>
            <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Created by</dt>
            <dd className="text-sm text-slate-700">{task.createdBy.name}</dd>
          </div>

          {/* Created at */}
          <div>
            <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Created</dt>
            <dd className="text-sm text-slate-700">{formatDateTime(task.createdAt)}</dd>
          </div>
        </dl>

        {/* Description */}
        {task.description && (
          <>
            <div className="hairline mx-4" />
            <div className="px-6 py-4">
              <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Description</h2>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{task.description}</p>
            </div>
          </>
        )}

        {/* Checklist */}
        {sortedChecklist.length > 0 && (
          <>
            <div className="hairline mx-4" />
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide">Checklist</h2>
                <span className="text-xs text-slate-400 font-medium">
                  {doneCount}/{sortedChecklist.length} done
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-slate-100 rounded-full mb-3 overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full transition-all duration-300"
                  style={{ width: `${sortedChecklist.length > 0 ? (doneCount / sortedChecklist.length) * 100 : 0}%` }}
                  role="progressbar"
                  aria-valuenow={doneCount}
                  aria-valuemin={0}
                  aria-valuemax={sortedChecklist.length}
                  aria-label="Checklist progress"
                />
              </div>

              <ul className="divide-y divide-slate-50" aria-label="Checklist items">
                {sortedChecklist.map((item) => (
                  <ChecklistItem
                    key={item.id}
                    item={item}
                    taskId={task.id}
                    onToggle={handleChecklistToggle}
                  />
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Footer: delete */}
        <div className="hairline mx-4" /><div className="px-6 py-4 flex justify-end">
          {showDeleteConfirm ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600">Delete this task?</span>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800
                           border border-slate-200 rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-slate-400
                           transition-all duration-150"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                           text-white bg-red-600 hover:bg-red-700 rounded-lg
                           disabled:opacity-60 disabled:cursor-not-allowed
                           focus:outline-none focus:ring-2 focus:ring-red-500
                           transition-all duration-150"
              >
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                         text-red-500 hover:text-red-700 hover:bg-red-50
                         border border-transparent hover:border-red-200
                         focus:outline-none focus:ring-2 focus:ring-red-400
                         transition-all duration-150"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Delete task
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
