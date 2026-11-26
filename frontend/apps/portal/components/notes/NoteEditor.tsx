'use client';

import { useEffect, useRef, useState } from 'react';
import type { NoteNode } from '@/lib/notes';

interface NoteEditorProps {
  node: NoteNode | null;
  onSave: (id: string, name: string, content: string) => Promise<void>;
  autoFocusName?: boolean;
  onAutoFocused?: () => void;
}

export function NoteEditor({ node, onSave, autoFocusName, onAutoFocused }: NoteEditorProps) {
  const [name, setName] = useState(node?.name ?? '');
  const [content, setContent] = useState(node?.content ?? '');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(node?.name ?? '');
    setContent(node?.content ?? '');
    setDirty(false);

    if (autoFocusName && node) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
      onAutoFocused?.();
    }
  }, [node?.id]);

  if (!node) {
    return (
      <div className="glass rounded-3xl h-full flex flex-col items-center justify-center py-24 text-center">
        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-700 mb-1">Keine Notiz ausgewählt</p>
        <p className="text-xs text-slate-500">Wähle eine Notiz aus dem Baum oder lege eine neue an.</p>
      </div>
    );
  }

  async function handleSave() {
    if (!node || !dirty) return;
    setSaving(true);
    try {
      await onSave(node.id, name.trim() || 'Unbenannt', content);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass rounded-3xl h-full flex flex-col p-6">
      <input
        ref={nameInputRef}
        value={name}
        onChange={(e) => { setName(e.target.value); setDirty(true); }}
        onBlur={handleSave}
        className="text-xl font-bold text-slate-900 bg-transparent border-none outline-none focus:ring-0 mb-4 px-0"
        placeholder="Name"
      />
      <textarea
        value={content}
        onChange={(e) => { setContent(e.target.value); setDirty(true); }}
        onBlur={handleSave}
        placeholder="Notiz…"
        className="input-field flex-1 resize-none min-h-[300px]"
      />
      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-slate-400">
          Zuletzt geändert: {new Date(node.updatedAt).toLocaleString('de-DE')}
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="btn-primary text-xs"
          style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
        >
          {saving ? 'Wird gespeichert…' : 'Speichern'}
        </button>
      </div>
    </div>
  );
}
