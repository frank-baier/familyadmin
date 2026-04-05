'use client';

/**
 * TemplateForm — create/edit task template form.
 * Fields: name, description, subtasks (ordered list).
 */

import { useActionState, useState } from 'react';
import { ChecklistEditor } from './ChecklistEditor';
import type { TaskTemplateRequest } from '@/lib/templates';

interface FormState {
  errors?: {
    name?: string[];
    _form?: string[];
  };
  success?: boolean;
}

interface TemplateFormProps {
  onSubmit: (data: TaskTemplateRequest) => Promise<void>;
  initialValues?: Partial<TaskTemplateRequest>;
  submitLabel?: string;
}

export function TemplateForm({ onSubmit, initialValues, submitLabel = 'Save Template' }: TemplateFormProps) {
  const [subtasks, setSubtasks] = useState<string[]>(
    initialValues?.subtasks?.map((s) => s.text) ?? [],
  );

  async function formAction(prevState: FormState, formData: FormData): Promise<FormState> {
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;

    if (!name || name.trim().length === 0) {
      return { errors: { name: ['Name is required.'] } };
    }

    const data: TaskTemplateRequest = {
      name: name.trim(),
      description: description?.trim() || undefined,
      subtasks: subtasks
        .filter((t) => t.trim().length > 0)
        .map((text, position) => ({ text: text.trim(), position })),
    };

    try {
      await onSubmit(data);
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      return { errors: { _form: [message] } };
    }
  }

  const [state, action, isPending] = useActionState(formAction, {});

  return (
    <form action={action} noValidate className="space-y-6">
      {state.errors?._form && (
        <div role="alert" aria-live="polite"
          className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.errors._form.join(' ')}
        </div>
      )}

      {/* Name */}
      <div className="space-y-1.5">
        <label htmlFor="template-name" className="block text-sm font-medium text-slate-700">
          Template name <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <input
          id="template-name"
          name="name"
          type="text"
          required
          autoFocus
          defaultValue={initialValues?.name}
          placeholder="e.g. Weekly house cleaning"
          aria-describedby={state.errors?.name ? 'name-error' : undefined}
          aria-invalid={!!state.errors?.name}
          className={[
            'block w-full rounded-xl px-4 py-2.5 text-sm text-slate-900',
            'border bg-white placeholder:text-slate-300',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
            'transition-colors duration-150',
            state.errors?.name
              ? 'border-red-300 focus:ring-red-400'
              : 'border-slate-200 hover:border-slate-300',
          ].join(' ')}
        />
        {state.errors?.name && (
          <p id="name-error" role="alert" aria-live="polite" className="text-xs text-red-600 mt-1">
            {state.errors.name.join(' ')}
          </p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label htmlFor="template-description" className="block text-sm font-medium text-slate-700">
          Description
          <span className="ml-1.5 text-xs font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="template-description"
          name="description"
          rows={3}
          defaultValue={initialValues?.description}
          placeholder="What is this template for?"
          className="block w-full rounded-xl px-4 py-2.5 text-sm text-slate-900
                     border border-slate-200 bg-white placeholder:text-slate-300
                     hover:border-slate-300
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                     transition-colors duration-150 resize-none"
        />
      </div>

      {/* Subtasks */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="block text-sm font-medium text-slate-700">
            Subtasks
            <span className="ml-1.5 text-xs font-normal text-slate-400">(optional — added as checklist items)</span>
          </span>
          {subtasks.length > 0 && (
            <span className="text-xs text-slate-400">
              {subtasks.filter((s) => s.trim()).length} item{subtasks.filter((s) => s.trim()).length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3">
          <ChecklistEditor items={subtasks} onChange={setSubtasks} />
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
