'use client';

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
    <form action={action} noValidate className="space-y-5">
      {state.errors?._form && (
        <div role="alert" aria-live="polite"
          className="px-4 py-3 rounded-2xl bg-red-50/80 text-red-700 text-sm border border-red-200/60">
          {state.errors._form.join(' ')}
        </div>
      )}

      {/* Name */}
      <div>
        <label htmlFor="template-name" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
          Template name <span className="text-red-400" aria-hidden="true">*</span>
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
          className={state.errors?.name ? 'input-field border-red-300 focus:border-red-400' : 'input-field'}
        />
        {state.errors?.name && (
          <p id="name-error" role="alert" aria-live="polite" className="text-xs text-red-600 mt-1.5">
            {state.errors.name.join(' ')}
          </p>
        )}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="template-description" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
          Description <span className="text-slate-400 normal-case font-normal">(optional)</span>
        </label>
        <textarea
          id="template-description"
          name="description"
          rows={3}
          defaultValue={initialValues?.description}
          placeholder="What is this template for?"
          className="input-field"
        />
      </div>

      {/* Subtasks */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Subtasks <span className="text-slate-400 normal-case font-normal">(added as checklist items)</span>
          </span>
          {subtasks.length > 0 && (
            <span className="text-xs text-slate-400">
              {subtasks.filter((s) => s.trim()).length} item{subtasks.filter((s) => s.trim()).length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white/40 px-4 py-3">
          <ChecklistEditor items={subtasks} onChange={setSubtasks} />
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
