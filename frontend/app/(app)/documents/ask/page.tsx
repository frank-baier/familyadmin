'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { askQuestion, type ChatResponse } from '@/lib/documents';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AskPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    const userMsg: Message = { id: nextId.current++, role: 'user', content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const result: ChatResponse = await askQuestion(question);
      const assistantMsg: Message = {
        id: nextId.current++,
        role: 'assistant',
        content: result.answer,
        sources: result.sources,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setError('Anfrage fehlgeschlagen. Ist der KI-Dienst gestartet?');
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: 'calc(100dvh - 7rem)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <Link
          href="/documents"
          className="w-9 h-9 rounded-xl glass flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">KI Fragen</h1>
          <p className="text-xs text-slate-400">Fragen zu deinen Dokumenten stellen</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4 shrink-0">
          {error}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4">
        {messages.length === 0 && !loading && (
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
                Beispiel: «Wann war die letzte Reparatur unseres Audis?» oder «Wie viel habe ich 2023 verdient?»
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
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={['flex', msg.role === 'user' ? 'justify-end' : 'justify-start'].join(' ')}>
            <div className={[
              'max-w-[85%] rounded-2xl px-4 py-3 text-sm',
              msg.role === 'user'
                ? 'text-white rounded-br-sm'
                : 'glass text-slate-800 rounded-bl-sm',
            ].join(' ')}
              style={msg.role === 'user' ? {
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              } : undefined}
            >
              <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {msg.sources.map((src) => (
                    <SourceBadge key={src} filename={src} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="glass rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <span className="text-xs text-slate-400">KI denkt nach…</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="shrink-0 pt-3 border-t border-slate-100">
        <div className="glass rounded-2xl flex items-end gap-2 p-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Frage stellen… (Enter zum Senden)"
            rows={1}
            disabled={loading}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-800 placeholder-slate-400 outline-none max-h-32 leading-relaxed"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-slate-400 text-center mt-1.5">
          Shift+Enter für neue Zeile · Alle Daten bleiben lokal auf dem Server
        </p>
      </form>
    </div>
  );
}
