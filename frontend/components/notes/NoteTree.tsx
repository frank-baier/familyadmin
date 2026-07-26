'use client';

import { useMemo, useState } from 'react';
import type { NoteNode } from '@/lib/notes';

const ROOT_DROP_ZONE = '__root__';

interface NoteTreeProps {
  nodes: NoteNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string | null) => void;
  onDelete: (id: string) => void;
  onMove: (nodeId: string, newParentId: string | null) => void;
}

export function NoteTree({ nodes, selectedId, onSelect, onAddChild, onDelete, onMove }: NoteTreeProps) {
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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const selectedNode = selectedId ? nodes.find((n) => n.id === selectedId) : undefined;

  function handleDrop(newParentId: string | null) {
    if (draggingId && draggingId !== newParentId) {
      onMove(draggingId, newParentId);
    }
    setDraggingId(null);
    setDragOverId(null);
  }

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => onAddChild(selectedId ?? null)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-600 hover:bg-emerald-50 transition-colors mb-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        {selectedNode ? `Neue Notiz in "${selectedNode.name}"` : 'Neue Notiz'}
      </button>

      {roots.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-slate-400">Noch keine Notizen in dieser Kategorie.</p>
      ) : (
        <ul
          role="tree"
          onDragOver={(e) => { e.preventDefault(); setDragOverId(ROOT_DROP_ZONE); }}
          onDragLeave={() => setDragOverId((id) => (id === ROOT_DROP_ZONE ? null : id))}
          onDrop={(e) => { e.preventDefault(); handleDrop(null); }}
          className={dragOverId === ROOT_DROP_ZONE ? 'rounded-xl ring-2 ring-inset ring-emerald-400' : ''}
        >
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
              draggingId={draggingId}
              setDraggingId={setDraggingId}
              dragOverId={dragOverId}
              setDragOverId={setDragOverId}
              onDropNode={handleDrop}
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
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
  dragOverId: string | null;
  setDragOverId: (id: string | null | ((prev: string | null) => string | null)) => void;
  onDropNode: (newParentId: string | null) => void;
}

function NoteTreeItem({
  node, depth, childrenByParent, selectedId, onSelect, onAddChild, onDelete,
  draggingId, setDraggingId, dragOverId, setDragOverId, onDropNode,
}: NoteTreeItemProps) {
  const kids = childrenByParent.get(node.id) ?? [];
  const isBranch = kids.length > 0;
  const [expanded, setExpanded] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isSelected = selectedId === node.id;
  const isDragging = draggingId === node.id;
  const isDragOver = dragOverId === node.id;

  return (
    <li role="treeitem" aria-selected={isSelected}>
      <div
        draggable
        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', node.id); setDraggingId(node.id); }}
        onDragEnd={() => setDraggingId(null)}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDragOverId(node.id); }}
        onDragLeave={() => setDragOverId((id) => (id === node.id ? null : id))}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropNode(node.id); }}
        className={[
          'group flex items-center gap-1 rounded-xl pr-2 py-1.5 text-sm transition-colors duration-150 cursor-grab active:cursor-grabbing',
          isSelected ? 'bg-emerald-50 text-emerald-800 font-medium' : 'text-slate-600 hover:bg-slate-50',
          isDragging ? 'opacity-40' : '',
          isDragOver ? 'ring-2 ring-inset ring-emerald-400' : '',
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

        {isBranch ? (
          <svg className="w-4 h-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 015.25 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18.75A2.25 2.25 0 0121 9v.776" />
          </svg>
        ) : (
          <svg className="w-4 h-4 shrink-0 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        )}

        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className={['flex-1 text-left truncate py-0.5', isBranch && !isSelected ? 'font-semibold text-slate-700' : ''].join(' ')}
        >
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
              draggingId={draggingId}
              setDraggingId={setDraggingId}
              dragOverId={dragOverId}
              setDragOverId={setDragOverId}
              onDropNode={onDropNode}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
