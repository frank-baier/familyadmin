'use client';

/**
 * TripForm — create trip form.
 * Uses useActionState (React 19 native) for form state management.
 * Fields: title, destination, startDate, endDate, description.
 * Redirects to /travel/[id] on success.
 */

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createTrip } from '@/lib/travel';
import type { Trip, TripRequest } from '@/lib/travel';

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Spinner ─────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Field helper ────────────────────────────────────────────────────────────

const fieldBase =
  'block w-full rounded-xl px-4 py-2.5 text-sm text-slate-900 border bg-white placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors duration-150';
const fieldNormal = 'border-slate-200 hover:border-slate-300';
const fieldError = 'border-red-300 focus:ring-red-400';

// ─── Component ───────────────────────────────────────────────────────────────

export function TripForm() {
  const router = useRouter();

  async function formAction(_prevState: FormState, formData: FormData): Promise<FormState> {
    const title = (formData.get('title') as string)?.trim();
    const destination = (formData.get('destination') as string)?.trim();
    const startDate = (formData.get('startDate') as string)?.trim();
    const endDate = (formData.get('endDate') as string)?.trim();
    const description = (formData.get('description') as string)?.trim();

    // Validation
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

  // Redirect on success
  useEffect(() => {
    if (state.success && state.newId) {
      router.push(`/travel/${state.newId}`);
    }
  }, [state.success, state.newId, router]);

  return (
    <form action={action} noValidate className="space-y-6">
      {/* Global error */}
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
        <label htmlFor="trip-title" className="block text-sm font-medium text-slate-700">
          Trip name <span className="text-red-500" aria-hidden="true">*</span>
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
          className={[fieldBase, state.errors?.title ? fieldError : fieldNormal].join(' ')}
        />
        {state.errors?.title && (
          <p id="title-error" role="alert" aria-live="polite" className="text-xs text-red-600 mt-1">
            {state.errors.title.join(' ')}
          </p>
        )}
      </div>

      {/* Destination */}
      <div className="space-y-1.5">
        <label htmlFor="trip-destination" className="block text-sm font-medium text-slate-700">
          Destination <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <input
          id="trip-destination"
          name="destination"
          type="text"
          required
          placeholder="e.g. Paris, France"
          aria-describedby={state.errors?.destination ? 'destination-error' : undefined}
          aria-invalid={!!state.errors?.destination}
          className={[fieldBase, state.errors?.destination ? fieldError : fieldNormal].join(' ')}
        />
        {state.errors?.destination && (
          <p id="destination-error" role="alert" aria-live="polite" className="text-xs text-red-600 mt-1">
            {state.errors.destination.join(' ')}
          </p>
        )}
      </div>

      {/* Dates row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Start date */}
        <div className="space-y-1.5">
          <label htmlFor="trip-start" className="block text-sm font-medium text-slate-700">
            Start date <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            id="trip-start"
            name="startDate"
            type="date"
            required
            aria-describedby={state.errors?.startDate ? 'startDate-error' : undefined}
            aria-invalid={!!state.errors?.startDate}
            className={[fieldBase, state.errors?.startDate ? fieldError : fieldNormal].join(' ')}
          />
          {state.errors?.startDate && (
            <p id="startDate-error" role="alert" className="text-xs text-red-600 mt-1">
              {state.errors.startDate.join(' ')}
            </p>
          )}
        </div>

        {/* End date */}
        <div className="space-y-1.5">
          <label htmlFor="trip-end" className="block text-sm font-medium text-slate-700">
            End date <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            id="trip-end"
            name="endDate"
            type="date"
            required
            aria-describedby={state.errors?.endDate ? 'endDate-error' : undefined}
            aria-invalid={!!state.errors?.endDate}
            className={[fieldBase, state.errors?.endDate ? fieldError : fieldNormal].join(' ')}
          />
          {state.errors?.endDate && (
            <p id="endDate-error" role="alert" className="text-xs text-red-600 mt-1">
              {state.errors.endDate.join(' ')}
            </p>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label htmlFor="trip-description" className="block text-sm font-medium text-slate-700">
          Description
          <span className="ml-1.5 text-xs font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="trip-description"
          name="description"
          rows={3}
          placeholder="A short description of the trip…"
          className="block w-full rounded-xl px-4 py-2.5 text-sm text-slate-900
                     border border-slate-200 bg-white placeholder:text-slate-300
                     hover:border-slate-300
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                     transition-colors duration-150 resize-none"
        />
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
