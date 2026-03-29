'use client';

/**
 * Tasks list page — /tasks
 * - "Family Tasks" / "My Tasks" toggle
 * - Grid of TaskCards grouped by: overdue / due / no-date
 * - "New Task" button
 * - Empty state + loading skeleton
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { TaskCard } from '@/components/tasks/TaskCard';
import { getTasks, getMyTasks, isOverdue, isDueToday } from '@/lib/tasks';
import type { Task } from '@/lib/tasks';

// ─── Skeleton ───────────────────────────────────────────────────────────────

function TaskCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 animate-pulse space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-5 w-16 bg-slate-100 rounded-full" />
      </div>
      <div className="h-4 w-3/4 bg-slate-100 rounded" />
      <div className="h-3 w-full bg-slate-50 rounded" />
      <div className="h-3 w-5/6 bg-slate-50 rounded" />
      <div className="flex items-center justify-between pt-1">
        <div className="h-4 w-20 bg-slate-100 rounded-full" />
        <div className="h-3 w-12 bg-slate-100 rounded" />
      </div>
    </div>
  );
}

// ─── Section header ──────────────────────────────────────────────────────────

function SectionHeader({
  label,
  count,
  variant = 'default',
}: {
  label: string;
  count: number;
  variant?: 'overdue' | 'today' | 'default' | 'noduedate';
}) {
  const colors = {
    overdue: 'text-red-600',
    today: 'text-amber-600',
    default: 'text-slate-500',
    noduedate: 'text-slate-400',
  };

  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className={`text-xs font-semibold uppercase tracking-widest ${colors[variant]}`}>
        {label}
      </h2>
      <span className="text-xs text-slate-400 font-medium">
        {count} task{count !== 1 ? 's' : ''}
      </span>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

// ─── Group tasks ─────────────────────────────────────────────────────────────

function groupTasks(tasks: Task[]) {
  const overdue: Task[] = [];
  const today: Task[] = [];
  const upcoming: Task[] = [];
  const noDueDate: Task[] = [];

  for (const task of tasks) {
    if (task.status === 'DONE') {
      noDueDate.push(task); // done tasks go at end
    } else if (!task.dueDate) {
      noDueDate.push(task);
    } else if (isOverdue(task)) {
      overdue.push(task);
    } else if (isDueToday(task)) {
      today.push(task);
    } else {
      upcoming.push(task);
    }
  }

  // Sort upcoming by due date ascending
  upcoming.sort((a, b) =>
    a.dueDate && b.dueDate ? a.dueDate.localeCompare(b.dueDate) : 0,
  );

  return { overdue, today, upcoming, noDueDate };
}

// ─── Main page ───────────────────────────────────────────────────────────────

type Tab = 'family' | 'mine';

export default function TasksPage() {
  const [activeTab, setActiveTab] = useState<Tab>('family');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = activeTab === 'family' ? await getTasks() : await getMyTasks();
      setTasks(data);
    } catch (err) {
      setError('Failed to load tasks. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const { overdue, today, upcoming, noDueDate } = groupTasks(tasks);
  const isEmpty = !loading && tasks.length === 0;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tasks</h1>
          <p className="text-slate-500 text-sm mt-1">
            {activeTab === 'family' ? 'All family tasks' : 'Tasks assigned to you'}
          </p>
        </div>

        <Link
          href="/tasks/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                     bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                     transition-all duration-150 shadow-sm shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Task
        </Link>
      </div>

      {/* Family / My Tasks toggle */}
      <div
        role="tablist"
        aria-label="Task view"
        className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit mb-8"
      >
        {([
          { id: 'family', label: 'Family Tasks' },
          { id: 'mine', label: 'My Tasks' },
        ] as { id: Tab; label: string }[]).map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500',
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6 flex items-center justify-between"
        >
          {error}
          <button
            onClick={loadTasks}
            className="ml-4 text-xs font-medium text-red-700 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <TaskCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-indigo-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            {activeTab === 'mine' ? 'No tasks assigned to you' : 'No tasks yet'}
          </h3>
          <p className="text-sm text-slate-500 mb-6 max-w-xs mx-auto">
            {activeTab === 'mine'
              ? 'Tasks assigned to you will appear here.'
              : 'Create the first task to get the family organised!'}
          </p>
          {activeTab === 'family' && (
            <Link
              href="/tasks/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                         bg-indigo-600 text-white hover:bg-indigo-700
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                         transition-all duration-150"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Create first task
            </Link>
          )}
        </div>
      )}

      {/* Task groups */}
      {!loading && !isEmpty && (
        <div className="space-y-10">
          {/* Overdue */}
          {overdue.length > 0 && (
            <section aria-labelledby="overdue-heading">
              <SectionHeader
                label="Overdue"
                count={overdue.length}
                variant="overdue"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {overdue.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </section>
          )}

          {/* Due Today */}
          {today.length > 0 && (
            <section aria-labelledby="today-heading">
              <SectionHeader
                label="Due Today"
                count={today.length}
                variant="today"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {today.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </section>
          )}

          {/* Upcoming (has due date, not overdue) */}
          {upcoming.length > 0 && (
            <section aria-labelledby="upcoming-heading">
              <SectionHeader
                label="Upcoming"
                count={upcoming.length}
                variant="default"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {upcoming.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </section>
          )}

          {/* No due date / Done */}
          {noDueDate.length > 0 && (
            <section aria-labelledby="noduedate-heading">
              <SectionHeader
                label="No Due Date"
                count={noDueDate.length}
                variant="noduedate"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {noDueDate.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
