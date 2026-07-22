'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  getDocuments,
  getDocumentTree,
  uploadDocument,
  deleteDocument,
  formatFileSize,
  type Document,
  type DocumentTreeNode,
  type PagedDocuments,
} from '@/lib/documents';
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

interface TreeCategory {
  name: string | null;
  totalCount: number;
  years: TreeYear[];
}

interface TreeYear {
  year: number | null;
  totalCount: number;
  subcategories: TreeSubcategory[];
}

interface TreeSubcategory {
  name: string | null;
  count: number;
}

function buildTree(nodes: DocumentTreeNode[]): TreeCategory[] {
  const catMap = new Map<string, TreeCategory>();

  for (const node of nodes) {
    const catKey = node.category ?? '__none__';
    if (!catMap.has(catKey)) {
      catMap.set(catKey, { name: node.category, totalCount: 0, years: [] });
    }
    const cat = catMap.get(catKey)!;
    cat.totalCount += node.count;

    const yearKey = node.year != null ? String(node.year) : '__none__';
    let yr = cat.years.find((y) => String(y.year ?? '__none__') === yearKey);
    if (!yr) {
      yr = { year: node.year, totalCount: 0, subcategories: [] };
      cat.years.push(yr);
    }
    yr.totalCount += node.count;
    yr.subcategories.push({ name: node.subcategory, count: node.count });
  }

  return Array.from(catMap.values());
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const [tree, setTree] = useState<TreeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Expanded state: Set of keys like "cat:Reisen", "year:Reisen:2026", "sub:Reisen:2026:Australien"
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Loaded documents per leaf key  { docs, total, nextPage }
  const [docsMap, setDocsMap] = useState<Map<string, { docs: Document[]; total: number; nextPage: number }>>(new Map());
  const [loadingLeaf, setLoadingLeaf] = useState<Set<string>>(new Set());

  useEffect(() => { loadTree(); }, []);

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

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  async function loadDocs(leafKey: string, category: string | null, year: number | null, subcategory: string | null, page = 0) {
    if (page === 0 && docsMap.has(leafKey)) return;
    setLoadingLeaf((prev) => new Set(prev).add(leafKey));
    try {
      const result = await getDocuments({
        category: category ?? undefined,
        year: year ?? undefined,
        subcategory: subcategory ?? undefined,
        page,
      });
      setDocsMap((prev) => {
        const existing = prev.get(leafKey);
        const merged = page === 0 ? result.content : [...(existing?.docs ?? []), ...result.content];
        return new Map(prev).set(leafKey, {
          docs: merged,
          total: result.totalElements,
          nextPage: page + 1,
        });
      });
    } catch {
      setError('Dokumente konnten nicht geladen werden.');
    } finally {
      setLoadingLeaf((prev) => { const s = new Set(prev); s.delete(leafKey); return s; });
    }
  }

  function openLeaf(leafKey: string, category: string | null, year: number | null, subcategory: string | null) {
    toggle(leafKey);
    if (!expanded.has(leafKey)) {
      loadDocs(leafKey, category, year, subcategory, 0);
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
          {tree.map((cat) => {
            const catKey = `cat:${cat.name ?? '__none__'}`;
            const catOpen = expanded.has(catKey);
            const color = categoryColor(cat.name);

            return (
              <div key={catKey}>
                {/* Category row */}
                <button
                  onClick={() => toggle(catKey)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50/70 transition-colors text-left"
                >
                  <ChevronIcon open={catOpen} />
                  <FolderIcon color={color} />
                  <span className="flex-1 text-sm font-semibold text-slate-800">
                    {cat.name ?? 'Nicht kategorisiert'}
                  </span>
                  <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                    {cat.totalCount}
                  </span>
                </button>

                {/* Year level */}
                {catOpen && cat.years.map((yr) => {
                  const yearKey = `year:${cat.name ?? '__none__'}:${yr.year ?? '__none__'}`;
                  const yearOpen = expanded.has(yearKey);

                  return (
                    <div key={yearKey}>
                      <button
                        onClick={() => toggle(yearKey)}
                        className="w-full flex items-center gap-3 py-3 hover:bg-slate-50/70 transition-colors text-left"
                        style={{ paddingLeft: '40px', paddingRight: '16px' }}
                      >
                        <ChevronIcon open={yearOpen} />
                        <svg className="w-4 h-4 text-slate-300 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                          <path fillRule="evenodd" d="M5.25 2.25a3 3 0 00-3 3v4.318a3 3 0 00.879 2.121l9.58 9.581c.92.92 2.39 1.186 3.548.428a18.849 18.849 0 005.441-5.44c.758-1.16.492-2.629-.428-3.548l-9.58-9.581a3 3 0 00-2.122-.879H5.25zM6.375 7.5a1.125 1.125 0 100-2.25 1.125 1.125 0 000 2.25z" clipRule="evenodd" />
                        </svg>
                        <span className="flex-1 text-sm font-medium text-slate-700">
                          {yr.year ?? 'Kein Jahr'}
                        </span>
                        <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                          {yr.totalCount}
                        </span>
                      </button>

                      {/* Subcategory / leaf level */}
                      {yearOpen && yr.subcategories.map((sub) => {
                        const leafKey = `sub:${cat.name ?? '__none__'}:${yr.year ?? '__none__'}:${sub.name ?? '__none__'}`;
                        const leafOpen = expanded.has(leafKey);
                        const isLoading = loadingLeaf.has(leafKey);
                        const leafData = docsMap.get(leafKey);
                        const docs = leafData?.docs;
                        const hasMore = leafData != null && leafData.docs.length < leafData.total;

                        // If only one subcategory == null, skip subcategory level and show docs directly
                        const skipSubLevel = sub.name === null;

                        return (
                          <div key={leafKey}>
                            <button
                              onClick={() => openLeaf(leafKey, cat.name, yr.year, sub.name)}
                              className="w-full flex items-center gap-3 py-2.5 hover:bg-slate-50/70 transition-colors text-left"
                              style={{ paddingLeft: skipSubLevel ? '60px' : '60px', paddingRight: '16px' }}
                            >
                              <ChevronIcon open={leafOpen} />
                              {!skipSubLevel ? (
                                <FolderIcon color="slate" />
                              ) : (
                                <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                </svg>
                              )}
                              <span className="flex-1 text-sm text-slate-700">
                                {sub.name ?? 'Allgemein'}
                              </span>
                              <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                                {sub.count}
                              </span>
                            </button>

                            {/* Documents */}
                            {leafOpen && (
                              <div className="bg-slate-50/40">
                                {docs?.map((doc) => (
                                  <DocRow
                                    key={doc.id}
                                    doc={doc}
                                    indent={4}
                                    onDownload={handleDownload}
                                    onDelete={handleDelete}
                                    deleting={deleteId === doc.id}
                                  />
                                ))}
                                {isLoading && (
                                  <div className="flex items-center gap-2 py-3" style={{ paddingLeft: '80px' }}>
                                    <svg className="w-4 h-4 text-amber-400 animate-spin" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                    <span className="text-xs text-slate-400">Laden…</span>
                                  </div>
                                )}
                                {!isLoading && hasMore && leafData && (
                                  <button
                                    onClick={() => loadDocs(leafKey, cat.name, yr.year, sub.name, leafData.nextPage)}
                                    className="w-full text-xs text-slate-400 hover:text-amber-600 py-2.5 transition-colors"
                                    style={{ paddingLeft: '80px', textAlign: 'left' }}
                                  >
                                    + {leafData.total - leafData.docs.length} weitere laden…
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
