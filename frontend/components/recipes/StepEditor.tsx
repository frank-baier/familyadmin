'use client';

/**
 * StepEditor — dynamic recipe steps builder for the recipe form.
 * Features:
 * - Add/remove steps
 * - Numbered automatically
 * - Textarea per step
 * - Drag hint (visual only)
 */

import { useRef, useEffect, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StepEditorProps {
  steps: string[];
  onChange: (steps: string[]) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StepEditor({ steps, onChange }: StepEditorProps) {
  const [justAddedIdx, setJustAddedIdx] = useState<number | null>(null);
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  // Autofocus newly added step
  useEffect(() => {
    if (justAddedIdx !== null) {
      textareaRefs.current[justAddedIdx]?.focus();
      setJustAddedIdx(null);
    }
  }, [justAddedIdx]);

  function addStep(afterIndex?: number) {
    const newSteps = [...steps];
    const insertAt = afterIndex !== undefined ? afterIndex + 1 : steps.length;
    newSteps.splice(insertAt, 0, '');
    onChange(newSteps);
    setJustAddedIdx(insertAt);
  }

  function removeStep(index: number) {
    const newSteps = steps.filter((_, i) => i !== index);
    onChange(newSteps);
    setTimeout(() => {
      if (index > 0) {
        textareaRefs.current[index - 1]?.focus();
      }
    }, 0);
  }

  function updateStep(index: number, value: string) {
    const newSteps = [...steps];
    newSteps[index] = value;
    onChange(newSteps);
  }

  return (
    <div className="space-y-3">
      {steps.length === 0 && (
        <p className="text-xs text-slate-400 italic py-1">
          No steps — add one below.
        </p>
      )}

      {steps.map((step, index) => (
        <div key={index} className="flex items-start gap-2 group">
          {/* Drag handle hint (decorative) */}
          <div
            className="mt-2.5 w-4 h-4 shrink-0 flex items-center justify-center text-slate-300"
            aria-hidden="true"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <circle cx="5" cy="4" r="1.25" />
              <circle cx="11" cy="4" r="1.25" />
              <circle cx="5" cy="8" r="1.25" />
              <circle cx="11" cy="8" r="1.25" />
              <circle cx="5" cy="12" r="1.25" />
              <circle cx="11" cy="12" r="1.25" />
            </svg>
          </div>

          {/* Step number badge */}
          <div
            className="mt-2 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center
                       text-xs font-bold shrink-0"
            aria-hidden="true"
          >
            {index + 1}
          </div>

          {/* Textarea */}
          <textarea
            ref={(el) => {
              textareaRefs.current[index] = el;
            }}
            value={step}
            onChange={(e) => updateStep(index, e.target.value)}
            placeholder={`Describe step ${index + 1}…`}
            rows={2}
            className="flex-1 min-w-0 text-sm bg-transparent border border-slate-200 rounded-lg
                       focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 focus:outline-none
                       px-3 py-2 text-slate-700 placeholder:text-slate-300
                       resize-none transition-colors duration-150"
            aria-label={`Step ${index + 1}`}
          />

          {/* Remove */}
          <button
            type="button"
            onClick={() => removeStep(index)}
            className="mt-2 w-6 h-6 shrink-0 flex items-center justify-center rounded-full
                       text-slate-300 hover:text-red-500 hover:bg-red-50
                       opacity-0 group-hover:opacity-100 focus:opacity-100
                       transition-all duration-150
                       focus:outline-none focus:ring-2 focus:ring-red-400"
            aria-label={`Remove step ${index + 1}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      {/* Add step button */}
      <button
        type="button"
        onClick={() => addStep()}
        className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg text-xs font-medium
                   text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50
                   border border-dashed border-indigo-200 hover:border-indigo-300
                   transition-all duration-150 w-full
                   focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add step
      </button>
    </div>
  );
}
