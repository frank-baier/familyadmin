'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  askQuestion, getOpenChatSession, closeChatSession, getChatHistory, deleteChatSession,
  formatModelName, formatCostUsd, formatDuration,
  type ChatHistoryEntry, type ChatSession,
} from '@/lib/documents';

const POLL_INTERVAL_MS = 2000;
const RETENTION_MONTHS = 3;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('de-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich',
  });
}

function Spinner({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

// ─── Source badge ─────────────────────────────────────────────────────────────

function SourceBadge({ filename }: { filename: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-100 text-amber-700 text-xs font-medium">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
      {filename}
    </span>
  );
}

// ─── One question + answer in a thread ────────────────────────────────────────

function ThreadEntry({ entry }: { entry: ChatHistoryEntry }) {
  const isPending = entry.status === 'PENDING';
  const isError = entry.status === 'ERROR';

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm text-amber-950 bg-amber-100/80 whitespace-pre-wrap">
          {entry.question}
        </div>
      </div>

      <div className="max-w-[92%]">
        {isPending && !entry.answer ? (
          <div className="glass rounded-2xl rounded-bl-md px-3.5 py-3 text-xs text-amber-600 flex items-center gap-2">
            <Spinner className="w-3 h-3" /> KI denkt nach…
          </div>
        ) : (
          <div className={`rounded-2xl rounded-bl-md px-3.5 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
            isError ? 'bg-red-50 text-red-700' : 'glass text-slate-800'
          }`}>
            {entry.answer}
            {isPending && (
              <span className="inline-block w-1.5 h-3.5 ml-0.5 align-middle bg-amber-400 animate-pulse rounded-sm" />
            )}
          </div>
        )}

        {!isPending && entry.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {entry.sources.map((s) => <SourceBadge key={s} filename={s} />)}
          </div>
        )}
        {!isPending && !isError && entry.model && (
          <p className="mt-1.5 text-[11px] text-slate-400">
            {[
              formatModelName(entry.model),
              entry.costUsd != null ? formatCostUsd(entry.costUsd) : null,
              entry.durationMs != null ? formatDuration(entry.durationMs) : null,
            ].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── History: one closed session ──────────────────────────────────────────────

function SessionCard({
  session, onDelete, deleting,
}: {
  session: ChatSession; onDelete: () => void; deleting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const first = session.entries[0];
  const count = session.entries.length;
  const totalCost = session.entries.reduce((sum, e) => sum + (e.costUsd ?? 0), 0);
  const hasCost = session.entries.some((e) => e.costUsd != null);

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex-1 min-w-0 flex items-start gap-3 text-left"
        >
          <svg className={`w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 line-clamp-2">{first?.question ?? 'Leere Session'}</p>
            <p className="text-xs mt-0.5 text-slate-400">
              {[
                formatDate(session.createdAt),
                count === 1 ? '1 Frage' : `${count} Fragen`,
                hasCost ? formatCostUsd(totalCost) : null,
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors shrink-0 disabled:opacity-40"
          title="Session löschen"
        >
          {deleting ? <Spinner /> : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          )}
        </button>
      </div>

      {open && (
        <div className="px-4 pb-4 pt-3 border-t border-slate-100 space-y-4">
          {session.entries.map((e) => <ThreadEntry key={e.id} entry={e} />)}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AskPage() {
  const [tab, setTab] = useState<'session' | 'history'>('session');
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [session, setSession] = useState<ChatSession | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  const [history, setHistory] = useState<ChatSession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const entries = session?.entries ?? [];
  const hasPending = entries.some((e) => e.status === 'PENDING');

  const loadSession = useCallback(async () => {
    try {
      setSession(await getOpenChatSession());
    } catch {
      setError('Session konnte nicht geladen werden.');
    } finally {
      setSessionLoaded(true);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      setHistory(await getChatHistory());
    } catch {
      setError('Verlauf konnte nicht geladen werden.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { loadSession(); }, [loadSession]);

  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab, loadHistory]);

  // Poll the open session while an answer is being written.
  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(loadSession, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [hasPending, loadSession]);

  // Keep the newest question/answer in view.
  const lastAnswerLength = entries.at(-1)?.answer.length ?? 0;
  useEffect(() => {
    if (tab === 'session') threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [entries.length, lastAnswerLength, tab]);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const question = input.trim();
    if (!question || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const pending = await askQuestion(question);
      setInput('');
      setSession((prev) => ({
        id: prev?.id ?? '',
        createdAt: prev?.createdAt ?? pending.createdAt,
        closedAt: null,
        entries: [...(prev?.entries ?? []), { ...pending, sources: [] }],
      }));
      loadSession();
    } catch {
      setError('Anfrage konnte nicht gesendet werden.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNewSession() {
    setClosing(true);
    setError(null);
    try {
      await closeChatSession();
      setSession(null);
      setInput('');
      inputRef.current?.focus();
    } catch {
      setError('Neue Session konnte nicht gestartet werden.');
    } finally {
      setClosing(false);
    }
  }

  async function handleDeleteSession(id: string) {
    setDeletingId(id);
    try {
      await deleteChatSession(id);
      setHistory((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setError('Löschen fehlgeschlagen.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: 'calc(100dvh - 7rem)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <Link
          href="/documents"
          className="w-9 h-9 rounded-xl glass flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">KI Fragen</h1>
          <p className="text-xs text-slate-400">Fragen und Rückfragen zu deinen Dokumenten</p>
        </div>
        {tab === 'session' && entries.length > 0 && (
          <button
            onClick={handleNewSession}
            disabled={closing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass text-slate-600 hover:text-slate-900 text-xs font-medium disabled:opacity-50"
            title="Aktuelle Session in den Verlauf verschieben und neu beginnen"
          >
            {closing ? <Spinner className="w-3 h-3" /> : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            )}
            Neue Session
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 glass rounded-xl p-1 mb-4 shrink-0">
        <button
          onClick={() => setTab('session')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
            tab === 'session' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Aktuelle Session
          {hasPending && tab !== 'session' && (
            <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse align-middle" />
          )}
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
            tab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Verlauf
          {history.length > 0 && (
            <span className="ml-1.5 text-xs rounded-full px-1.5 py-0.5 bg-slate-100 text-slate-500">
              {history.length}
            </span>
          )}
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4 shrink-0 flex justify-between items-center">
          {error}
          <button onClick={() => setError(null)} className="ml-4 text-xs underline">Schließen</button>
        </div>
      )}

      {/* Session tab */}
      {tab === 'session' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto pr-1 pb-4">
            {!sessionLoaded ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <div key={i} className="glass rounded-2xl h-16 animate-pulse" />)}
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
                <span className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                      d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </span>
                <div>
                  <p className="font-semibold text-slate-700 text-sm">Frage deine Dokumente</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Du kannst Rückfragen stellen. Die Session bleibt hier, bis du eine neue beginnst –
                    du kannst die Seite verlassen, während die KI antwortet.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 w-full max-w-sm mt-2">
                  {[
                    'Wann war die letzte Reparatur unseres Autos?',
                    'Wie hoch war mein Gehalt letztes Jahr?',
                    'Welche Versicherungen haben wir?',
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); inputRef.current?.focus(); }}
                      className="glass rounded-xl px-4 py-2.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-white/80 transition-colors text-left"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {entries.map((e) => <ThreadEntry key={e.id} entry={e} />)}
                <div ref={threadEndRef} />
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="shrink-0 pt-3 border-t border-slate-100">
            <div className="glass rounded-2xl flex items-end gap-2 p-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                placeholder={entries.length > 0 ? 'Rückfrage stellen…' : 'Frage stellen…'}
                rows={1}
                disabled={submitting}
                className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-800 placeholder-slate-400 outline-none max-h-32 leading-relaxed"
                style={{ fieldSizing: 'content' } as React.CSSProperties}
              />
              <button
                type="submit"
                disabled={!input.trim() || submitting}
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
              >
                {submitting ? <Spinner className="w-4 h-4 text-white" /> : (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                      d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-1.5">
              Enter zum Senden · Shift+Enter für neue Zeile
            </p>
          </form>
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-4">
          {historyLoading && history.length === 0 ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="glass rounded-2xl h-16 animate-pulse" />)}
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16 gap-3">
              <span className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <p className="text-sm text-slate-500">Noch keine abgeschlossenen Sessions</p>
            </div>
          ) : (
            history.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                onDelete={() => handleDeleteSession(s.id)}
                deleting={deletingId === s.id}
              />
            ))
          )}
          <p className="text-[11px] text-slate-400 text-center pt-2">
            Fragen älter als {RETENTION_MONTHS} Monate werden automatisch gelöscht.
          </p>
        </div>
      )}
    </div>
  );
}
