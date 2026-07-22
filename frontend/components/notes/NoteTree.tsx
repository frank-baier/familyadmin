'use client';

import { useMemo, useState } from 'react';
import type { NoteNode } from '@/lib/notes';

interface NoteTreeProps {
  nodes: NoteNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string | null) => void;
  onDelete: (id: string) => void;
}

export function NoteTree({ nodes, selectedId, onSelect, onAddChild, onDelete }: NoteTreeProps) {
  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, NoteNode[]>();
    for (const node of nodes) {
      const list = map.get(node.parentId) ?? [];
      list.push(node);
      map.set(node.parentId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.position - b.position);
    }
    return map;
  }, [nodes]);

  const roots = childrenByParent.get(null) ?? [];

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => onAddChild(null)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-600 hover:bg-emerald-50 transition-colors mb-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Neue Notiz
      </button>

      {roots.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-slate-400">Noch keine Notizen in dieser Kategorie.</p>
      ) : (
        <ul role="tree">
          {roots.map((node) => (
            <NoteTreeItem
              key={node.id}
              node={node}
              depth={0}
              childrenByParent={childrenByParent}
              selectedId={selectedId}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface NoteTreeItemProps {
  node: NoteNode;
  depth: number;
  childrenByParent: Map<string | null, NoteNode[]>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string | null) => void;
  onDelete: (id: string) => void;
}

function NoteTreeItem({ node, depth, childrenByParent, selectedId, onSelect, onAddChild, onDelete }: NoteTreeItemProps) {
  const kids = childrenByParent.get(node.id) ?? [];
  const [expanded, setExpanded] = useState(true);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isSelected = selectedId === node.id;

  return (
    <li role="treeitem" aria-selected={isSelected}>
      <div
        className={[
          'group flex items-center gap-1 rounded-xl pr-2 py-1.5 text-sm transition-colors duration-150',
          isSelected ? 'bg-emerald-50 text-emerald-800 font-medium' : 'text-slate-600 hover:bg-slate-50',
        ].join(' ')}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className={['w-4 h-4 shrink-0 flex items-center justify-center text-slate-400', kids.length === 0 ? 'invisible' : ''].join(' ')}
          aria-label={expanded ? 'Einklappen' : 'Ausklappen'}
        >
          <svg
            className={['w-3 h-3 transition-transform', expanded ? 'rotate-90' : ''].join(' ')}
            fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        <button type="button" onClick={() => onSelect(node.id)} className="flex-1 text-left truncate py-0.5">
          {node.name}
        </button>

        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onAddChild(node.id)}
            title="Unternotiz hinzufügen"
            className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
          {confirmingDelete ? (
            <>
              <button
                type="button"
                onClick={() => { onDelete(node.id); setConfirmingDelete(false); }}
                title="Wirklich löschen"
                className="w-6 h-6 flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                title="Abbrechen"
                className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              title="Löschen"
              className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {expanded && kids.length > 0 && (
        <ul role="group">
          {kids.map((child) => (
            <NoteTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              childrenByParent={childrenByParent}
              selectedId={selectedId}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
