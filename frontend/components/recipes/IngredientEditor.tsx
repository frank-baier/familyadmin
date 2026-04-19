'use client';

/**
 * IngredientEditor — dynamic ingredient list builder for the recipe form.
 * Features:
 * - Add/remove ingredients
 * - Fields: name (text), amount (number), unit (select)
 * - Enter key on name field adds new row
 */

import { useRef, useEffect, useState } from 'react';
import type { RecipeIngredientRequest } from '@/lib/recipes';

// ─── Unit options ────────────────────────────────────────────────────────────

const UNITS = ['', 'g', 'kg', 'ml', 'l', 'tbsp', 'tsp', 'pcs', 'handful', 'pinch'] as const;
type Unit = (typeof UNITS)[number];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IngredientRow {
  name: string;
  amount: string; // string for input, parsed to number on submit
  unit: Unit;
}

interface IngredientEditorProps {
  items: IngredientRow[];
  onChange: (items: IngredientRow[]) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function IngredientEditor({ items, onChange }: IngredientEditorProps) {
  const [justAddedIdx, setJustAddedIdx] = useState<number | null>(null);
  const nameRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Autofocus newly added row
  useEffect(() => {
    if (justAddedIdx !== null) {
      nameRefs.current[justAddedIdx]?.focus();
      setJustAddedIdx(null);
    }
  }, [justAddedIdx]);

  function addItem(afterIndex?: number) {
    const newItems = [...items];
    const insertAt = afterIndex !== undefined ? afterIndex + 1 : items.length;
    newItems.splice(insertAt, 0, { name: '', amount: '', unit: '' });
    onChange(newItems);
    setJustAddedIdx(insertAt);
  }

  function removeItem(index: number) {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
    setTimeout(() => {
      if (index > 0) {
        nameRefs.current[index - 1]?.focus();
      }
    }, 0);
  }

  function updateName(index: number, value: string) {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], name: value };
    onChange(newItems);
  }

  function updateAmount(index: number, value: string) {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], amount: value };
    onChange(newItems);
  }

  function updateUnit(index: number, value: Unit) {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], unit: value };
    onChange(newItems);
  }

  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem(index);
    } else if (e.key === 'Backspace' && items[index].name === '' && items.length > 1) {
      e.preventDefault();
      removeItem(index);
    }
  }

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-xs text-slate-400 italic py-1">
          No ingredients — add one below.
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

          {/* Amount */}
          <input
            type="number"
            value={item.amount}
            onChange={(e) => updateAmount(index, e.target.value)}
            placeholder="Qty"
            min="0"
            step="any"
            className="w-16 shrink-0 text-sm bg-transparent border-0 border-b border-slate-200
                       focus:border-indigo-400 focus:outline-none px-0 py-1
                       text-slate-700 placeholder:text-slate-300
                       transition-colors duration-150"
            aria-label={`Amount for ingredient ${index + 1}`}
          />

          {/* Unit */}
          <select
            value={item.unit}
            onChange={(e) => updateUnit(index, e.target.value as Unit)}
            className="w-20 shrink-0 text-sm bg-transparent border-0 border-b border-slate-200
                       focus:border-indigo-400 focus:outline-none px-0 py-1
                       text-slate-700
                       transition-colors duration-150"
            aria-label={`Unit for ingredient ${index + 1}`}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u === '' ? '—' : u}
              </option>
            ))}
          </select>

          {/* Name */}
          <input
            ref={(el) => {
              nameRefs.current[index] = el;
            }}
            type="text"
            value={item.name}
            onChange={(e) => updateName(index, e.target.value)}
            onKeyDown={(e) => handleNameKeyDown(e, index)}
            placeholder={`Ingredient ${index + 1}`}
            className="flex-1 min-w-0 text-sm bg-transparent border-0 border-b border-slate-200
                       focus:border-indigo-400 focus:outline-none px-0 py-1
                       text-slate-700 placeholder:text-slate-300
                       transition-colors duration-150"
            aria-label={`Name for ingredient ${index + 1}`}
          />

          {/* Remove */}
          <button
            type="button"
            onClick={() => removeItem(index)}
            className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full
                       text-slate-300 hover:text-red-500 hover:bg-red-50
                       opacity-0 group-hover:opacity-100 focus:opacity-100
                       transition-all duration-150
                       focus:outline-none focus:ring-2 focus:ring-red-400"
            aria-label={`Remove ingredient ${index + 1}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      {/* Add ingredient button */}
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
        Add ingredient
      </button>
    </div>
  );
}

// ─── Helpers for form submission ─────────────────────────────────────────────

export function ingredientRowsToRequest(rows: IngredientRow[]): import('@/lib/recipes').RecipeIngredientRequest[] {
  return rows
    .filter((r) => r.name.trim().length > 0)
    .map((r, position) => ({
      name: r.name.trim(),
      amount: r.amount ? parseFloat(r.amount) : undefined,
      unit: r.unit || undefined,
      position,
    }));
}

export function ingredientToRow(ing: import('@/lib/recipes').RecipeIngredient): IngredientRow {
  return {
    name: ing.name,
    amount: ing.amount != null ? String(ing.amount) : '',
    unit: (ing.unit as Unit) ?? '',
  };
}
