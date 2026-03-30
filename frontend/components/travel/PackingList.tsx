'use client';

/**
 * PackingList — shared or personal packing list for a trip.
 * - Loads items on mount
 * - Optimistic toggle: flips packed immediately, reverts on API failure
 * - Inline add: text input + Enter / button to add items
 * - Progress indicator: "X / Y packed"
 * - Delete button per item
 */

import { useState, useEffect, useRef } from 'react';
import {
  getPackingItems,
  addPackingItem,
  togglePackingItem,
  deletePackingItem,
} from '@/lib/travel';
import type { PackingItem } from '@/lib/travel';

// ─── Spinner ─────────────────────────────────────────────────────────────────

function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

interface PackingListProps {
  tripId: string;
  personal: boolean;
  currentUserId?: string;
}

export function PackingList({ tripId, personal, currentUserId }: PackingListProps) {
  const [items, setItems] = useState<PackingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, personal]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getPackingItems(tripId, personal ? true : undefined);
      setItems(data);
    } catch {
      setError('Failed to load packing list.');
    } finally {
      setLoading(false);
    }
  }

  // Optimistic toggle
  async function handleToggle(item: PackingItem) {
    const previous = items;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, packed: !i.packed } : i)),
    );
    try {
      const updated = await togglePackingItem(tripId, item.id);
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    } catch {
      // Revert on failure
      setItems(previous);
    }
  }

  async function handleDelete(itemId: string) {
    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    try {
      await deletePackingItem(tripId, itemId);
    } catch {
      setItems(previous);
    }
  }

  async function handleAdd() {
    const label = newLabel.trim();
    if (!label) return;

    setAdding(true);
    setAddError(null);
    try {
      const item = await addPackingItem(tripId, { label, personal });
      setItems((prev) => [...prev, item]);
      setNewLabel('');
      inputRef.current?.focus();
    } catch {
      setAddError('Failed to add item.');
    } finally {
      setAdding(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const packedCount = items.filter((i) => i.packed).length;
  const total = items.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner className="w-5 h-5 text-indigo-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center justify-between"
      >
        {error}
        <button
          onClick={load}
          className="ml-4 text-xs font-medium text-red-700 underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      {total > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: total > 0 ? `${(packedCount / total) * 100}%` : '0%' }}
              aria-hidden="true"
            />
          </div>
          <span className="text-xs text-slate-500 shrink-0 tabular-nums">
            {packedCount} / {total} packed
          </span>
        </div>
      )}

      {/* Item list */}
      {items.length === 0 ? (
        <p className="text-sm text-slate-400 italic py-4 text-center">
          No items yet. Add the first one below.
        </p>
      ) : (
        <ul className="space-y-1" aria-label={personal ? 'My packing items' : 'Shared packing items'}>
          {items.map((item) => {
            const canDelete = !currentUserId || item.addedBy.id === currentUserId;
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 group/item transition-colors"
              >
                {/* Checkbox */}
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.packed}
                  aria-label={`Mark "${item.label}" as ${item.packed ? 'unpacked' : 'packed'}`}
                  onClick={() => handleToggle(item)}
                  className={[
                    'w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-all duration-150',
                    'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1',
                    item.packed
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-slate-300 hover:border-indigo-400 bg-white',
                  ].join(' ')}
                >
                  {item.packed && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>

                {/* Label */}
                <span
                  className={[
                    'flex-1 text-sm transition-colors duration-150',
                    item.packed ? 'line-through text-slate-400' : 'text-slate-800',
                  ].join(' ')}
                >
                  {item.label}
                </span>

                {/* Added-by badge (shared list only) */}
                {!personal && (
                  <span
                    className="text-[10px] text-slate-400 shrink-0 hidden sm:block"
                    title={`Added by ${item.addedBy.name}`}
                  >
                    {item.addedBy.name.split(' ')[0]}
                  </span>
                )}

                {/* Delete */}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    aria-label={`Delete "${item.label}"`}
                    className="opacity-0 group-hover/item:opacity-100 transition-opacity
                               p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50
                               focus:outline-none focus:opacity-100 focus:ring-2 focus:ring-red-400"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Add item row */}
      <div className="flex items-center gap-2 pt-1">
        <input
          ref={inputRef}
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add an item…"
          aria-label="New packing item"
          disabled={adding}
          className="flex-1 rounded-xl px-4 py-2 text-sm text-slate-900
                     border border-slate-200 bg-white placeholder:text-slate-300
                     hover:border-slate-300
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                     disabled:opacity-60
                     transition-colors duration-150"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding || !newLabel.trim()}
          aria-label="Add item"
          className="inline-flex items-center justify-center w-9 h-9 rounded-xl
                     bg-indigo-600 text-white
                     hover:bg-indigo-700 active:bg-indigo-800
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1
                     transition-all duration-150 shrink-0"
        >
          {adding ? (
            <Spinner className="w-4 h-4" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          )}
        </button>
      </div>

      {addError && (
        <p role="alert" className="text-xs text-red-600">
          {addError}
        </p>
      )}
    </div>
  );
}
