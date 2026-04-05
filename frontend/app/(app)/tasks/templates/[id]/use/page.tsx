'use client';

/**
 * Use template page — /tasks/templates/[id]/use
 *
 * Flow:
 * 1. Load template with all subtasks (all pre-selected)
 * 2. User unchecks any subtasks they don't want
 * 3. "Create Task" → POST /api/task-templates/{id}/use with selectedSubtaskIds
 * 4. Redirect to /tasks/{newId}/edit so user can assign, set due date, adjust title
 */

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getTemplate, useTemplate } from '@/lib/templates';
import type { TaskTemplate, TemplateSubtask } from '@/lib/templates';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function UseTemplatePage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [template, setTemplate] = useState<TaskTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    getTemplate(id)
      .then((t) => {
        setTemplate(t);
        // Pre-select all subtasks
        setSelected(new Set(t.subtasks.map((s) => s.id)));
      })
      .catch(() => setError('Template not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  function toggleSubtask(subtaskId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(subtaskId)) {
        next.delete(subtaskId);
      } else {
        next.add(subtaskId);
      }
      return next;
    });
  }

  function selectAll() {
    if (!template) return;
    setSelected(new Set(template.subtasks.map((s) => s.id)));
  }

  function selectNone() {
    setSelected(new Set());
  }

  async function handleCreate() {
    if (!template || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const task = await useTemplate(id, Array.from(selected));
      router.push(`/tasks/${task.id}/edit`);
    } catch {
      setSubmitError('Failed to create task. Please try again.');
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto animate-pulse space-y-4">
        <div className="h-4 w-24 bg-slate-100 rounded mb-8" />
        <div className="h-7 w-1/2 bg-slate-100 rounded" />
        <div className="h-48 bg-slate-50 rounded-2xl" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="max-w-2xl mx-auto">
        <Link href="/tasks/templates"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900
                     transition-colors mb-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Templates
        </Link>
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-red-700 text-sm">
          {error ?? 'Template not found.'}
        </div>
      </div>
    );
  }

  const sorted = [...template.subtasks].sort((a, b) => a.position - b.position);
  const allSelected = sorted.every((s) => selected.has(s.id));
  const noneSelected = selected.size === 0;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back */}
      <Link href="/tasks/templates"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900
                   transition-colors mb-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Templates
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{template.name}</h1>
        {template.description && (
          <p className="text-slate-500 text-sm mt-1">{template.description}</p>
        )}
      </div>

      {/* Instruction */}
      <p className="text-sm text-slate-600 mb-4">
        Select the subtasks to include. A new task will be created with the selected items as its
        checklist — you can then assign it and set a due date.
      </p>

      {/* Submit error */}
      {submitError && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-5 py-3 text-red-700 text-sm mb-4">
          {submitError}
        </div>
      )}

      {/* Subtask selection */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
        {/* Select all / none */}
        <div className="px-5 py-3 border-b border-slate-50 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            {selected.size} of {sorted.length} selected
          </span>
          <div className="flex gap-3">
            <button
              onClick={selectAll}
              disabled={allSelected}
              className="text-xs text-indigo-600 hover:text-indigo-800 disabled:text-slate-300
                         focus:outline-none focus:underline transition-colors"
            >
              Select all
            </button>
            <button
              onClick={selectNone}
              disabled={noneSelected}
              className="text-xs text-slate-500 hover:text-slate-700 disabled:text-slate-300
                         focus:outline-none focus:underline transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">
            This template has no subtasks. A task will be created with just the title.
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {sorted.map((subtask: TemplateSubtask) => {
              const isChecked = selected.has(subtask.id);
              return (
                <li key={subtask.id}>
                  <label className="flex items-center gap-3 px-5 py-3.5 cursor-pointer
                                    hover:bg-slate-50 transition-colors duration-100">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSubtask(subtask.id)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600
                                 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0
                                 cursor-pointer"
                    />
                    <span className={[
                      'text-sm flex-1',
                      isChecked ? 'text-slate-800' : 'text-slate-400 line-through',
                    ].join(' ')}>
                      {subtask.text}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleCreate}
          disabled={submitting}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold
                     bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800
                     disabled:opacity-60 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                     transition-all duration-150 shadow-sm"
        >
          {submitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creating…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Create task{selected.size > 0 ? ` with ${selected.size} subtask${selected.size !== 1 ? 's' : ''}` : ''}
            </>
          )}
        </button>

        <Link href="/tasks/templates"
          className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600
                     hover:text-slate-800 hover:bg-slate-100
                     focus:outline-none focus:ring-2 focus:ring-slate-400
                     transition-all duration-150">
          Cancel
        </Link>
      </div>
    </div>
  );
}
