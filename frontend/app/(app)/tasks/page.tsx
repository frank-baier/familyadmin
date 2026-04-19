'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { TaskCard } from '@/components/tasks/TaskCard';
import { getTasks, getMyTasks, isOverdue, isDueToday } from '@/lib/tasks';
import type { Task } from '@/lib/tasks';

function TaskCardSkeleton() {
  return (
    <div className="glass rounded-3xl p-5 animate-pulse space-y-3">
      <div className="h-5 w-20 bg-slate-200/70 rounded-full" />
      <div className="h-4 w-3/4 bg-slate-200/70 rounded-lg" />
      <div className="h-3 w-full bg-slate-100/70 rounded-lg" />
      <div className="flex justify-between pt-1">
        <div className="h-4 w-20 bg-slate-100/70 rounded-full" />
        <div className="h-3 w-12 bg-slate-100/70 rounded" />
      </div>
    </div>
  );
}

function SectionLabel({ label, count, variant = 'default' }: { label: string; count: number; variant?: 'overdue' | 'today' | 'default' | 'noduedate' }) {
  const colors = { overdue: 'text-red-500', today: 'text-amber-500', default: 'text-slate-500', noduedate: 'text-slate-400' };
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className={`section-label ${colors[variant]}`}>{label}</span>
      <span className="text-xs text-slate-400">{count} task{count !== 1 ? 's' : ''}</span>
      <div className="flex-1 hairline" />
    </div>
  );
}

function groupTasks(tasks: Task[]) {
  const overdue: Task[] = [], today: Task[] = [], upcoming: Task[] = [], noDueDate: Task[] = [];
  for (const t of tasks) {
    if (t.status === 'DONE' || !t.dueDate) noDueDate.push(t);
    else if (isOverdue(t)) overdue.push(t);
    else if (isDueToday(t)) today.push(t);
    else upcoming.push(t);
  }
  upcoming.sort((a, b) => a.dueDate && b.dueDate ? a.dueDate.localeCompare(b.dueDate) : 0);
  return { overdue, today, upcoming, noDueDate };
}

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
      setTasks(activeTab === 'family' ? await getTasks() : await getMyTasks());
    } catch (e) {
      setError('Failed to load tasks. Please try again.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const { overdue, today, upcoming, noDueDate } = groupTasks(tasks);
  const isEmpty = !loading && tasks.length === 0;

  return (
    <div className="max-w-2xl md:max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeTab === 'family' ? 'All family tasks' : 'Your assigned tasks'}
          </p>
        </div>
        <Link href="/tasks/new" className="btn-primary shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New
        </Link>
      </div>

      {/* Tab toggle */}
      <div
        role="tablist"
        aria-label="Task view"
        className="glass rounded-2xl p-1 flex gap-1 w-fit mb-6"
      >
        {(['family', 'mine'] as Tab[]).map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={[
              'px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
              activeTab === id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800',
            ].join(' ')}
          >
            {id === 'family' ? 'Family' : 'Mine'}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="glass rounded-2xl px-4 py-3 text-sm text-red-700 bg-red-50/70 border border-red-200/60 mb-5 flex justify-between">
          {error}
          <button onClick={loadTasks} className="ml-4 text-xs underline hover:no-underline">Retry</button>
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <TaskCardSkeleton key={i} />)}
        </div>
      )}

      {/* Empty */}
      {isEmpty && (
        <div className="glass rounded-3xl text-center py-16 px-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, #e0e7ff, #ede9fe)' }}
            aria-hidden="true"
          >
            <svg className="w-7 h-7 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            {activeTab === 'mine' ? 'No tasks assigned to you' : 'No tasks yet'}
          </h3>
          <p className="text-sm text-slate-500 mb-6 max-w-xs mx-auto">
            {activeTab === 'mine' ? 'Tasks assigned to you will appear here.' : 'Create the first task to get organised!'}
          </p>
          {activeTab === 'family' && (
            <Link href="/tasks/new" className="btn-primary">
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
          {overdue.length > 0 && (
            <section aria-labelledby="overdue-heading">
              <SectionLabel label="Overdue" count={overdue.length} variant="overdue" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {overdue.map((t) => <TaskCard key={t.id} task={t} />)}
              </div>
            </section>
          )}
          {today.length > 0 && (
            <section aria-labelledby="today-heading">
              <SectionLabel label="Due Today" count={today.length} variant="today" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {today.map((t) => <TaskCard key={t.id} task={t} />)}
              </div>
            </section>
          )}
          {upcoming.length > 0 && (
            <section aria-labelledby="upcoming-heading">
              <SectionLabel label="Upcoming" count={upcoming.length} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {upcoming.map((t) => <TaskCard key={t.id} task={t} />)}
              </div>
            </section>
          )}
          {noDueDate.length > 0 && (
            <section aria-labelledby="noduedate-heading">
              <SectionLabel label="No Due Date" count={noDueDate.length} variant="noduedate" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {noDueDate.map((t) => <TaskCard key={t.id} task={t} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
