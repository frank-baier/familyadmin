'use client';

import { useState, useEffect, useRef } from 'react';
import {
  getPackingItems,
  addPackingItem,
  togglePackingItem,
  deletePackingItem,
} from '@/lib/travel';
import type { PackingItem } from '@/lib/travel';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByCategory(items: PackingItem[]): [string, PackingItem[]][] {
  const map = new Map<string, PackingItem[]>();
  for (const item of items) {
    const key = item.category ?? 'Sonstiges';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries());
}

// ─── Category section ─────────────────────────────────────────────────────────

interface CategorySectionProps {
  category: string;
  items: PackingItem[];
  currentUserId?: string;
  personal: boolean;
  onToggle: (item: PackingItem) => void;
  onDelete: (id: string) => void;
}

function CategorySection({ category, items, currentUserId, personal, onToggle, onDelete }: CategorySectionProps) {
  const [open, setOpen] = useState(true);
  const packedCount = items.filter((i) => i.packed).length;
  const allPacked = packedCount === items.length && items.length > 0;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/80 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-400"
      >
        <svg
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className={`flex-1 text-sm font-semibold ${allPacked ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
          {category}
        </span>
        <span className="text-xs text-slate-400 tabular-nums shrink-0">
          {packedCount}/{items.length}
        </span>
      </button>

      {open && (
        <ul className="border-t border-slate-100 divide-y divide-slate-50">
          {items.map((item) => {
            const canDelete = !currentUserId || item.addedBy.id === currentUserId || !item.addedBy.id;
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/80 group/item transition-colors"
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.packed}
                  onClick={() => onToggle(item)}
                  className={[
                    'w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-all duration-150',
                    'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1',
                    item.packed
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-slate-300 hover:border-indigo-400 bg-white',
                  ].join(' ')}
                >
                  {item.packed && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>

                <span className={`flex-1 text-sm transition-colors duration-150 ${item.packed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                  {item.label}
                </span>

                {!personal && item.addedBy.name && item.addedBy.name !== 'Unbekannt' && (
                  <span className="text-[10px] text-slate-400 shrink-0 hidden sm:block" title={`Hinzugefügt von ${item.addedBy.name}`}>
                    {item.addedBy.name.split(' ')[0]}
                  </span>
                )}

                {canDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    className="opacity-0 group-hover/item:opacity-100 transition-opacity p-1 rounded-lg
                               text-slate-300 hover:text-red-500 hover:bg-red-50
                               focus:outline-none focus:opacity-100 focus:ring-2 focus:ring-red-400"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PackingListProps {
  tripId: string;
  personal: boolean;
  currentUserId?: string;
}

const CATEGORY_OPTIONS = [
  'Elektronik & Strom',
  'Wohnmobil / Camping',
  'Sonnenschutz & Insekten',
  'Apotheke & Medizin',
  'Körperpflege & Kosmetik',
  'Praktisches',
  'Sonstiges',
];

export function PackingList({ tripId, personal, currentUserId }: PackingListProps) {
  const [items, setItems] = useState<PackingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newCategory, setNewCategory] = useState('');
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
      setError('Packliste konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(item: PackingItem) {
    const previous = items;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, packed: !i.packed } : i)));
    try {
      const updated = await togglePackingItem(tripId, item.id);
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    } catch {
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
      const categoryItems = items.filter((i) => (i.category ?? 'Sonstiges') === (newCategory || 'Sonstiges'));
      const position = categoryItems.length;
      const item = await addPackingItem(tripId, {
        label,
        personal,
        category: newCategory || undefined,
        position,
      });
      setItems((prev) => [...prev, item]);
      setNewLabel('');
      inputRef.current?.focus();
    } catch {
      setAddError('Eintrag konnte nicht hinzugefügt werden.');
    } finally {
      setAdding(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
  }

  const packedCount = items.filter((i) => i.packed).length;
  const total = items.length;
  const groups = groupByCategory(items);

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3].map((n) => <div key={n} className="h-12 bg-slate-100 rounded-2xl" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-2xl bg-red-50/80 border border-red-200/60 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
        {error}
        <button onClick={load} className="ml-4 text-xs font-medium underline hover:no-underline">Erneut versuchen</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      {total > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${(packedCount / total) * 100}%` }}
            />
          </div>
          <span className="text-xs text-slate-500 shrink-0 tabular-nums">
            {packedCount} / {total} eingepackt
          </span>
        </div>
      )}

      {/* Category groups */}
      {groups.length === 0 ? (
        <p className="text-sm text-slate-400 italic py-4 text-center">
          Noch keine Einträge. Füge unten den ersten hinzu.
        </p>
      ) : (
        <div className="space-y-2">
          {groups.map(([category, groupItems]) => (
            <CategorySection
              key={category}
              category={category}
              items={groupItems}
              currentUserId={currentUserId}
              personal={personal}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Add item row */}
      <div className="flex items-center gap-2 pt-1">
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 shrink-0"
        >
          <option value="">Kategorie…</option>
          {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          ref={inputRef}
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Eintrag hinzufügen…"
          disabled={adding}
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding || !newLabel.trim()}
          className="inline-flex items-center justify-center w-10 h-10 rounded-xl shrink-0 text-white
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1
                     transition-all duration-150"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', boxShadow: '0 4px 12px rgb(99 102 241 / 0.35)' }}
        >
          {adding ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          )}
        </button>
      </div>

      {addError && <p role="alert" className="text-xs text-red-600">{addError}</p>}
    </div>
  );
}
