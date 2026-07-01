'use client';

import { useState, useEffect, useRef } from 'react';
import {
  getDocuments,
  uploadDocument,
  deleteDocument,
  formatFileSize,
  type TripDocument,
} from '@/lib/travel-documents';
import { apiFetchBlob } from '@/lib/api';

// ─── Icons ────────────────────────────────────────────────────────────────────

function FileIcon({ contentType }: { contentType: string }) {
  if (contentType === 'application/pdf') {
    return (
      <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM9.5 15.5c-.3 0-.5-.2-.5-.5V12h-.5a.5.5 0 010-1H9v-.5a2 2 0 014 0V11h.5a.5.5 0 010 1H13v3c0 .3-.2.5-.5.5h-3z" />
      </svg>
    );
  }
  if (contentType.startsWith('image/')) {
    return (
      <svg className="w-5 h-5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 20.25h18A2.25 2.25 0 0023.25 18V6A2.25 2.25 0 0021 3.75H3A2.25 2.25 0 00.75 6v12A2.25 2.25 0 003 20.25z" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface DocumentsListProps {
  tripId: string;
  emailToken: string;
}

export function DocumentsList({ tripId, emailToken }: DocumentsListProps) {
  const [docs, setDocs] = useState<TripDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inboundDomain = process.env.NEXT_PUBLIC_INBOUND_EMAIL_DOMAIN ?? 'familyadmin.local';
  const emailAddress = `trip+${emailToken}@${inboundDomain}`;

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setDocs(await getDocuments(tripId));
    } catch {
      setError('Dokumente konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const doc = await uploadDocument(tripId, file);
      setDocs((prev) => [doc, ...prev]);
    } catch {
      setError('Upload fehlgeschlagen.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(doc: TripDocument) {
    try {
      const { blob, filename } = await apiFetchBlob(doc.downloadUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Download fehlgeschlagen.');
    }
  }

  async function handleDelete(docId: string) {
    setDeletingId(docId);
    try {
      await deleteDocument(tripId, docId);
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch {
      setError('Löschen fehlgeschlagen.');
    } finally {
      setDeletingId(null);
    }
  }

  async function copyEmail() {
    await navigator.clipboard.writeText(emailAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <div className="space-y-4">
      {/* Email ingest banner */}
      <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
        <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-1">
          Dokumente per E-Mail hinzufügen
        </p>
        <p className="text-xs text-orange-600 mb-2">
          Buchungsbestätigung erhalten? Einfach weiterleiten an:
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs font-mono bg-white border border-orange-200 rounded-lg px-3 py-2 text-orange-800 truncate">
            {emailAddress}
          </code>
          <button
            onClick={copyEmail}
            className="shrink-0 px-3 py-2 text-xs font-medium rounded-lg border border-orange-300
                       text-orange-700 hover:bg-orange-100 transition-colors
                       focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            {copied ? 'Kopiert!' : 'Kopieren'}
          </button>
        </div>
      </div>

      {/* Upload button */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-600">
          {docs.length === 0 ? 'Noch keine Dokumente' : `${docs.length} Dokument${docs.length === 1 ? '' : 'e'}`}
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                     text-white bg-orange-500 hover:bg-orange-600
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-orange-400
                     transition-colors"
        >
          {uploading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Lädt…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 4v16m8-8H4" />
              </svg>
              Hochladen
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          onChange={handleUpload}
        />
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 px-6 py-10 text-center">
          <p className="text-sm text-slate-400">Noch keine Dokumente vorhanden.</p>
          <p className="text-xs text-slate-400 mt-1">Lade eine Datei hoch oder leite eine E-Mail weiter.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3"
            >
              <div className="shrink-0">
                <FileIcon contentType={doc.contentType} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{doc.filename}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-400">{formatFileSize(doc.fileSize)}</span>
                  <span className="text-xs text-slate-300">·</span>
                  <span className="text-xs text-slate-400">{formatDate(doc.createdAt)}</span>
                  {doc.source === 'EMAIL' && (
                    <>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-600 border border-orange-200">
                        E-Mail
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1">
                <button
                  onClick={() => handleDownload(doc)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50
                             transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400"
                  title="Herunterladen"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  disabled={deletingId === doc.id}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50
                             transition-colors focus:outline-none focus:ring-2 focus:ring-red-400
                             disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Löschen"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
