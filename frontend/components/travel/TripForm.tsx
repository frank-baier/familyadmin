'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createTrip } from '@/lib/travel';
import type { Trip, TripRequest } from '@/lib/travel';

interface FormState {
  errors?: {
    title?: string[];
    destination?: string[];
    startDate?: string[];
    endDate?: string[];
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

export function TripForm() {
  const router = useRouter();

  async function formAction(_prevState: FormState, formData: FormData): Promise<FormState> {
    const title = (formData.get('title') as string)?.trim();
    const destination = (formData.get('destination') as string)?.trim();
    const startDate = (formData.get('startDate') as string)?.trim();
    const endDate = (formData.get('endDate') as string)?.trim();
    const description = (formData.get('description') as string)?.trim();

    const errors: FormState['errors'] = {};

    if (!title) errors.title = ['Title is required.'];
    if (!destination) errors.destination = ['Destination is required.'];
    if (!startDate) errors.startDate = ['Start date is required.'];
    if (!endDate) errors.endDate = ['End date is required.'];

    if (startDate && endDate && startDate > endDate) {
      errors.endDate = ['End date must be on or after start date.'];
    }

    if (Object.keys(errors).length > 0) {
      return { errors };
    }

    const data: TripRequest = {
      title,
      destination,
      startDate,
      endDate,
      description: description || undefined,
    };

    try {
      const trip: Trip = await createTrip(data);
      return { success: true, newId: trip.id };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      return { errors: { _form: [message] } };
    }
  }

  const [state, action, isPending] = useActionState(formAction, {});

  useEffect(() => {
    if (state.success && state.newId) {
      router.push(`/travel/${state.newId}`);
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

      {/* Title */}
      <div>
        <label htmlFor="trip-title" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
          Trip name <span className="text-red-400" aria-hidden="true">*</span>
        </label>
        <input
          id="trip-title"
          name="title"
          type="text"
          required
          autoFocus
          placeholder="e.g. Summer Holidays 2025"
          aria-describedby={state.errors?.title ? 'title-error' : undefined}
          aria-invalid={!!state.errors?.title}
          className={state.errors?.title ? 'input-field border-red-300' : 'input-field'}
        />
        {state.errors?.title && (
          <p id="title-error" role="alert" aria-live="polite" className="text-xs text-red-600 mt-1.5">
            {state.errors.title.join(' ')}
          </p>
        )}
      </div>

      {/* Destination */}
      <div>
        <label htmlFor="trip-destination" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
          Destination <span className="text-red-400" aria-hidden="true">*</span>
        </label>
        <input
          id="trip-destination"
          name="destination"
          type="text"
          required
          placeholder="e.g. Paris, France"
          aria-describedby={state.errors?.destination ? 'destination-error' : undefined}
          aria-invalid={!!state.errors?.destination}
          className={state.errors?.destination ? 'input-field border-red-300' : 'input-field'}
        />
        {state.errors?.destination && (
          <p id="destination-error" role="alert" aria-live="polite" className="text-xs text-red-600 mt-1.5">
            {state.errors.destination.join(' ')}
          </p>
        )}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="trip-start" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Start date <span className="text-red-400" aria-hidden="true">*</span>
          </label>
          <input
            id="trip-start"
            name="startDate"
            type="date"
            required
            aria-describedby={state.errors?.startDate ? 'startDate-error' : undefined}
            aria-invalid={!!state.errors?.startDate}
            className={state.errors?.startDate ? 'input-field border-red-300' : 'input-field'}
          />
          {state.errors?.startDate && (
            <p id="startDate-error" role="alert" className="text-xs text-red-600 mt-1.5">
              {state.errors.startDate.join(' ')}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="trip-end" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            End date <span className="text-red-400" aria-hidden="true">*</span>
          </label>
          <input
            id="trip-end"
            name="endDate"
            type="date"
            required
            aria-describedby={state.errors?.endDate ? 'endDate-error' : undefined}
            aria-invalid={!!state.errors?.endDate}
            className={state.errors?.endDate ? 'input-field border-red-300' : 'input-field'}
          />
          {state.errors?.endDate && (
            <p id="endDate-error" role="alert" className="text-xs text-red-600 mt-1.5">
              {state.errors.endDate.join(' ')}
            </p>
          )}
        </div>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="trip-description" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
          Description <span className="text-slate-400 normal-case font-normal">(optional)</span>
        </label>
        <textarea
          id="trip-description"
          name="description"
          rows={3}
          placeholder="A short description of the trip…"
          className="input-field"
        />
      </div>

      {/* Submit */}
      <div className="pt-1">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? (
            <>
              <Spinner />
              Creating…
            </>
          ) : (
            'Plan this trip'
          )}
        </button>
      </div>
    </form>
  );
}
