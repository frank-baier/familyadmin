'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getTemplates, deleteTemplate } from '@/lib/templates';
import type { TaskTemplate } from '@/lib/templates';
import { useUser } from '@/lib/user-context';

// ─── Template card ─────────────────────────────────────────────────────────

function TemplateCard({ template, onDelete, isAdmin }: { template: TaskTemplate; onDelete: () => void; isAdmin: boolean }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteTemplate(template.id);
      onDelete();
    } catch {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  return (
    <div className="glass-interactive rounded-3xl overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 truncate">{template.name}</h3>
            {template.description && (
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{template.description}</p>
            )}
          </div>
          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs
                           font-medium bg-slate-100 text-slate-600">
            {template.subtasks.length} Unteraufgabe{template.subtasks.length !== 1 ? 'n' : ''}
          </span>
        </div>

        {template.subtasks.length > 0 && (
          <ul className="mt-3 space-y-1">
            {template.subtasks.slice(0, 4).map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-xs text-slate-700">
                <span className="w-3.5 h-3.5 rounded border border-slate-400 shrink-0" aria-hidden="true" />
                <span className="truncate">{s.text}</span>
              </li>
            ))}
            {template.subtasks.length > 4 && (
              <li className="text-xs text-slate-500 pl-5">
                +{template.subtasks.length - 4} weitere
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="hairline mx-4" /><div className="px-5 py-3 flex items-center justify-between gap-2">
        <Link
          href={`/tasks/templates/${template.id}/use`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                     text-white bg-indigo-600 hover:bg-indigo-700
                     focus:outline-none focus:ring-2 focus:ring-indigo-500
                     transition-all duration-150"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Vorlage verwenden
        </Link>

        {isAdmin && (
          <div className="flex items-center gap-1">
            <Link
              href={`/tasks/templates/${template.id}/edit`}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50
                         focus:outline-none focus:ring-2 focus:ring-indigo-500
                         transition-all duration-150"
              title="Vorlage bearbeiten"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
            </Link>

            {showDeleteConfirm ? (
              <div className="flex items-center gap-1.5 ml-1">
                <span className="text-xs text-slate-500">Löschen?</span>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2 py-1 text-xs text-slate-500 border border-slate-200 rounded-lg
                             hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  Nein
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded-lg
                             hover:bg-red-700 disabled:opacity-60
                             focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  {deleting ? '…' : 'Ja'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50
                           focus:outline-none focus:ring-2 focus:ring-red-400
                           transition-all duration-150"
                title="Vorlage löschen"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Table view ───────────────────────────────────────────────────────────────

function TemplateTableRow({ template, onDelete, isAdmin }: { template: TaskTemplate; onDelete: () => void; isAdmin: boolean }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteTemplate(template.id);
      onDelete();
    } catch {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
      <td className="px-4 py-3">
        <Link
          href={`/tasks/templates/${template.id}/use`}
          className="font-medium text-slate-900 hover:text-indigo-600 transition-colors"
        >
          {template.name}
        </Link>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600 max-w-xs">
        {template.description
          ? <span className="line-clamp-1">{template.description}</span>
          : <span className="text-slate-300">—</span>
        }
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
          {template.subtasks.length}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/tasks/templates/${template.id}/use`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold
                       text-white bg-indigo-600 hover:bg-indigo-700
                       focus:outline-none focus:ring-2 focus:ring-indigo-500
                       transition-all duration-150"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Verwenden
          </Link>

          {isAdmin && (
            <>
              <Link
                href={`/tasks/templates/${template.id}/edit`}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100
                           focus:outline-none focus:ring-2 focus:ring-indigo-500
                           transition-all duration-150"
                title="Vorlage bearbeiten"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
              </Link>

              {showDeleteConfirm ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">Löschen?</span>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-2 py-1 text-xs text-slate-500 border border-slate-200 rounded-lg
                               hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    Nein
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded-lg
                               hover:bg-red-700 disabled:opacity-60
                               focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {deleting ? '…' : 'Ja'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50
                             focus:outline-none focus:ring-2 focus:ring-red-400
                             transition-all duration-150"
                  title="Vorlage löschen"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function TemplateTableView({ templates, onDelete, isAdmin }: { templates: TaskTemplate[]; onDelete: () => void; isAdmin: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600">Beschreibung</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Unteraufgaben</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((t) => (
            <TemplateTableRow key={t.id} template={t} onDelete={onDelete} isAdmin={isAdmin} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TemplateSkeleton() {
  return (
    <div className="glass rounded-3xl p-5 animate-pulse space-y-3">
      <div className="h-4 w-2/3 bg-slate-100 rounded" />
      <div className="h-3 w-full bg-slate-50 rounded" />
      <div className="space-y-1.5 mt-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-3 w-4/5 bg-slate-50 rounded" />
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type ViewMode = 'grid' | 'table';

export default function TemplatesPage() {
  const { user } = useUser();
  const isAdmin = user?.role === 'ADMIN';
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  function load() {
    setLoading(true);
    getTemplates()
      .then(setTemplates)
      .catch(() => setError('Vorlagen konnten nicht geladen werden.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/tasks"
              className="text-sm text-slate-500 hover:text-slate-900 transition-colors
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
            >
              Aufgaben
            </Link>
            <svg className="w-3.5 h-3.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            <span className="text-sm text-slate-900 font-medium">Vorlagen</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Aufgaben-Vorlagen</h1>
          <p className="text-slate-500 text-sm mt-1">
            Wiederverwendbare Aufgabenvorlagen — Unteraufgaben auswählen und Aufgabe in Sekunden erstellen.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* View toggle */}
          <div className="glass flex rounded-2xl overflow-hidden" role="group" aria-label="Ansichtsmodus">
            <button
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              className={`px-3 py-2 transition-colors ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
              title="Kachelansicht"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('table')}
              aria-pressed={viewMode === 'table'}
              className={`px-3 py-2 transition-colors ${viewMode === 'table' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
              title="Tabellenansicht"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 10h18M3 14h18M10 3v18M14 3v18M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
              </svg>
            </button>
          </div>

          {isAdmin && (
            <Link href="/tasks/templates/new" className="btn-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Neue Vorlage
            </Link>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-red-700 text-sm mb-6">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <TemplateSkeleton key={i} />)}
        </div>
      )}
      {loading && viewMode === 'table' && (
        <div className="rounded-xl border border-slate-200 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4 px-4 py-3 border-b border-slate-100">
              <div className="h-4 bg-slate-100 rounded w-1/4" />
              <div className="h-4 bg-slate-100 rounded w-1/3" />
              <div className="h-4 bg-slate-100 rounded w-8" />
              <div className="h-4 bg-slate-100 rounded w-20" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && templates.length === 0 && (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Noch keine Vorlagen</h2>
          <p className="text-sm text-slate-500 mb-6">
            {isAdmin ? 'Erstelle deine erste Vorlage, um wiederkehrende Aufgaben zu beschleunigen.' : 'Noch keine Vorlagen verfügbar.'}
          </p>
          {isAdmin && (
            <Link
              href="/tasks/templates/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold
                         bg-indigo-600 text-white hover:bg-indigo-700
                         focus:outline-none focus:ring-2 focus:ring-indigo-500
                         transition-all duration-150"
            >
              Erste Vorlage erstellen
            </Link>
          )}
        </div>
      )}

      {/* Grid */}
      {!loading && templates.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t} onDelete={load} isAdmin={isAdmin} />
          ))}
        </div>
      )}

      {/* Table */}
      {!loading && templates.length > 0 && viewMode === 'table' && (
        <TemplateTableView templates={templates} onDelete={load} isAdmin={isAdmin} />
      )}
    </div>
  );
}
