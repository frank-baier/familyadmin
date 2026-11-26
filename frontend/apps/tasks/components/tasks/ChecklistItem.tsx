'use client';

/**
 * ChecklistItem — single toggleable checklist item for task detail view.
 * Features:
 * - Optimistic UI: toggles visually before API call resolves
 * - Reverts on API error with console warning
 * - Strikethrough text when done
 */

import { useState } from 'react';
import { toggleChecklistItem } from '@/lib/tasks';
import type { ChecklistItem as ChecklistItemType } from '@/lib/tasks';

interface ChecklistItemProps {
  item: ChecklistItemType;
  taskId: string;
  /** Called with the updated item after successful toggle */
  onToggle: (item: ChecklistItemType) => void;
}

export function ChecklistItem({ item, taskId, onToggle }: ChecklistItemProps) {
  // Optimistic local done state
  const [optimisticDone, setOptimisticDone] = useState(item.done);
  const [isPending, setIsPending] = useState(false);

  async function handleToggle() {
    if (isPending) return;

    // Optimistic update
    setOptimisticDone((prev) => !prev);
    setIsPending(true);

    try {
      const updated = await toggleChecklistItem(taskId, item.id);
      onToggle(updated);
      setOptimisticDone(updated.done);
    } catch (err) {
      // Revert on error
      console.warn('Failed to toggle checklist item:', err);
      setOptimisticDone(item.done);
    } finally {
      setIsPending(false);
    }
  }

  const checkboxId = `checklist-item-${item.id}`;

  return (
    <li className="flex items-start gap-3 py-2 group">
      {/* Custom checkbox */}
      <div className="relative mt-0.5 shrink-0">
        <input
          id={checkboxId}
          type="checkbox"
          checked={optimisticDone}
          onChange={handleToggle}
          disabled={isPending}
          className="peer sr-only"
          aria-label={item.text}
        />
        <label
          htmlFor={checkboxId}
          className={[
            'flex items-center justify-center w-5 h-5 rounded-md border-2 cursor-pointer',
            'transition-all duration-150 select-none',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-1',
            isPending ? 'opacity-60 cursor-wait' : 'cursor-pointer',
            optimisticDone
              ? 'bg-emerald-500 border-emerald-500'
              : 'bg-white border-slate-300 hover:border-indigo-400 group-hover:border-indigo-300',
          ].join(' ')}
          aria-hidden="true"
        >
          {optimisticDone && (
            <svg
              className="w-3 h-3 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          )}
        </label>
      </div>

      {/* Text */}
      <span
        className={[
          'text-sm leading-relaxed transition-colors duration-150 cursor-pointer select-none',
          optimisticDone
            ? 'line-through text-slate-400'
            : 'text-slate-700',
        ].join(' ')}
        onClick={handleToggle}
      >
        {item.text}
      </span>
    </li>
  );
}
