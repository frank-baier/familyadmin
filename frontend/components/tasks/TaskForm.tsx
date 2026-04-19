'use client';

import { useActionState, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChecklistEditor } from './ChecklistEditor';
import { apiFetch } from '@/lib/api';
import type { TaskRequest } from '@/lib/tasks';
import type { User } from '@/lib/auth';

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

export function TaskForm({ onSubmit, initialValues, submitLabel = 'Create Task' }: TaskFormProps) {
  const router = useRouter();

  const [members, setMembers] = useState<User[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const [checklistItems, setChecklistItems] = useState<string[]>(
    initialValues?.checklistItems?.map((i) => i.text) ?? [],
  );

  useEffect(() => {
    apiFetch<User[]>('/api/admin/users')
      .then(setMembers)
      .catch(() => setMembers([]))
      .finally(() => setLoadingMembers(false));
  }, []);

  async function formAction(prevState: FormState, formData: FormData): Promise<FormState> {
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const assigneeId = formData.get('assigneeId') as string;
    const dueDate = formData.get('dueDate') as string;

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

  useEffect(() => {
    if (state.success) {
      router.push('/tasks');
    }
  }, [state.success, router]);

  return (
    <form action={action} noValidate className="space-y-5">
      {state.errors?._form && (
        <div
          role="alert"
          aria-live="polite"
          className="px-4 py-3 rounded-2xl bg-red-50/80 text-red-700 text-sm border border-red-200/60"
        >
          {state.errors._form.join(' ')}
        </div>
      )}

      {/* Title */}
      <div>
        <label htmlFor="task-title" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
          Title <span className="text-red-400" aria-hidden="true">*</span>
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
          className={state.errors?.title ? 'input-field border-red-300 focus:border-red-400' : 'input-field'}
        />
        {state.errors?.title && (
          <p id="title-error" role="alert" aria-live="polite" className="text-xs text-red-600 mt-1.5">
            {state.errors.title.join(' ')}
          </p>
        )}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="task-description" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
          Description <span className="text-slate-400 normal-case font-normal">(optional)</span>
        </label>
        <textarea
          id="task-description"
          name="description"
          rows={3}
          defaultValue={initialValues?.description}
          placeholder="Add more details about this task…"
          className="input-field"
        />
      </div>

      {/* Assignee + Due Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="task-assignee" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Assign to <span className="text-slate-400 normal-case font-normal">(optional)</span>
          </label>
          <select
            id="task-assignee"
            name="assigneeId"
            defaultValue={initialValues?.assigneeId ?? ''}
            disabled={loadingMembers}
            className="input-field"
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="task-due-date" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Due date <span className="text-slate-400 normal-case font-normal">(optional)</span>
          </label>
          <input
            id="task-due-date"
            name="dueDate"
            type="date"
            defaultValue={initialValues?.dueDate}
            className="input-field"
          />
        </div>
      </div>

      {/* Checklist */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Checklist <span className="text-slate-400 normal-case font-normal">(optional)</span>
          </span>
          {checklistItems.length > 0 && (
            <span className="text-xs text-slate-400">
              {checklistItems.filter((i) => i.trim()).length} item{checklistItems.filter((i) => i.trim()).length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white/40 px-4 py-3">
          <ChecklistEditor items={checklistItems} onChange={setChecklistItems} />
        </div>
      </div>

      {/* Submit */}
      <div className="pt-1">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
