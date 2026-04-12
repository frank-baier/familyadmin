'use client';

/**
 * RecipeForm — create/edit recipe form.
 * Uses useActionState (React 19 native) for form state management.
 * Fields: title, description, servings, prepMinutes, cookMinutes, ingredients, steps, photo.
 * Works for both create and edit (pass existing recipe as initialData or null).
 */

import { useActionState, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { IngredientEditor, ingredientRowsToRequest, ingredientToRow } from './IngredientEditor';
import { StepEditor } from './StepEditor';
import { createRecipe, updateRecipe, uploadPhoto } from '@/lib/recipes';
import type { Recipe, RecipeRequest } from '@/lib/recipes';
import type { IngredientRow } from './IngredientEditor';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormState {
  errors?: {
    title?: string[];
    servings?: string[];
    prepMinutes?: string[];
    cookMinutes?: string[];
    _form?: string[];
  };
  success?: boolean;
  newId?: string;
}

interface RecipeFormProps {
  initialData?: Recipe | null;
  redirectTo?: string; // override redirect path; defaults to /recipes/[id]
}

// ─── Spinner ────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RecipeForm({ initialData, redirectTo }: RecipeFormProps) {
  const router = useRouter();
  const isEdit = !!initialData;

  // Controlled ingredient/step lists (not part of FormData)
  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    initialData?.ingredients
      ? [...initialData.ingredients]
          .sort((a, b) => a.position - b.position)
          .map(ingredientToRow)
      : [],
  );
  const [steps, setSteps] = useState<string[]>(
    initialData?.steps
      ? [...initialData.steps]
          .sort((a, b) => a.position - b.position)
          .map((s) => s.text)
      : [],
  );

  // Photo state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(initialData?.photoUrl ?? null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Handle photo file selection
  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);

    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  // Form action
  async function formAction(prevState: FormState, formData: FormData): Promise<FormState> {
    const title = (formData.get('title') as string)?.trim();
    const description = (formData.get('description') as string)?.trim();
    const servingsRaw = formData.get('servings') as string;
    const prepRaw = formData.get('prepMinutes') as string;
    const cookRaw = formData.get('cookMinutes') as string;

    // Validation
    if (!title) {
      return { errors: { title: ['Title is required.'] } };
    }

    const servings = servingsRaw ? parseInt(servingsRaw, 10) : undefined;
    const prepMinutes = prepRaw ? parseInt(prepRaw, 10) : undefined;
    const cookMinutes = cookRaw ? parseInt(cookRaw, 10) : undefined;

    if (servings !== undefined && (isNaN(servings) || servings < 1)) {
      return { errors: { servings: ['Servings must be a positive number.'] } };
    }
    if (prepMinutes !== undefined && (isNaN(prepMinutes) || prepMinutes < 0)) {
      return { errors: { prepMinutes: ['Prep time must be 0 or more minutes.'] } };
    }
    if (cookMinutes !== undefined && (isNaN(cookMinutes) || cookMinutes < 0)) {
      return { errors: { cookMinutes: ['Cook time must be 0 or more minutes.'] } };
    }

    const data: RecipeRequest = {
      title,
      description: description || undefined,
      servings,
      prepMinutes,
      cookMinutes,
      ingredients: ingredientRowsToRequest(ingredients),
      steps: steps
        .filter((s) => s.trim().length > 0)
        .map((s, i) => ({ position: i, text: s.trim() })),
    };

    try {
      let recipe: Recipe;
      if (isEdit && initialData) {
        recipe = await updateRecipe(initialData.id, data);
      } else {
        recipe = await createRecipe(data);
      }

      // Upload photo if selected
      if (photoFile) {
        try {
          await uploadPhoto(recipe.id, photoFile);
        } catch {
          // Photo upload failure is non-fatal
          console.error('Photo upload failed');
        }
      }

      return { success: true, newId: recipe.id };
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
      router.push(redirectTo ?? `/recipes/${state.newId}`);
    }
  }, [state.success, state.newId, router, redirectTo]);

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
        <label htmlFor="recipe-title" className="block text-sm font-medium text-slate-700">
          Title <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <input
          id="recipe-title"
          name="title"
          type="text"
          required
          autoFocus
          defaultValue={initialData?.title}
          placeholder="e.g. Grandma's Spaghetti"
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
        <label htmlFor="recipe-description" className="block text-sm font-medium text-slate-700">
          Description
          <span className="ml-1.5 text-xs font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="recipe-description"
          name="description"
          rows={3}
          defaultValue={initialData?.description ?? undefined}
          placeholder="A short description of the dish…"
          className="block w-full rounded-xl px-4 py-2.5 text-sm text-slate-900
                     border border-slate-200 bg-white placeholder:text-slate-300
                     hover:border-slate-300
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                     transition-colors duration-150 resize-none"
        />
      </div>

      {/* Servings + Prep + Cook row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Servings */}
        <div className="space-y-1.5">
          <label htmlFor="recipe-servings" className="block text-sm font-medium text-slate-700">
            Servings
            <span className="ml-1.5 text-xs font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="recipe-servings"
            name="servings"
            type="number"
            min="1"
            defaultValue={initialData?.servings ?? undefined}
            placeholder="4"
            aria-describedby={state.errors?.servings ? 'servings-error' : undefined}
            aria-invalid={!!state.errors?.servings}
            className={[
              'block w-full rounded-xl px-4 py-2.5 text-sm text-slate-900',
              'border bg-white placeholder:text-slate-300',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
              'transition-colors duration-150',
              state.errors?.servings
                ? 'border-red-300 focus:ring-red-400'
                : 'border-slate-200 hover:border-slate-300',
            ].join(' ')}
          />
          {state.errors?.servings && (
            <p id="servings-error" role="alert" className="text-xs text-red-600 mt-1">
              {state.errors.servings.join(' ')}
            </p>
          )}
        </div>

        {/* Prep minutes */}
        <div className="space-y-1.5">
          <label htmlFor="recipe-prep" className="block text-sm font-medium text-slate-700">
            Prep time (min)
            <span className="ml-1.5 text-xs font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="recipe-prep"
            name="prepMinutes"
            type="number"
            min="0"
            defaultValue={initialData?.prepMinutes ?? undefined}
            placeholder="15"
            aria-describedby={state.errors?.prepMinutes ? 'prep-error' : undefined}
            aria-invalid={!!state.errors?.prepMinutes}
            className={[
              'block w-full rounded-xl px-4 py-2.5 text-sm text-slate-900',
              'border bg-white placeholder:text-slate-300',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
              'transition-colors duration-150',
              state.errors?.prepMinutes
                ? 'border-red-300 focus:ring-red-400'
                : 'border-slate-200 hover:border-slate-300',
            ].join(' ')}
          />
          {state.errors?.prepMinutes && (
            <p id="prep-error" role="alert" className="text-xs text-red-600 mt-1">
              {state.errors.prepMinutes.join(' ')}
            </p>
          )}
        </div>

        {/* Cook minutes */}
        <div className="space-y-1.5">
          <label htmlFor="recipe-cook" className="block text-sm font-medium text-slate-700">
            Cook time (min)
            <span className="ml-1.5 text-xs font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="recipe-cook"
            name="cookMinutes"
            type="number"
            min="0"
            defaultValue={initialData?.cookMinutes ?? undefined}
            placeholder="30"
            aria-describedby={state.errors?.cookMinutes ? 'cook-error' : undefined}
            aria-invalid={!!state.errors?.cookMinutes}
            className={[
              'block w-full rounded-xl px-4 py-2.5 text-sm text-slate-900',
              'border bg-white placeholder:text-slate-300',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
              'transition-colors duration-150',
              state.errors?.cookMinutes
                ? 'border-red-300 focus:ring-red-400'
                : 'border-slate-200 hover:border-slate-300',
            ].join(' ')}
          />
          {state.errors?.cookMinutes && (
            <p id="cook-error" role="alert" className="text-xs text-red-600 mt-1">
              {state.errors.cookMinutes.join(' ')}
            </p>
          )}
        </div>
      </div>

      {/* Photo upload */}
      <div className="space-y-2">
        <span className="block text-sm font-medium text-slate-700">
          Photo
          <span className="ml-1.5 text-xs font-normal text-slate-400">(optional)</span>
        </span>
        <div className="flex items-start gap-4">
          {/* Preview */}
          <div
            className="w-24 h-24 rounded-xl overflow-hidden border border-slate-200 bg-slate-50
                       flex items-center justify-center shrink-0"
          >
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoPreview}
                alt="Recipe photo preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-3xl select-none" aria-hidden="true">🍴</span>
            )}
          </div>

          <div className="flex-1 space-y-2">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                         border border-slate-200 text-slate-700 bg-white
                         hover:border-slate-300 hover:bg-slate-50
                         focus:outline-none focus:ring-2 focus:ring-indigo-500
                         transition-all duration-150"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              {photoPreview ? 'Change photo' : 'Upload photo'}
            </button>
            {photoFile && (
              <p className="text-xs text-slate-500">{photoFile.name}</p>
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="sr-only"
              aria-label="Upload recipe photo"
            />
          </div>
        </div>
      </div>

      {/* Ingredients */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="block text-sm font-medium text-slate-700">
            Ingredients
            <span className="ml-1.5 text-xs font-normal text-slate-400">(optional)</span>
          </span>
          {ingredients.length > 0 && (
            <span className="text-xs text-slate-400">
              {ingredients.filter((i) => i.name.trim()).length} ingredient
              {ingredients.filter((i) => i.name.trim()).length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3">
          <IngredientEditor items={ingredients} onChange={setIngredients} />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="block text-sm font-medium text-slate-700">
            Steps
            <span className="ml-1.5 text-xs font-normal text-slate-400">(optional)</span>
          </span>
          {steps.length > 0 && (
            <span className="text-xs text-slate-400">
              {steps.filter((s) => s.trim()).length} step
              {steps.filter((s) => s.trim()).length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3">
          <StepEditor steps={steps} onChange={setSteps} />
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
              <Spinner />
              Saving…
            </>
          ) : isEdit ? (
            'Save changes'
          ) : (
            'Create recipe'
          )}
        </button>
      </div>
    </form>
  );
}
