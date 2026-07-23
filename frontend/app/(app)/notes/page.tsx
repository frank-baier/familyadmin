'use client';

/**
 * Notes page — /notes
 * Personal, per-user categories each holding a free-form tree of note nodes.
 * Every request is scoped to the logged-in user on the backend — no cross-user visibility.
 */

import { useState, useEffect, useRef } from 'react';
import { NoteTree } from '@/components/notes/NoteTree';
import { NoteEditor } from '@/components/notes/NoteEditor';
import {
  getNoteCategories,
  createNoteCategory,
  deleteNoteCategory,
  getNoteNodes,
  createNoteNode,
  updateNoteNode,
  deleteNoteNode,
  searchNoteNodes,
} from '@/lib/notes';
import type { NoteCategory, NoteNode } from '@/lib/notes';

function contentSnippet(content: string | null, max = 80): string {
  if (!content) return '';
  const flat = content.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

const ACCENT = { background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' };

// ─── Category tab ────────────────────────────────────────────────────────────

function CategoryTab({
  category,
  active,
  onSelect,
  onDelete,
}: {
  category: NoteCategory;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div
      className={[
        'flex items-center rounded-xl transition-colors duration-150 shrink-0',
        active ? 'text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100',
      ].join(' ')}
      style={active ? ACCENT : undefined}
    >
      <button
        type="button"
        onClick={onSelect}
        role="tab"
        aria-selected={active}
        className="px-4 py-2 text-sm font-medium whitespace-nowrap"
      >
        {category.name}
      </button>
      {active && (
        confirmingDelete ? (
          <span className="flex items-center gap-0.5 pr-2">
            <button
              type="button"
              onClick={onDelete}
              title="Wirklich löschen"
              className="w-5 h-5 flex items-center justify-center rounded text-white hover:bg-white/20"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              title="Abbrechen"
              className="w-5 h-5 flex items-center justify-center rounded text-white/80 hover:bg-white/20"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            title="Kategorie löschen"
            className="pr-3 pl-1 text-white/70 hover:text-white"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        )
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NotesPage() {
  const [categories, setCategories] = useState<NoteCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<NoteNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingNodes, setLoadingNodes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [addCategoryError, setAddCategoryError] = useState<string | null>(null);
  const categoryInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NoteNode[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const results = await searchNoteNodes(query);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    if (selectedCategoryId) {
      loadNodes(selectedCategoryId);
    } else {
      setNodes([]);
      setSelectedNodeId(null);
    }
  }, [selectedCategoryId]);

  async function loadCategories() {
    setLoadingCategories(true);
    setError(null);
    try {
      const data = await getNoteCategories();
      setCategories(data);
      if (data.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(data[0].id);
      }
    } catch {
      setError('Kategorien konnten nicht geladen werden.');
    } finally {
      setLoadingCategories(false);
    }
  }

  async function loadNodes(categoryId: string) {
    setLoadingNodes(true);
    try {
      const data = await getNoteNodes(categoryId);
      setNodes(data);
    } catch {
      setError('Notizen konnten nicht geladen werden.');
    } finally {
      setLoadingNodes(false);
    }
  }

  async function handleAddCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    setAddingCategory(true);
    setAddCategoryError(null);
    try {
      const category = await createNoteCategory(name);
      setCategories((prev) => [...prev, category]);
      setSelectedCategoryId(category.id);
      setNewCategoryName('');
      setShowAddCategory(false);
    } catch {
      setAddCategoryError('Kategorie konnte nicht erstellt werden (Name evtl. bereits vergeben).');
    } finally {
      setAddingCategory(false);
    }
  }

  async function handleDeleteCategory(categoryId: string) {
    try {
      await deleteNoteCategory(categoryId);
      const remaining = categories.filter((c) => c.id !== categoryId);
      setCategories(remaining);
      setSelectedCategoryId(remaining.length > 0 ? remaining[0].id : null);
    } catch {
      setError('Kategorie konnte nicht gelöscht werden.');
    }
  }

  function handleSelectSearchResult(result: NoteNode) {
    setSelectedCategoryId(result.categoryId);
    setSelectedNodeId(result.id);
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  }

  async function handleAddNode(parentId: string | null) {
    if (!selectedCategoryId) return;
    try {
      const node = await createNoteNode(selectedCategoryId, { parentId, name: 'Neue Notiz' });
      setNodes((prev) => [...prev, node]);
      setSelectedNodeId(node.id);
    } catch {
      setError('Notiz konnte nicht erstellt werden.');
    }
  }

  async function handleSaveNode(id: string, name: string, content: string) {
    const existing = nodes.find((n) => n.id === id);
    const updated = await updateNoteNode(id, { parentId: existing?.parentId ?? null, name, content });
    setNodes((prev) => prev.map((n) => (n.id === id ? updated : n)));
  }

  async function handleDeleteNode(id: string) {
    try {
      await deleteNoteNode(id);
      const idsToRemove = collectDescendantIds(nodes, id);
      setNodes((prev) => prev.filter((n) => !idsToRemove.has(n.id)));
      if (selectedNodeId && idsToRemove.has(selectedNodeId)) {
        setSelectedNodeId(null);
      }
    } catch {
      setError('Notiz konnte nicht gelöscht werden.');
    }
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Notizen</h1>
          <p className="text-slate-500 text-sm mt-1">Deine persönlichen Notizen — nur für dich sichtbar</p>
        </div>

        <div className="relative w-full max-w-xs shrink-0">
          <svg
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowSearchResults(true); }}
            onFocus={() => setShowSearchResults(true)}
            onBlur={() => setTimeout(() => setShowSearchResults(false), 150)}
            placeholder="Notizen durchsuchen…"
            className="input-field pl-9 w-full"
          />

          {showSearchResults && searchQuery.trim() && (
            <div className="absolute z-10 mt-2 w-full max-h-96 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg">
              {searching ? (
                <p className="px-4 py-3 text-xs text-slate-400">Suche…</p>
              ) : searchResults.length === 0 ? (
                <p className="px-4 py-3 text-xs text-slate-400">Keine Treffer.</p>
              ) : (
                <ul>
                  {searchResults.map((result) => {
                    const categoryName = categories.find((c) => c.id === result.categoryId)?.name ?? '';
                    return (
                      <li key={result.id}>
                        <button
                          type="button"
                          onMouseDown={() => handleSelectSearchResult(result)}
                          className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 transition-colors border-b border-slate-50 last:border-0"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-slate-800 truncate">{result.name}</span>
                            <span className="text-[11px] text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5 shrink-0">{categoryName}</span>
                          </div>
                          {result.content && (
                            <p className="text-xs text-slate-400 mt-0.5 truncate">{contentSnippet(result.content)}</p>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6">
          {error}
        </div>
      )}

      {/* Category tabs */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1" role="tablist">
        {loadingCategories ? (
          <div className="h-9 w-64 bg-slate-100 rounded-xl animate-pulse" />
        ) : (
          <>
            {categories.map((category) => (
              <CategoryTab
                key={category.id}
                category={category}
                active={category.id === selectedCategoryId}
                onSelect={() => setSelectedCategoryId(category.id)}
                onDelete={() => handleDeleteCategory(category.id)}
              />
            ))}

            {showAddCategory ? (
              <div className="flex items-center gap-1 shrink-0">
                <input
                  ref={categoryInputRef}
                  type="text"
                  autoFocus
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
                  placeholder="Kategoriename…"
                  disabled={addingCategory}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={addingCategory || !newCategoryName.trim()}
                  className="text-xs font-semibold text-emerald-600 px-2 py-2 disabled:opacity-50"
                >
                  Speichern
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddCategory(false); setNewCategoryName(''); setAddCategoryError(null); }}
                  className="text-xs font-medium text-slate-400 px-2 py-2 hover:text-slate-600"
                >
                  Abbrechen
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddCategory(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Kategorie
              </button>
            )}
          </>
        )}
      </div>
      {addCategoryError && (
        <p className="text-xs text-red-600 -mt-4 mb-4">{addCategoryError}</p>
      )}

      {/* Content */}
      {!loadingCategories && categories.length === 0 ? (
        <div className="text-center py-16 glass rounded-3xl">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Noch keine Kategorien</p>
          <p className="text-xs text-slate-500 mb-4">Lege eine Kategorie an, z. B. &bdquo;Personen&ldquo;.</p>
          <button
            type="button"
            onClick={() => setShowAddCategory(true)}
            className="btn-primary text-xs"
            style={ACCENT}
          >
            Kategorie anlegen
          </button>
        </div>
      ) : (
        selectedCategoryId && (
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
            <div className="glass rounded-3xl p-3">
              {loadingNodes ? (
                <div className="space-y-2 p-2 animate-pulse">
                  {[1, 2, 3].map((n) => <div key={n} className="h-8 bg-slate-100 rounded-xl" />)}
                </div>
              ) : (
                <NoteTree
                  nodes={nodes}
                  selectedId={selectedNodeId}
                  onSelect={setSelectedNodeId}
                  onAddChild={handleAddNode}
                  onDelete={handleDeleteNode}
                />
              )}
            </div>

            <div className="min-h-[420px]">
              <NoteEditor node={selectedNode} onSave={handleSaveNode} />
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function collectDescendantIds(nodes: NoteNode[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
        ids.add(node.id);
        changed = true;
      }
    }
  }
  return ids;
}
