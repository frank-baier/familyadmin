'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createPortfolio } from '@/lib/portfolio';
import type { Portfolio } from '@/lib/portfolio';

interface FormState {
  errors?: {
    name?: string[];
    _form?: string[];
  };
  success?: boolean;
  newId?: string;
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function PortfolioForm() {
  const router = useRouter();

  async function formAction(_prevState: FormState, formData: FormData): Promise<FormState> {
    const name = (formData.get('name') as string)?.trim();
    if (!name) {
      return { errors: { name: ['Name des Depots ist erforderlich.'] } };
    }

    try {
      const portfolio: Portfolio = await createPortfolio({ name });
      return { success: true, newId: portfolio.id };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Etwas ist schiefgelaufen. Bitte erneut versuchen.';
      return { errors: { _form: [message] } };
    }
  }

  const [state, action, isPending] = useActionState(formAction, {});

  useEffect(() => {
    if (state.success && state.newId) {
      router.push(`/finance/${state.newId}`);
    }
  }, [state.success, state.newId, router]);

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

      <div>
        <label htmlFor="portfolio-name" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
          Depot-Name <span className="text-red-400" aria-hidden="true">*</span>
        </label>
        <input
          id="portfolio-name"
          name="name"
          type="text"
          required
          autoFocus
          placeholder="z. B. Familiendepot"
          aria-describedby={state.errors?.name ? 'name-error' : undefined}
          aria-invalid={!!state.errors?.name}
          className={state.errors?.name ? 'input-field border-red-300' : 'input-field'}
        />
        {state.errors?.name && (
          <p id="name-error" role="alert" aria-live="polite" className="text-xs text-red-600 mt-1.5">
            {state.errors.name.join(' ')}
          </p>
        )}
      </div>

      <div className="pt-1">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? (
            <>
              <Spinner />
              Wird erstellt…
            </>
          ) : (
            'Depot anlegen'
          )}
        </button>
      </div>
    </form>
  );
}
