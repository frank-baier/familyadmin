'use client';

/**
 * TaskCard — compact task summary card for the task list.
 * Shows: title, status badge, assignee avatar, due date (colored), checklist progress.
 * Click navigates to /tasks/[id].
 */

import Link from 'next/link';
import type { Task } from '@/lib/tasks';
import { isOverdue, isDueToday, checklistProgress } from '@/lib/tasks';

// ─── Status badge config ────────────────────────────────────────────────────

const STATUS_CONFIG = {
  OPEN: {
    label: 'Open',
    classes: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    classes: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  },
  DONE: {
    label: 'Done',
    classes: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  },
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Component ──────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const statusConfig = STATUS_CONFIG[task.status];
  const overdue = isOverdue(task);
  const dueToday = isDueToday(task);
  const [doneCnt, totalCnt] = checklistProgress(task);
  const isDone = task.status === 'DONE';

  return (
    <Link
      href={`/tasks/${task.id}`}
      className="group flex flex-col gap-3 bg-white rounded-2xl p-5 border border-slate-100
                 hover:border-slate-200 hover:shadow-md hover:shadow-slate-100/80
                 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                 transition-all duration-200 cursor-pointer"
      aria-label={`Task: ${task.title}`}
    >
      {/* Top row: status badge + optional overdue indicator */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.classes}`}
        >
          {statusConfig.label}
        </span>

        {overdue && !isDone && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 ring-1 ring-red-200">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            Overdue
          </span>
        )}
      </div>

      {/* Title */}
      <h3
        className={[
          'text-sm font-semibold leading-snug transition-colors group-hover:text-indigo-700',
          isDone ? 'line-through text-slate-400' : 'text-slate-900',
        ].join(' ')}
      >
        {task.title}
      </h3>

      {/* Description preview */}
      {task.description && !isDone && (
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Bottom row: assignee + due date + checklist */}
      <div className="flex items-center justify-between gap-2 mt-auto pt-1">
        {/* Assignee */}
        <div className="flex items-center gap-2 min-w-0">
          {task.assignee ? (
            <>
              <div
                className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0"
                aria-hidden="true"
              >
                {getInitials(task.assignee.name)}
              </div>
              <span className="text-xs text-slate-500 truncate">{task.assignee.name}</span>
            </>
          ) : (
            <span className="text-xs text-slate-400 italic">Unassigned</span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Checklist progress */}
          {totalCnt > 0 && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {doneCnt}/{totalCnt}
            </span>
          )}

          {/* Due date */}
          {task.dueDate && (
            <span
              className={[
                'text-xs font-medium',
                overdue && !isDone
                  ? 'text-red-600'
                  : dueToday && !isDone
                  ? 'text-amber-600'
                  : 'text-slate-400',
              ].join(' ')}
            >
              {formatDueDate(task.dueDate)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
