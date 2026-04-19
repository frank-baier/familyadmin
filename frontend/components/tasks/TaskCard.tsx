'use client';

import Link from 'next/link';
import type { Task } from '@/lib/tasks';
import { isOverdue, isDueToday, checklistProgress } from '@/lib/tasks';

const STATUS_CONFIG = {
  OPEN: { label: 'Open', bg: 'bg-indigo-50', text: 'text-indigo-700', ring: 'ring-indigo-200/60' },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200/60' },
  DONE: { label: 'Done', bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200/60' },
} as const;

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}
function formatDue(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function TaskCard({ task }: { task: Task }) {
  const cfg = STATUS_CONFIG[task.status];
  const overdue = isOverdue(task);
  const dueToday = isDueToday(task);
  const [done, total] = checklistProgress(task);
  const isDone = task.status === 'DONE';

  return (
    <Link
      href={`/tasks/${task.id}`}
      className="glass-interactive rounded-3xl p-5 flex flex-col gap-3 group
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      aria-label={`Task: ${task.title}`}
    >
      {/* Status row */}
      <div className="flex items-center justify-between gap-2">
        <span className={`pill ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}>
          {cfg.label}
        </span>
        {overdue && !isDone && (
          <span className="pill bg-red-50 text-red-600 ring-1 ring-red-200/60">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            Overdue
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className={[
        'text-sm font-semibold leading-snug transition-colors group-hover:text-indigo-600',
        isDone ? 'line-through text-slate-400' : 'text-slate-900',
      ].join(' ')}>
        {task.title}
      </h3>

      {/* Description */}
      {task.description && !isDone && (
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{task.description}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 mt-auto pt-1">
        <div className="flex items-center gap-2 min-w-0">
          {task.assignee ? (
            <>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{ background: 'linear-gradient(135deg, #e0e7ff, #ede9fe)', color: '#4f46e5' }}
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
          {total > 0 && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {done}/{total}
            </span>
          )}
          {task.dueDate && (
            <span className={[
              'text-xs font-medium',
              overdue && !isDone ? 'text-red-500' : dueToday && !isDone ? 'text-amber-500' : 'text-slate-400',
            ].join(' ')}>
              {formatDue(task.dueDate)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
