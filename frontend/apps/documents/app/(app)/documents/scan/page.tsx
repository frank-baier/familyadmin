'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, openBlobInNewTab } from '@familyadmin/shared/api';
import { useUser } from '@familyadmin/shared/user-context';
import { formatCostUsd, formatModelName } from '@/lib/documents';
import {
  approveScan, getScanFolders, getScanItems, getScanStatus, pollMail, reanalyzeScan, rejectScan, undoScan,
  type ScanInboxStatusInfo, type ScanItem,
} from '@/lib/scan-inbox';

const TAX_PREFIX = 'Behörden/Finanzamt/Steuerunterlagen';

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('de-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich',
  });
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

function FolderPath({ path }: { path: string }) {
  return <span className="font-medium break-words">{path.split('/').join(' › ')}</span>;
}

const INPUT_LABEL: Record<string, string> = {
  PDF_TEXT: 'vorhandener OCR-Text genutzt',
  DOCUMENT: 'Scan von der KI gelesen',
  IMAGE: 'Bild von der KI gelesen',
  NONE: 'nur nach Dateiname',
};

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300';
const btnGhost = 'px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50';
const btnOutline = 'px-3 py-1.5 rounded-lg text-sm text-amber-700 border border-amber-200 hover:bg-amber-50 disabled:opacity-50';
const btnPrimary = 'px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50';

// ─── One file ────────────────────────────────────────────────────────────────

function ScanCard({ item, onChanged, onError }: {
  item: ScanItem;
  onChanged: (message?: string) => void;
  onError: (message: string) => void;
}) {
  const [mode, setMode] = useState<'view' | 'edit' | 'hint'>('view');
  const [folder, setFolder] = useState(item.suggestedFolder ?? '');
  const [filename, setFilename] = useState(item.suggestedFilename ?? item.sourceName);
  const [hint, setHint] = useState(item.userHint ?? '');
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, message?: string) {
    setBusy(true);
    try {
      await action();
      setMode('view');
      onChanged(message);
    } catch (err) {
      onError(err instanceof ApiError && err.status === 409
        ? 'Status hat sich inzwischen geändert – bitte neu laden.' : 'Aktion fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  const preview = () => item.previewUrl
    && openBlobInNewTab(item.previewUrl).catch(() => onError('Öffnen fehlgeschlagen.'));
  const ext = item.sourceName.split('.').pop()?.slice(0, 4) ?? 'DOC';
  const tax = item.taxRelevant || item.suggestedFolder?.startsWith(TAX_PREFIX);
  const mail = item.source === 'MAIL';

  return (
    <li className={`glass rounded-2xl p-4 ${busy ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <button type="button" onClick={preview}
          className="shrink-0 w-10 h-12 rounded-lg bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-bold uppercase flex items-center justify-center hover:bg-amber-100"
          title={mail ? 'Anhang ansehen' : 'Scan ansehen'}>
          {ext}
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={preview}
            className="block max-w-full truncate text-left text-sm font-semibold text-slate-900 hover:underline">
            {item.sourceName}
          </button>
          <p className="text-xs text-slate-500">
            {formatDate(mail ? item.mailDate : item.createdAt)} · {formatSize(item.fileSize)}
          </p>
          {mail && (
            <p className="text-xs text-slate-600 truncate">
              {item.mailFrom ?? 'Unbekannt'}{item.mailSubject && ` · ${item.mailSubject}`}
            </p>
          )}
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${mail
          ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
          {mail ? 'E-Mail' : 'Scan'}
        </span>
        {tax && item.status !== 'ANALYZING' && (
          <span className="shrink-0 rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 text-[11px] font-medium text-sky-700">
            Steuer
          </span>
        )}
      </div>

      {item.status === 'ANALYZING' ? (
        <p className="mt-3 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-500 animate-pulse">
          KI analysiert das Dokument…
        </p>
      ) : (
        <div className="mt-3 rounded-xl px-3 py-2.5 text-sm bg-amber-50/70 border border-amber-100 space-y-1">
          {item.suggestedFolder ? (
            <>
              <p className="text-slate-800"><span className="text-slate-500">Ordner: </span><FolderPath path={item.suggestedFolder} /></p>
              <p className="text-slate-800 break-all"><span className="text-slate-500">Name: </span><span className="font-medium">{item.suggestedFilename}</span></p>
            </>
          ) : (
            <p className="text-slate-500">Kein Vorschlag – bitte Ordner und Namen selbst wählen.</p>
          )}
          {item.suggestionReason && <p className="text-xs text-slate-600">{item.suggestionReason}</p>}
          {item.worthKeeping === false && (
            <p className="text-xs font-medium text-slate-700">KI meint: wohl nicht aufbewahrenswert{mail ? ' – eher verwerfen.' : '.'}</p>
          )}
          {item.analysisError && <p className="text-xs text-red-600">{item.analysisError}</p>}
          {item.suggestionModel && (
            <p className="text-[11px] text-slate-400">
              {formatModelName(item.suggestionModel)}
              {item.analysisInput && ` · ${INPUT_LABEL[item.analysisInput] ?? item.analysisInput}`}
              {item.suggestionCostUsd != null && ` · ${formatCostUsd(item.suggestionCostUsd)}`}
              {item.userHint && ` · Hinweis: „${item.userHint}“`}
            </p>
          )}
        </div>
      )}

      {item.moveError && (
        <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
          {mail ? 'Ablegen' : 'Verschieben'} auf dem Mac fehlgeschlagen: {item.moveError}
        </p>
      )}

      {item.status === 'PENDING' && mode === 'edit' && (
        <form className="mt-3 grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => approveScan(item.id, folder.trim(), filename.trim()), `„${filename.trim()}“ freigegeben`);
          }}>
          <label className="text-xs text-slate-500">Ordner (unter „Dokumente“)
            <input className={inputCls} list="scan-folders" value={folder} required
              placeholder="z. B. Auto/2026" onChange={(e) => setFolder(e.target.value)} />
          </label>
          <label className="text-xs text-slate-500">Dateiname
            <input className={inputCls} value={filename} required onChange={(e) => setFilename(e.target.value)} />
          </label>
          <p className="text-[11px] text-slate-400">Neue Unterordner werden beim Verschieben angelegt. Die Dateiendung bleibt immer erhalten.</p>
          <div className="flex justify-end gap-2">
            <button type="button" className={btnGhost} onClick={() => setMode('view')}>Abbrechen</button>
            <button type="submit" className={btnPrimary} disabled={busy || !folder.trim() || !filename.trim()}>
              So ablegen
            </button>
          </div>
        </form>
      )}

      {item.status === 'PENDING' && mode === 'hint' && (
        <form className="mt-3 grid gap-2"
          onSubmit={(e) => { e.preventDefault(); run(() => reanalyzeScan(item.id, hint), 'Neue Analyse läuft…'); }}>
          <label className="text-xs text-slate-500">Hinweis für die KI
            <input className={inputCls} value={hint} autoFocus
              placeholder="z. B. Steuer 2025, betrifft Jule, gehört zum Haus Vogteistrasse"
              onChange={(e) => setHint(e.target.value)} />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className={btnGhost} onClick={() => setMode('view')}>Abbrechen</button>
            <button type="submit" className={btnPrimary} disabled={busy}>Neu analysieren</button>
          </div>
        </form>
      )}

      {item.status === 'PENDING' && mode === 'view' && (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button type="button" className={btnGhost} disabled={busy}
            onClick={() => run(() => rejectScan(item.id),
              mail ? `„${item.sourceName}“ verworfen` : `„${item.sourceName}“ bleibt in _Wohin?`)}>
            {mail ? 'Verwerfen' : 'Liegen lassen'}
          </button>
          <button type="button" className={btnGhost} disabled={busy} onClick={() => setMode('hint')}>
            Neu analysieren
          </button>
          <button type="button" className={btnOutline} disabled={busy} onClick={() => setMode('edit')}>
            Korrigieren
          </button>
          {item.suggestedFolder && (
            <button type="button" className={btnPrimary} disabled={busy}
              onClick={() => run(() => approveScan(item.id), `„${item.suggestedFilename}“ freigegeben`)}>
              Ablegen
            </button>
          )}
        </div>
      )}
    </li>
  );
}

// ─── Compact rows for approved / done / left alone ───────────────────────────

function SmallRow({ item, onChanged, onError }: {
  item: ScanItem;
  onChanged: (message?: string) => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const path = item.status === 'DONE' ? item.finalPath
    : item.status === 'APPROVED' ? `${item.targetFolder}/${item.targetFilename}` : null;

  async function undo() {
    setBusy(true);
    try {
      await undoScan(item.id);
      onChanged();
    } catch {
      onError('Zurücknehmen nicht möglich – evtl. hat der Mac die Datei schon verschoben.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center gap-3 px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate text-slate-800">{item.sourceName}</p>
        {path && <p className="truncate text-xs text-slate-500">→ {path.split('/').join(' › ')}</p>}
        {item.status === 'DONE' && <p className="text-[11px] text-slate-400">{formatDate(item.movedAt)}</p>}
      </div>
      {item.status !== 'DONE' && (
        <button type="button" onClick={undo} disabled={busy} className="shrink-0 text-xs text-amber-700 underline disabled:opacity-50">
          {item.status === 'APPROVED' ? 'Zurücknehmen' : 'Doch vorschlagen'}
        </button>
      )}
    </li>
  );
}

function Section({ title, hint, items, onChanged, onError }: {
  title: string; hint?: string; items: ScanItem[];
  onChanged: (m?: string) => void; onError: (m: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold text-slate-700">{title} <span className="text-slate-400">({items.length})</span></h2>
      {hint && <p className="text-xs text-slate-500 mb-1">{hint}</p>}
      <ul className="glass rounded-2xl divide-y divide-slate-100 mt-2">
        {items.map((i) => <SmallRow key={i.id} item={i} onChanged={onChanged} onError={onError} />)}
      </ul>
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ScanInboxPage() {
  const { user } = useUser();
  const [polling, setPolling] = useState(false);
  const [items, setItems] = useState<ScanItem[] | null>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const [status, setStatus] = useState<ScanInboxStatusInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, s] = await Promise.all([getScanItems(), getScanStatus()]);
      setItems(list);
      setStatus(s);
    } catch {
      setError('Eingang konnte nicht geladen werden.');
      setItems((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    getScanFolders().then(setFolders).catch(() => {});
    return () => clearTimeout(t);
  }, [load]);

  // Refresh while the AI is still working on something.
  const analyzing = items?.some((i) => i.status === 'ANALYZING') ?? false;
  useEffect(() => {
    if (!analyzing) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [analyzing, load]);

  async function handlePollMail() {
    setPolling(true);
    try {
      const { created } = await pollMail();
      setNotice(created < 0 ? 'Abruf läuft bereits.'
        : created === 0 ? 'Keine neuen E-Mail-Anhänge.' : `${created} neue E-Mail-Anhänge – KI analysiert…`);
      load();
    } catch {
      setError('Postfach konnte nicht abgerufen werden.');
    } finally {
      setPolling(false);
    }
  }

  function changed(message?: string) {
    if (message) setNotice(message);
    load();
  }

  const open = items?.filter((i) => i.status === 'PENDING' || i.status === 'ANALYZING') ?? [];
  const approved = items?.filter((i) => i.status === 'APPROVED') ?? [];
  const rejected = items?.filter((i) => i.status === 'REJECTED') ?? [];
  const done = items?.filter((i) => i.status === 'DONE') ?? [];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex-1">
          <Link href="/documents" className="text-xs text-slate-500 hover:underline">‹ Dokumente</Link>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Eingang</h1>
          <p className="text-sm text-slate-500">
            Scans aus iCloud „Dokumente/_Wohin?“{status?.mailConfigured && ' und Anhänge aus deinen E-Mails'} mit
            Vorschlag für Ordner und Namen. Erst nach „Ablegen“ legt dein Mac die Datei in iCloud ab.
          </p>
        </div>
        {user?.role === 'ADMIN' && status?.mailConfigured && (
          <button type="button" onClick={handlePollMail} disabled={polling} className={`${btnOutline} shrink-0 mt-5`}>
            {polling ? 'Rufe ab…' : 'E-Mails abrufen'}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 flex justify-between">
          {error}
          <button onClick={() => setError(null)} className="ml-4 text-xs underline">Schließen</button>
        </div>
      )}
      {notice && (
        <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 flex justify-between">
          {notice}
          <button onClick={() => setNotice(null)} className="ml-4 text-xs underline">OK</button>
        </div>
      )}

      {status && !status.aiConfigured && (
        <div className="glass rounded-2xl p-4 text-sm text-slate-600 mb-3">
          Kein Anthropic-API-Key auf dem Server – Vorschläge sind nicht möglich (<code>ANTHROPIC_API_KEY</code>).
        </div>
      )}
      {status && !status.catalogUpdatedAt && (
        <div className="glass rounded-2xl p-4 text-sm text-slate-600 mb-3">
          Der Mac hat noch keinen Ordnerbaum übertragen. Läuft <code>~/familyadmin-sync/inbox.py</code>?
        </div>
      )}

      <datalist id="scan-folders">{folders.map((f) => <option key={f} value={f} />)}</datalist>

      {items === null ? (
        <p className="text-sm text-slate-500">Lade…</p>
      ) : open.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-center text-sm text-slate-500">
          Nichts zu tun. Scanne auf dem iPhone in der Dateien-App direkt nach „Dokumente/_Wohin?“.
        </div>
      ) : (
        <ul className="space-y-3">
          {open.map((item) => (
            <ScanCard key={`${item.id}-${item.status}-${item.suggestedFilename}`} item={item}
              onChanged={changed} onError={setError} />
          ))}
        </ul>
      )}

      <Section title="Freigegeben – wartet auf den Mac" items={approved}
        hint="Der Mac legt die Dateien beim nächsten Lauf ab (alle paar Minuten, wenn er wach ist)."
        onChanged={changed} onError={setError} />
      <Section title="Liegen gelassen" items={rejected} onChanged={changed} onError={setError} />
      <Section title="Zuletzt abgelegt" items={done} onChanged={changed} onError={setError} />
    </div>
  );
}
