'use client';

/**
 * TaskForm — create/edit task form.
 * Uses useActionState (React 19 native) for form state management.
 * Fields: title, description, assignee (select), due date, checklist items.
 */

import { useActionState, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChecklistEditor } from './ChecklistEditor';
import { apiFetch } from '@/lib/api';
import type { TaskRequest } from '@/lib/tasks';
import type { User } from '@/lib/auth';

// ─── Types ──────────────────────────────────────────────────────────────────

interface FormState {
  errors?: {
    title?: string[];
    description?: string[];
    assigneeId?: string[];
    dueDate?: string[];
    checklist?: string[];
    _form?: string[];
  };
  success?: boolean;
}

interface TaskFormProps {
  onSubmit: (data: TaskRequest) => Promise<void>;
  initialValues?: Partial<TaskRequest>;
  submitLabel?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TaskForm({ onSubmit, initialValues, submitLabel = 'Create Task' }: TaskFormProps) {
  const router = useRouter();

  // Family members for assignee dropdown
  const [members, setMembers] = useState<User[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // Controlled checklist items (not part of FormData, managed separately)
  const [checklistItems, setChecklistItems] = useState<string[]>(
    initialValues?.checklistItems?.map((i) => i.text) ?? [],
  );

  // Fetch family members for assignee select
  useEffect(() => {
    apiFetch<User[]>('/api/admin/users')
      .then(setMembers)
      .catch(() => setMembers([]))
      .finally(() => setLoadingMembers(false));
  }, []);

  // Server action for useActionState — wraps the onSubmit prop
  async function formAction(prevState: FormState, formData: FormData): Promise<FormState> {
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const assigneeId = formData.get('assigneeId') as string;
    const dueDate = formData.get('dueDate') as string;

    // Client-side validation
    if (!title || title.trim().length === 0) {
      return { errors: { title: ['Title is required.'] } };
    }

    const taskData: TaskRequest = {
      title: title.trim(),
      description: description?.trim() || undefined,
      assigneeId: assigneeId || undefined,
      dueDate: dueDate || undefined,
      checklistItems: checklistItems
        .filter((text) => text.trim().length > 0)
        .map((text, position) => ({ text: text.trim(), position })),
    };

    try {
      await onSubmit(taskData);
      return { success: true };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      return { errors: { _form: [message] } };
    }
  }

  const [state, action, isPending] = useActionState(formAction, {});

  // Redirect to /tasks on success
  useEffect(() => {
    if (state.success) {
      router.push('/tasks');
    }
  }, [state.success, router]);

  return (
    <form action={action} noValidate className="space-y-6">
      {/* Global form error */}
      {state.errors?._form && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
        >
          {state.errors._form.join(' ')}
        </div>
      )}

      {/* Title */}
      <div className="space-y-1.5">
        <label htmlFor="task-title" className="block text-sm font-medium text-slate-700">
          Title <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <input
          id="task-title"
          name="title"
          type="text"
          required
          autoFocus
          defaultValue={initialValues?.title}
          placeholder="e.g. Buy groceries"
          aria-describedby={state.errors?.title ? 'title-error' : undefined}
          aria-invalid={!!state.errors?.title}
          className={[
            'block w-full rounded-xl px-4 py-2.5 text-sm text-slate-900',
            'border bg-white placeholder:text-slate-300',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
            'transition-colors duration-150',
            state.errors?.title
              ? 'border-red-300 focus:ring-red-400'
              : 'border-slate-200 hover:border-slate-300',
          ].join(' ')}
        />
        {state.errors?.title && (
          <p id="title-error" role="alert" aria-live="polite" className="text-xs text-red-600 mt-1">
            {state.errors.title.join(' ')}
          </p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label htmlFor="task-description" className="block text-sm font-medium text-slate-700">
          Description
          <span className="ml-1.5 text-xs font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="task-description"
          name="description"
          rows={3}
          defaultValue={initialValues?.description}
          placeholder="Add more details about this task…"
          className="block w-full rounded-xl px-4 py-2.5 text-sm text-slate-900
                     border border-slate-200 bg-white placeholder:text-slate-300
                     hover:border-slate-300
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                     transition-colors duration-150 resize-none"
        />
      </div>

      {/* Assignee + Due Date row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Assignee */}
        <div className="space-y-1.5">
          <label htmlFor="task-assignee" className="block text-sm font-medium text-slate-700">
            Assign to
            <span className="ml-1.5 text-xs font-normal text-slate-400">(optional)</span>
          </label>
          <select
            id="task-assignee"
            name="assigneeId"
            defaultValue={initialValues?.assigneeId ?? ''}
            disabled={loadingMembers}
            className="block w-full rounded-xl px-4 py-2.5 text-sm text-slate-900
                       border border-slate-200 bg-white
                       hover:border-slate-300 disabled:opacity-60 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                       transition-colors duration-150"
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>

        {/* Due Date */}
        <div className="space-y-1.5">
          <label htmlFor="task-due-date" className="block text-sm font-medium text-slate-700">
            Due date
            <span className="ml-1.5 text-xs font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="task-due-date"
            name="dueDate"
            type="date"
            defaultValue={initialValues?.dueDate}
            className="block w-full rounded-xl px-4 py-2.5 text-sm text-slate-900
                       border border-slate-200 bg-white
                       hover:border-slate-300
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                       transition-colors duration-150"
          />
        </div>
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="block text-sm font-medium text-slate-700">
            Checklist
            <span className="ml-1.5 text-xs font-normal text-slate-400">(optional)</span>
          </span>
          {checklistItems.length > 0 && (
            <span className="text-xs text-slate-400">
              {checklistItems.filter((i) => i.trim()).length} item{checklistItems.filter((i) => i.trim()).length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3">
          <ChecklistEditor items={checklistItems} onChange={setChecklistItems} />
        </div>
      </div>

      {/* Submit */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2
                     px-6 py-2.5 rounded-xl text-sm font-semibold
                     bg-indigo-600 text-white
                     hover:bg-indigo-700 active:bg-indigo-800
                     disabled:opacity-60 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                     transition-all duration-150 shadow-sm"
        >
          {isPending ? (
            <>
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Saving…
            </>
          ) : (
            submitLabel
          )}
        </button>
      </div>
    </form>
  );
}
