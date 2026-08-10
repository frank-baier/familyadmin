'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  getDocuments,
  getDocumentTree,
  getUnindexedDocuments,
  acceptUnindexedDocuments,
  uploadDocument,
  deleteDocument,
  formatFileSize,
  type Document,
  type DocumentTreeNode,
  type PagedDocuments,
} from '@/lib/documents';
import {
  getMyShares,
  getShareableUsers,
  shareWith,
  revokeShare,
  type ShareableUser,
} from '@/lib/document-shares';
import { ApiError, apiFetchBlob } from '@/lib/api';

// ─── Icons ────────────────────────────────────────────────────────────────────

function FileIcon({ contentType }: { contentType: string }) {
  const t = contentType.toLowerCase();
  if (t.includes('pdf')) return (
    <span className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    </span>
  );
  if (t.includes('image')) return (
    <span className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
      <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    </span>
  );
  return (
    <span className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
      <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    </span>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function FolderIcon({ color = 'amber' }: { color?: string }) {
  const colors: Record<string, string> = {
    amber: 'text-amber-400',
    blue: 'text-blue-400',
    emerald: 'text-emerald-400',
    violet: 'text-violet-400',
    slate: 'text-slate-400',
  };
  return (
    <svg className={`w-4 h-4 ${colors[color] ?? colors.amber} shrink-0`} fill="currentColor" viewBox="0 0 24 24">
      <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
    </svg>
  );
}

// ─── Upload zone ──────────────────────────────────────────────────────────────

function UploadZone({ onUpload, uploading }: { onUpload: (f: File) => Promise<void>; uploading: boolean }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      className={[
        'glass rounded-2xl border-2 border-dashed transition-all cursor-pointer',
        'flex items-center justify-center gap-3 py-6 px-6',
        dragging ? 'border-amber-400 bg-amber-50/60' : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/30',
        uploading ? 'pointer-events-none opacity-60' : '',
      ].join(' ')}
    >
      <input ref={inputRef} type="file" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
      {uploading ? (
        <>
          <svg className="w-5 h-5 text-amber-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <p className="text-sm text-slate-500">Dokument wird hochgeladen…</p>
        </>
      ) : (
        <>
          <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-slate-700">Datei hochladen</p>
            <p className="text-xs text-slate-400">PDF, Word, Excel, Bilder — hierher ziehen oder klicken</p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Document row ─────────────────────────────────────────────────────────────

function DocRow({
  doc, indent, onDownload, onDelete, deleting,
}: {
  doc: Document; indent: number; onDownload: (d: Document) => void;
  onDelete: (id: string) => void; deleting: boolean;
}) {
  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('de-CH', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Zurich',
    });
  }

  return (
    <div className="flex items-center gap-2.5 py-2.5 px-3 hover:bg-slate-50/60 rounded-xl transition-colors group"
      style={{ paddingLeft: `${12 + indent * 20}px` }}>
      <FileIcon contentType={doc.contentType} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{doc.filename}</p>
        <p className="text-xs text-slate-400 mt-0.5">{formatFileSize(doc.fileSize)} · {formatDate(doc.createdAt)}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onDownload(doc)}
          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
          title="Herunterladen"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        </button>
        <button
          onClick={() => onDelete(doc.id)}
          disabled={deleting}
          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40"
          title="Löschen"
        >
          {deleting ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Tree types ───────────────────────────────────────────────────────────────

interface DocFilter {
  category: string | null;
  year?: number;
  subcategory?: string;
  subcategoryPrefix?: string;
}

interface TreeNode {
  key: string;
  name: string;
  totalCount: number;
  children: TreeNode[];
  isCategory: boolean;
  color?: string;
  filter: DocFilter;
}

function buildNestedNodes(
  nodes: DocumentTreeNode[],
  category: string | null,
  absoluteBase: string,
): TreeNode[] {
  const folderMap = new Map<string, DocumentTreeNode[]>();
  const directNodes: DocumentTreeNode[] = [];

  for (const node of nodes) {
    const sub = node.subcategory ?? null;
    if (!sub) {
      directNodes.push(node);
    } else {
      const segs = sub.split('/');
      const first = segs[0];
      const rest = segs.slice(1).join('/') || null;
      if (!folderMap.has(first)) folderMap.set(first, []);
      folderMap.get(first)!.push({ ...node, subcategory: rest });
    }
  }

  const result: TreeNode[] = [];

  for (const node of directNodes) {
    if (node.year !== null) {
      result.push({
        key: `year:${category}:${absoluteBase}:${node.year}`,
        name: String(node.year),
        totalCount: node.count,
        children: [],
        isCategory: false,
        filter: { category, subcategory: absoluteBase || undefined, year: node.year ?? undefined },
      });
    }
  }

  const directNullCount = directNodes
    .filter((n) => n.year === null)
    .reduce((s, n) => s + n.count, 0);
  if (directNullCount > 0 && folderMap.size > 0) {
    result.push({
      key: `allgemein:${category}:${absoluteBase}`,
      name: 'Allgemein',
      totalCount: directNullCount,
      children: [],
      isCategory: false,
      filter: { category, subcategory: absoluteBase || undefined },
    });
  }

  for (const [folderName, children] of folderMap) {
    const abs = absoluteBase ? `${absoluteBase}/${folderName}` : folderName;
    const total = children.reduce((s, n) => s + n.count, 0);
    result.push({
      key: `folder:${category}:${abs}`,
      name: folderName,
      totalCount: total,
      children: buildNestedNodes(children, category, abs),
      isCategory: false,
      filter: { category, subcategoryPrefix: abs },
    });
  }

  result.sort((a, b) => {
    if (a.name === 'Allgemein') return 1;
    if (b.name === 'Allgemein') return -1;
    const aIsYear = /^\d{4}$/.test(a.name);
    const bIsYear = /^\d{4}$/.test(b.name);
    if (!aIsYear && bIsYear) return -1;
    if (aIsYear && !bIsYear) return 1;
    if (aIsYear && bIsYear) return parseInt(b.name) - parseInt(a.name);
    return a.name.localeCompare(b.name, 'de');
  });

  return result;
}

function buildTree(nodes: DocumentTreeNode[]): TreeNode[] {
  const catMap = new Map<string, DocumentTreeNode[]>();
  for (const node of nodes) {
    const key = node.category ?? '__none__';
    if (!catMap.has(key)) catMap.set(key, []);
    catMap.get(key)!.push(node);
  }
  return Array.from(catMap.entries())
    .map(([, catNodes]) => {
      const catName = catNodes[0].category ?? null;
      const total = catNodes.reduce((s, n) => s + n.count, 0);
      return {
        key: `cat:${catName ?? '__none__'}`,
        name: catName ?? 'Nicht kategorisiert',
        totalCount: total,
        children: buildNestedNodes(catNodes, catName, ''),
        isCategory: true,
        color: categoryColor(catName),
        filter: { category: catName },
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

const CATEGORY_COLORS: Record<string, string> = {
  Reisen: 'amber',
  Finanzen: 'emerald',
  Auto: 'blue',
  Gesundheit: 'violet',
  Versicherung: 'slate',
};

function categoryColor(name: string | null): string {
  if (!name) return 'slate';
  return CATEGORY_COLORS[name] ?? 'amber';
}

// ─── Unindexed documents panel ────────────────────────────────────────────────

function UnindexedPanel({
  docs,
  loading,
  onDownload,
  onDelete,
  deletingId,
  onAcceptAll,
}: {
  docs: Document[];
  loading: boolean;
  onDownload: (d: Document) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
  onAcceptAll: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [accepting, setAccepting] = useState(false);

  if (loading) return null;
  if (docs.length === 0) return null;

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('de-CH', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Zurich',
    });
  }

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-amber-50/80 transition-colors"
      >
        <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <span className="flex-1 text-sm font-semibold text-amber-800">
          {docs.length} {docs.length === 1 ? 'Dokument' : 'Dokumente'} ohne Textindex
        </span>
        <span className="text-xs text-amber-600 bg-amber-100 rounded-full px-2 py-0.5">
          nicht durchsuchbar
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setAccepting(true);
            onAcceptAll().finally(() => setAccepting(false));
          }}
          disabled={accepting}
          className="ml-2 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-full px-3 py-0.5 transition-colors disabled:opacity-50 shrink-0"
        >
          {accepting ? 'Wird gespeichert…' : 'Alle akzeptieren'}
        </button>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="border-t border-amber-200 divide-y divide-amber-100">
          <p className="px-4 py-2.5 text-xs text-amber-700 bg-amber-50/40">
            Diese Dateien sind Bilder oder gescannte PDFs ohne extrahierbaren Text. Sie können nicht per KI durchsucht werden. Prüfe und lösche nicht benötigte Dateien.
          </p>
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2.5 py-2.5 px-4 hover:bg-amber-50/60 transition-colors group"
            >
              <FileIcon contentType={doc.contentType} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{doc.filename}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {doc.category ?? '–'}
                  {doc.subcategory ? ` · ${doc.subcategory}` : ''}
                  {doc.year ? ` · ${doc.year}` : ''}
                  {' · '}
                  {formatFileSize(doc.fileSize)}
                  {' · '}
                  {formatDate(doc.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onDownload(doc)}
                  className="w-7 h-7 rounded-lg bg-amber-100 hover:bg-amber-200 flex items-center justify-center text-amber-600 transition-colors"
                  title="Herunterladen"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                </button>
                <button
                  onClick={() => onDelete(doc.id)}
                  disabled={deletingId === doc.id}
                  className="w-7 h-7 rounded-lg bg-amber-100 hover:bg-red-50 flex items-center justify-center text-amber-500 hover:text-red-500 transition-colors disabled:opacity-40"
                  title="Löschen"
                >
                  {deletingId === doc.id ? (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Recursive tree node ──────────────────────────────────────────────────────

function TreeNodeRow({
  node, depth, expanded, toggle, openLeaf, docsMap, loadingLeaf, loadMore, onDownload, onDelete, deleteId,
}: {
  node: TreeNode; depth: number; expanded: Set<string>;
  toggle: (key: string) => void;
  openLeaf: (key: string, filter: DocFilter) => void;
  docsMap: Map<string, { docs: Document[]; total: number; nextPage: number }>;
  loadingLeaf: Set<string>;
  loadMore: (key: string, filter: DocFilter, page: number) => void;
  onDownload: (doc: Document) => void;
  onDelete: (id: string) => void;
  deleteId: string | null;
}) {
  const isOpen = expanded.has(node.key);
  const hasChildren = node.children.length > 0;
  const isLeaf = !hasChildren;
  const leafData = isLeaf ? docsMap.get(node.key) : undefined;
  const isLoadingLeaf = loadingLeaf.has(node.key);
  const hasMore = leafData != null && leafData.docs.length < leafData.total;
  const isYear = /^\d{4}$/.test(node.name);
  const pl = 16 + depth * 20;

  function handleClick() {
    if (hasChildren) {
      toggle(node.key);
    } else {
      openLeaf(node.key, node.filter);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        className="w-full flex items-center gap-3 hover:bg-slate-50/70 transition-colors text-left"
        style={{ paddingLeft: `${pl}px`, paddingRight: '16px', paddingTop: node.isCategory ? '14px' : '10px', paddingBottom: node.isCategory ? '14px' : '10px' }}
      >
        <ChevronIcon open={isOpen} />
        {node.isCategory ? (
          <FolderIcon color={node.color ?? 'amber'} />
        ) : isYear ? (
          <svg className="w-4 h-4 text-slate-300 shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M5.25 2.25a3 3 0 00-3 3v4.318a3 3 0 00.879 2.121l9.58 9.581c.92.92 2.39 1.186 3.548.428a18.849 18.849 0 005.441-5.44c.758-1.16.492-2.629-.428-3.548l-9.58-9.581a3 3 0 00-2.122-.879H5.25zM6.375 7.5a1.125 1.125 0 100-2.25 1.125 1.125 0 000 2.25z" clipRule="evenodd" />
          </svg>
        ) : (
          <FolderIcon color="slate" />
        )}
        <span className={`flex-1 text-sm ${node.isCategory ? 'font-semibold text-slate-800' : 'text-slate-700'} truncate`}>
          {node.name}
        </span>
        <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 shrink-0">
          {node.totalCount}
        </span>
      </button>

      {isOpen && hasChildren && (
        <div className="divide-y divide-slate-50">
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.key}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              openLeaf={openLeaf}
              docsMap={docsMap}
              loadingLeaf={loadingLeaf}
              loadMore={loadMore}
              onDownload={onDownload}
              onDelete={onDelete}
              deleteId={deleteId}
            />
          ))}
        </div>
      )}

      {isOpen && isLeaf && (
        <div className="bg-slate-50/40">
          {leafData?.docs.map((doc) => (
            <DocRow
              key={doc.id}
              doc={doc}
              indent={depth + 2}
              onDownload={onDownload}
              onDelete={onDelete}
              deleting={deleteId === doc.id}
            />
          ))}
          {isLoadingLeaf && (
            <div className="flex items-center gap-2 py-3" style={{ paddingLeft: `${pl + 40}px` }}>
              <svg className="w-4 h-4 text-amber-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <span className="text-xs text-slate-400">Laden…</span>
            </div>
          )}
          {!isLoadingLeaf && hasMore && leafData && (
            <button
              onClick={() => loadMore(node.key, node.filter, leafData.nextPage)}
              className="w-full text-xs text-slate-400 hover:text-amber-600 py-2.5 transition-colors text-left"
              style={{ paddingLeft: `${pl + 40}px` }}
            >
              + {leafData.total - leafData.docs.length} weitere laden…
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Unindexed documents
  const [unindexed, setUnindexed] = useState<Document[]>([]);
  const [unindexedLoading, setUnindexedLoading] = useState(true);

  // Sharing
  const [shares, setShares] = useState<ShareableUser[]>([]);
  const [shareableUsers, setShareableUsers] = useState<ShareableUser[]>([]);
  const [sharesLoading, setSharesLoading] = useState(true);

  // Expanded state: Set of keys like "cat:Reisen", "year:Reisen:2026", "sub:Reisen:2026:Australien"
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Loaded documents per leaf key  { docs, total, nextPage }
  const [docsMap, setDocsMap] = useState<Map<string, { docs: Document[]; total: number; nextPage: number }>>(new Map());
  const [loadingLeaf, setLoadingLeaf] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadTree();
    loadUnindexed();
    loadShares();
  }, []);

  async function loadTree() {
    setLoading(true);
    try {
      const nodes = await getDocumentTree();
      setTree(buildTree(nodes));
    } catch {
      setError('Dokumentenstruktur konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  async function loadUnindexed() {
    setUnindexedLoading(true);
    try {
      const result = await getUnindexedDocuments();
      setUnindexed(result.content);
    } catch (e) {
      console.warn('loadUnindexed failed:', e);
    } finally {
      setUnindexedLoading(false);
    }
  }

  async function handleAcceptAll() {
    await acceptUnindexedDocuments();
    setUnindexed([]);
  }

  async function loadShares() {
    setSharesLoading(true);
    try {
      const [myShares, others] = await Promise.all([getMyShares(), getShareableUsers()]);
      setShares(myShares);
      setShareableUsers(others);
    } catch (e) {
      console.warn('loadShares failed:', e);
    } finally {
      setSharesLoading(false);
    }
  }

  async function handleShare(userId: string) {
    await shareWith(userId);
    await loadShares();
  }

  async function handleRevoke(userId: string) {
    await revokeShare(userId);
    setShares((prev) => prev.filter((u) => u.id !== userId));
  }

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  async function loadDocs(leafKey: string, filter: DocFilter, page = 0) {
    if (page === 0 && docsMap.has(leafKey)) return;
    setLoadingLeaf((prev) => new Set(prev).add(leafKey));
    try {
      const result = await getDocuments({
        category: filter.category ?? undefined,
        year: filter.year,
        subcategory: filter.subcategory,
        subcategoryPrefix: filter.subcategoryPrefix,
        page,
      });
      setDocsMap((prev) => {
        const existing = prev.get(leafKey);
        const merged = page === 0 ? result.content : [...(existing?.docs ?? []), ...result.content];
        return new Map(prev).set(leafKey, { docs: merged, total: result.totalElements, nextPage: page + 1 });
      });
    } catch {
      setError('Dokumente konnten nicht geladen werden.');
    } finally {
      setLoadingLeaf((prev) => { const s = new Set(prev); s.delete(leafKey); return s; });
    }
  }

  function openLeaf(leafKey: string, filter: DocFilter) {
    toggle(leafKey);
    if (!expanded.has(leafKey)) {
      loadDocs(leafKey, filter, 0);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true); setError(null);
    try {
      await uploadDocument(file);
      setDocsMap(new Map());
      await loadTree();
    } catch (err) {
      setError(err instanceof ApiError
        ? `Upload fehlgeschlagen (${err.status}).`
        : 'Upload fehlgeschlagen — Server nicht erreichbar?');
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(doc: Document) {
    try {
      const { blob, filename } = await apiFetchBlob(doc.downloadUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch { setError('Download fehlgeschlagen.'); }
  }

  async function handleDelete(id: string) {
    setDeleteId(id);
    try {
      await deleteDocument(id);
      setDocsMap((prev) => {
        const next = new Map(prev);
        next.forEach((entry, key) => next.set(key, {
          ...entry,
          docs: entry.docs.filter((d) => d.id !== id),
          total: entry.total - 1,
        }));
        return next;
      });
      setUnindexed((prev) => prev.filter((d) => d.id !== id));
      await loadTree();
    } catch { setError('Löschen fehlgeschlagen.'); }
    finally { setDeleteId(null); }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dokumente</h1>
          <p className="text-slate-500 text-sm mt-1">Familien-Dokumentenarchiv</p>
        </div>
        <Link
          href="/documents/ask"
          className="btn-primary shrink-0"
          style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          KI Fragen
        </Link>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6 flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="ml-4 text-xs font-medium text-red-700 underline">Schließen</button>
        </div>
      )}

      <div className="mb-6">
        <UploadZone onUpload={handleUpload} uploading={uploading} />
      </div>

      <UnindexedPanel
        docs={unindexed}
        loading={unindexedLoading}
        onDownload={handleDownload}
        onDelete={handleDelete}
        deletingId={deleteId}
        onAcceptAll={handleAcceptAll}
      />

      {/* Sharing panel */}
      {!sharesLoading && shareableUsers.length > 0 && (
        <div className="mb-6 glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3.5 flex items-center gap-3 border-b border-slate-100">
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            <span className="text-sm font-semibold text-slate-700 flex-1">Dokumente freigeben</span>
          </div>
          <div className="px-4 py-3 space-y-2">
            {shareableUsers.map((user) => {
              const isShared = shares.some((s) => s.id === user.id);
              return (
                <div key={user.id} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-600 shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm text-slate-700">{user.name}</span>
                  {isShared ? (
                    <button
                      onClick={() => handleRevoke(user.id)}
                      className="text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-full px-3 py-1 transition-colors"
                    >
                      Freigabe entfernen
                    </button>
                  ) : (
                    <button
                      onClick={() => handleShare(user.id)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-full px-3 py-1 transition-colors"
                    >
                      Freigeben
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tree */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="glass rounded-2xl h-12 animate-pulse" />)}
        </div>
      ) : tree.length === 0 ? (
        <div className="text-center py-16 glass rounded-3xl">
          <span className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </span>
          <p className="text-sm font-semibold text-slate-700 mb-1">Noch keine Dokumente</p>
          <p className="text-xs text-slate-400">Lade dein erstes Dokument hoch.</p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden divide-y divide-slate-100">
          {tree.map((node) => (
            <TreeNodeRow
              key={node.key}
              node={node}
              depth={0}
              expanded={expanded}
              toggle={toggle}
              openLeaf={openLeaf}
              docsMap={docsMap}
              loadingLeaf={loadingLeaf}
              loadMore={(key, filter, page) => loadDocs(key, filter, page)}
              onDownload={handleDownload}
              onDelete={handleDelete}
              deleteId={deleteId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
