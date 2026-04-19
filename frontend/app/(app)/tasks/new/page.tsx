'use client';

/**
 * New Task page — /tasks/new
 * Wraps TaskForm. On submit: creates task and redirects to /tasks.
 */

import Link from 'next/link';
import { TaskForm } from '@/components/tasks/TaskForm';
import { createTask } from '@/lib/tasks';
import type { TaskRequest } from '@/lib/tasks';

export default function NewTaskPage() {
  async function handleSubmit(data: TaskRequest) {
    await createTask(data);
    // Redirect is handled inside TaskForm via useEffect on success state
  }

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

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">New Task</h1>
        <p className="text-slate-500 text-sm mt-1">
          Add a new task for the family to track.
        </p>
      </div>

      {/* Form card */}
      <div className="glass rounded-3xl px-6 py-6">
        <TaskForm onSubmit={handleSubmit} submitLabel="Create Task" />
      </div>
    </div>
  );
}
