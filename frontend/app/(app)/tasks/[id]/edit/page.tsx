'use client';

/**
 * Task edit page — /tasks/[id]/edit
 * Loads existing task, pre-fills TaskForm, calls PUT /api/tasks/{id} on submit.
 */

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TaskForm } from '@/components/tasks/TaskForm';
import { getTask, updateTask } from '@/lib/tasks';
import type { Task, TaskRequest } from '@/lib/tasks';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditTaskPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTask(id)
      .then(setTask)
      .catch(() => setError('Task not found or you do not have access.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(data: TaskRequest) {
    await updateTask(id, data);
    router.push(`/tasks/${id}`);
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto animate-pulse space-y-4">
        <div className="h-4 w-24 bg-slate-100 rounded mb-8" />
        <div className="h-7 w-1/2 bg-slate-100 rounded" />
        <div className="h-4 w-full bg-slate-50 rounded" />
      </div>
    );
  }

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
        <div className="rounded-2xl bg-red-50/80 border border-red-200/60 px-5 py-4 text-red-700 text-sm">
          {error ?? 'Task not found.'}
        </div>
      </div>
    );
  }

  const initialValues: Partial<TaskRequest> = {
    title: task.title,
    description: task.description ?? undefined,
    assigneeId: task.assignee?.id ?? undefined,
    dueDate: task.dueDate ?? undefined,
    checklistItems: task.checklistItems
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ text: i.text, position: i.position })),
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back link */}
      <Link
        href={`/tasks/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900
                   transition-colors mb-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Task
      </Link>

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Edit Task</h1>
        <p className="text-slate-500 text-sm mt-1 truncate max-w-md">{task.title}</p>
      </div>

      {/* Form card */}
      <div className="glass rounded-3xl px-6 py-6">
        <TaskForm
          onSubmit={handleSubmit}
          initialValues={initialValues}
          submitLabel="Save Changes"
        />
      </div>
    </div>
  );
}
