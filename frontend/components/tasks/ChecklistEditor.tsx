'use client';

/**
 * ChecklistEditor — dynamic list builder for the task form.
 * Features:
 * - Add item via button or Enter key in last field
 * - Remove item via × button
 * - onChange called on every mutation
 * - Autofocuses newly added inputs
 */

import { useRef, useEffect, useState } from 'react';

interface ChecklistEditorProps {
  items: string[];
  onChange: (items: string[]) => void;
}

export function ChecklistEditor({ items, onChange }: ChecklistEditorProps) {
  // Track which index was just added so we can autofocus it
  const [justAddedIdx, setJustAddedIdx] = useState<number | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Autofocus newly added input
  useEffect(() => {
    if (justAddedIdx !== null) {
      inputRefs.current[justAddedIdx]?.focus();
      setJustAddedIdx(null);
    }
  }, [justAddedIdx]);

  function addItem(afterIndex?: number) {
    const newItems = [...items];
    const insertAt = afterIndex !== undefined ? afterIndex + 1 : items.length;
    newItems.splice(insertAt, 0, '');
    onChange(newItems);
    setJustAddedIdx(insertAt);
  }

  function removeItem(index: number) {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
    // Focus previous input after removal
    setTimeout(() => {
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }, 0);
  }

  function updateItem(index: number, value: string) {
    const newItems = [...items];
    newItems[index] = value;
    onChange(newItems);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem(index);
    } else if (e.key === 'Backspace' && items[index] === '' && items.length > 1) {
      e.preventDefault();
      removeItem(index);
    }
  }

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-xs text-slate-400 italic py-1">
          No checklist items — add one below.
        </p>
      )}

      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2 group">
          {/* Drag handle hint (decorative) */}
          <div
            className="w-4 h-4 shrink-0 flex items-center justify-center text-slate-300"
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

          {/* Checkbox placeholder (visual cue) */}
          <div
            className="w-4 h-4 shrink-0 rounded border-2 border-slate-200 bg-white"
            aria-hidden="true"
          />

          {/* Text input */}
          <input
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            value={item}
            onChange={(e) => updateItem(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            placeholder={`Item ${index + 1}`}
            className="flex-1 min-w-0 text-sm bg-transparent border-0 border-b border-slate-200
                       focus:border-indigo-400 focus:outline-none px-0 py-1
                       text-slate-700 placeholder:text-slate-300
                       transition-colors duration-150"
            aria-label={`Checklist item ${index + 1}`}
          />

          {/* Remove button */}
          <button
            type="button"
            onClick={() => removeItem(index)}
            className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full
                       text-slate-300 hover:text-red-500 hover:bg-red-50
                       opacity-0 group-hover:opacity-100 focus:opacity-100
                       transition-all duration-150
                       focus:outline-none focus:ring-2 focus:ring-red-400"
            aria-label={`Remove checklist item ${index + 1}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      {/* Add item button */}
      <button
        type="button"
        onClick={() => addItem()}
        className="flex items-center gap-2 mt-2 px-3 py-2 rounded-2xl text-xs font-semibold
                   text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/80
                   border border-dashed border-indigo-200/80 hover:border-indigo-300
                   transition-all duration-150 w-full
                   focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add item
      </button>
    </div>
  );
}
