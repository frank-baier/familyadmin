'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, openBlobInNewTab } from '@familyadmin/shared/api';
import { formatCostUsd } from '@/lib/documents';
import {
  addTaxItem, copyHint, deleteTaxItem, dismissHint, getTaxOverview, importPriorReturn, refreshChecklist,
  scanHints, setTaxItemStatus, undoHint,
  type JobInfo, type TaxHint, type TaxItem, type TaxOverview, type UserStatus,
} from '@/lib/tax';

const btnGhost = 'px-2.5 py-1 rounded-lg text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50';
const btnOutline = 'px-3 py-1.5 rounded-lg text-sm text-sky-700 border border-sky-200 bg-white hover:bg-sky-50 disabled:opacity-50';
const btnPrimary = 'px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50';
const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-300';

const SOURCE_LABEL: Record<TaxItem['source'], string> = {
  PRIOR_YEAR: 'wie Vorjahr',
  RETURN: 'aus Steuererklärung',
  BASELINE: 'Grenzgänger-Tipp',
  MANUAL: 'eigener Eintrag',
};

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Berlin',
  });
}

function fileName(path: string) {
  return path.split('/').pop() ?? path;
}

/** "Behörden/Finanzamt/Steuerunterlagen 2025/02 …" → "02 …" */
function shortFolder(path: string | null, year: number) {
  if (!path) return '';
  const prefix = `Behörden/Finanzamt/Steuerunterlagen ${year}`;
  return path === prefix ? `Steuerunterlagen ${year}` : path.startsWith(prefix + '/') ? path.slice(prefix.length + 1) : path;
}

type ItemState = 'done' | 'skip' | 'found' | 'partial' | 'missing' | 'unknown';

function itemState(i: TaxItem): ItemState {
  if (i.userStatus === 'DONE') return 'done';
  if (i.userStatus === 'NOT_NEEDED') return 'skip';
  return ({ FOUND: 'found', PARTIAL: 'partial', MISSING: 'missing', UNKNOWN: 'unknown' } as const)[i.aiStatus];
}

const STATE_ICON: Record<ItemState, { icon: string; cls: string; label: string }> = {
  found: { icon: '✓', cls: 'bg-emerald-100 text-emerald-700', label: 'liegt im Ordner' },
  done: { icon: '✓', cls: 'bg-emerald-600 text-white', label: 'von dir erledigt' },
  partial: { icon: '◐', cls: 'bg-amber-100 text-amber-700', label: 'teilweise da' },
  missing: { icon: '!', cls: 'bg-red-100 text-red-700', label: 'fehlt noch' },
  unknown: { icon: '?', cls: 'bg-slate-100 text-slate-500', label: 'noch nicht abgeglichen' },
  skip: { icon: '–', cls: 'bg-slate-100 text-slate-400', label: 'entfällt' },
};

const ORDER: Record<ItemState, number> = { missing: 0, partial: 1, unknown: 2, found: 3, done: 4, skip: 5 };

function JobLine({ job, running, label }: { job: JobInfo; running: string; label: string }) {
  if (job.status === 'RUNNING') {
    return <p className="text-xs text-sky-700 animate-pulse">{running}</p>;
  }
  if (job.status === 'ERROR') {
    return <p className="text-xs text-red-600 break-words">{job.error}</p>;
  }
  if (!job.finishedAt) return null;
  return (
    <p className="text-[11px] text-slate-400">
      {label} {formatDate(job.finishedAt)}{job.costUsd != null && ` · ${formatCostUsd(job.costUsd)}`}
    </p>
  );
}

// ─── Checklist ───────────────────────────────────────────────────────────────

function ItemRow({ item, onChanged, onError }: {
  item: TaxItem; onChanged: () => void; onError: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [showPrior, setShowPrior] = useState(false);
  const state = itemState(item);
  const icon = STATE_ICON[state];
  const closed = state === 'done' || state === 'skip';

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      onChanged();
    } catch {
      onError('Aktion fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }
  const set = (s: UserStatus | null) => run(() => setTaxItemStatus(item.id, s));

  return (
    <li className={`flex gap-3 px-3 py-2.5 ${busy ? 'opacity-60' : ''}`}>
      <span title={icon.label}
        className={`mt-0.5 shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${icon.cls}`}>
        {icon.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${closed ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-900 font-medium'}`}>
          {item.title}
          {item.person && (
            <span className="ml-1.5 align-middle rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 no-underline">
              {item.person}
            </span>
          )}
        </p>
        {item.note && !closed && <p className="text-xs text-slate-500">{item.note}</p>}
        {item.matchedFiles.length > 0 && (
          <p className="text-xs text-emerald-700 break-words">
            {item.matchedFiles.map(fileName).join(' · ')}
          </p>
        )}
        <p className="text-[11px] text-slate-400">
          {SOURCE_LABEL[item.source]} · {icon.label}
          {item.priorFiles.length > 0 && (
            <>
              {' · '}
              <button type="button" className="underline" onClick={() => setShowPrior((v) => !v)}>
                Vorjahr ({item.priorFiles.length})
              </button>
            </>
          )}
        </p>
        {showPrior && (
          <ul className="mt-1 text-[11px] text-slate-500 list-disc pl-4 break-words">
            {item.priorFiles.map((f) => <li key={f}>{f}</li>)}
          </ul>
        )}
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1">
        {closed ? (
          <button type="button" className={btnGhost} disabled={busy} onClick={() => set(null)}>Wieder offen</button>
        ) : (
          <>
            <button type="button" className={btnGhost} disabled={busy} onClick={() => set('DONE')}>Erledigt</button>
            <button type="button" className={btnGhost} disabled={busy} onClick={() => set('NOT_NEEDED')}>Entfällt</button>
          </>
        )}
        {item.source === 'MANUAL' && (
          <button type="button" className={`${btnGhost} text-red-600`} disabled={busy}
            onClick={() => run(() => deleteTaxItem(item.id))}>
            Löschen
          </button>
        )}
      </div>
    </li>
  );
}

function AddItemForm({ year, rubrics, onDone, onError }: {
  year: number; rubrics: string[]; onDone: () => void; onError: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rubric, setRubric] = useState(rubrics[0] ?? '');
  const [title, setTitle] = useState('');
  const [person, setPerson] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button type="button" className="text-xs text-sky-700 underline" onClick={() => setOpen(true)}>
        + Eigenen Eintrag hinzufügen
      </button>
    );
  }
  return (
    <form className="grid gap-2 sm:grid-cols-[1fr_2fr_1fr_auto] items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await addTaxItem(year, { rubric, title: title.trim(), person: person.trim() || undefined });
          setTitle('');
          setPerson('');
          setOpen(false);
          onDone();
        } catch {
          onError('Eintrag konnte nicht angelegt werden.');
        } finally {
          setBusy(false);
        }
      }}>
      <label className="text-xs text-slate-500">Rubrik
        <select className={inputCls} value={rubric} onChange={(e) => setRubric(e.target.value)}>
          {rubrics.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <label className="text-xs text-slate-500">Was?
        <input className={inputCls} value={title} required placeholder="z. B. Kita-Rechnungen Jule"
          onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="text-xs text-slate-500">Person
        <input className={inputCls} value={person} placeholder="optional" onChange={(e) => setPerson(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <button type="button" className={btnGhost} onClick={() => setOpen(false)}>Abbrechen</button>
        <button type="submit" className={btnPrimary} disabled={busy || !title.trim()}>Hinzufügen</button>
      </div>
    </form>
  );
}

// ─── Hints ───────────────────────────────────────────────────────────────────

function HintCard({ hint, year, onChanged, onError }: {
  hint: TaxHint; year: number; onChanged: (m?: string) => void; onError: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, message?: string) {
    setBusy(true);
    try {
      await action();
      onChanged(message);
    } catch (err) {
      onError(err instanceof ApiError && err.status === 409
        ? 'Status hat sich inzwischen geändert – bitte neu laden.' : 'Aktion fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }
  const open = () => openBlobInNewTab(`/api/documents/${hint.documentId}/download`)
    .catch(() => onError('Öffnen fehlgeschlagen.'));

  if (hint.status !== 'PENDING') {
    const text = hint.status === 'COPIED' ? `→ ${shortFolder(hint.finalPath, year)}`
      : hint.status === 'COPY_REQUESTED' ? `wird kopiert nach ${shortFolder(hint.targetFolder, year)}`
        : 'nicht relevant';
    return (
      <li className="flex items-center gap-3 px-3 py-2 text-sm">
        <div className="min-w-0 flex-1">
          <button type="button" onClick={open} className="block max-w-full truncate text-left text-slate-800 hover:underline">
            {hint.filename}
          </button>
          <p className="truncate text-xs text-slate-500">{text}</p>
        </div>
        {hint.status !== 'COPIED' && (
          <button type="button" disabled={busy} className="shrink-0 text-xs text-sky-700 underline disabled:opacity-50"
            onClick={() => run(() => undoHint(hint.id))}>
            Zurücknehmen
          </button>
        )}
      </li>
    );
  }

  return (
    <li className={`glass rounded-2xl p-4 ${busy ? 'opacity-60' : ''}`}>
      <button type="button" onClick={open} className="block max-w-full truncate text-left text-sm font-semibold text-slate-900 hover:underline">
        {hint.filename}
      </button>
      {hint.documentPath && <p className="text-xs text-slate-500">liegt in {hint.documentPath}</p>}
      <div className="mt-2 rounded-xl bg-sky-50/70 border border-sky-100 px-3 py-2 text-sm space-y-0.5">
        {hint.rubric && <p className="text-slate-800"><span className="text-slate-500">Rubrik: </span><span className="font-medium">{hint.rubric}</span></p>}
        {hint.reason && <p className="text-xs text-slate-600">{hint.reason}</p>}
      </div>
      {hint.copyError && (
        <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">Kopieren auf dem Mac fehlgeschlagen: {hint.copyError}</p>
      )}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" className={btnGhost} disabled={busy}
          onClick={() => run(() => dismissHint(hint.id))}>
          Nicht relevant
        </button>
        <button type="button" className={btnPrimary} disabled={busy}
          onClick={() => run(() => copyHint(hint.id), `„${hint.filename}“ wird in den Steuerordner kopiert`)}>
          In Steuerordner kopieren
        </button>
      </div>
    </li>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TaxPage() {
  const [year, setYear] = useState<number | undefined>(undefined);
  const [data, setData] = useState<TaxOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setData(await getTaxOverview(year));
    } catch {
      setError('Steuerdaten konnten nicht geladen werden.');
    }
  }, [year]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const running = !!data && [data.checklist, data.hints, data.priorReturn].some((j) => j.status === 'RUNNING');
  useEffect(() => {
    if (!running) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [running, load]);

  async function start(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      setNotice(message);
      await load();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? 'Läuft schon.' : 'Start fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  const groups = useMemo(() => {
    if (!data) return [];
    const byRubric = new Map<string, TaxItem[]>();
    for (const i of data.items) {
      const r = i.rubric ?? 'Sonstiges';
      byRubric.set(r, [...(byRubric.get(r) ?? []), i]);
    }
    return [...byRubric.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'de'))
      .map(([rubric, items]) => [rubric, [...items].sort((a, b) => ORDER[itemState(a)] - ORDER[itemState(b)])] as const);
  }, [data]);

  const filesByRubric = useMemo(() => {
    const m = new Map<string, number>();
    data?.files.forEach((f) => m.set(f.rubric, (m.get(f.rubric) ?? 0) + 1));
    return m;
  }, [data]);

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto">
        {error ? <p className="text-sm text-red-600">{error}</p> : <p className="text-sm text-slate-500">Lade…</p>}
      </div>
    );
  }

  const states = data.items.map(itemState);
  const missing = states.filter((s) => s === 'missing' || s === 'partial').length;
  const ok = states.filter((s) => s === 'found' || s === 'done').length;
  const pendingHints = data.hintItems.filter((h) => h.status === 'PENDING');
  const decidedHints = data.hintItems.filter((h) => h.status !== 'PENDING');
  const y = data.year;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-4">
        <Link href="/documents" className="text-xs text-slate-500 hover:underline">‹ Dokumente</Link>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Steuern {y}</h1>
            <p className="text-sm text-slate-500">
              Deutsche Steuererklärung (Grenzgänger Basel) – was liegt schon in
              „Steuerunterlagen {y}“, was fehlt noch?
            </p>
          </div>
          <div className="flex gap-1">
            {data.years.map((yy) => (
              <button key={yy} type="button" onClick={() => setYear(yy)}
                className={`px-2.5 py-1 rounded-lg text-sm ${yy === y ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                {yy}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 flex justify-between">
          {error}<button onClick={() => setError(null)} className="ml-4 text-xs underline">Schließen</button>
        </div>
      )}
      {notice && (
        <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 flex justify-between">
          {notice}<button onClick={() => setNotice(null)} className="ml-4 text-xs underline">OK</button>
        </div>
      )}
      {!data.aiConfigured && (
        <div className="glass rounded-2xl p-4 text-sm text-slate-600 mb-3">
          Kein Anthropic-API-Key auf dem Server – Abgleich und Hinweise sind nicht möglich.
        </div>
      )}
      {!data.listingUpdatedAt && (
        <div className="glass rounded-2xl p-4 text-sm text-slate-600 mb-3">
          Dein Mac hat für {y} noch keine Ordnerliste geschickt. Das macht <code>~/familyadmin-sync/inbox.py</code> alle
          paar Minuten, wenn der Mac wach ist.
        </div>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="glass rounded-2xl p-3">
          <p className="text-2xl font-bold text-emerald-700">{ok}</p>
          <p className="text-xs text-slate-500">Belege da</p>
        </div>
        <div className="glass rounded-2xl p-3">
          <p className="text-2xl font-bold text-red-600">{missing}</p>
          <p className="text-xs text-slate-500">fehlen noch</p>
        </div>
        <div className="glass rounded-2xl p-3">
          <p className="text-2xl font-bold text-sky-700">{pendingHints.length}</p>
          <p className="text-xs text-slate-500">Hinweise aus dem Archiv</p>
        </div>
      </div>

      {/* Checklist */}
      <section className="glass rounded-2xl p-4 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Checkliste</h2>
            <p className="text-xs text-slate-500">
              Aus deinem Ordner {y - 1}{data.priorReturnFilename ? ` und der Steuererklärung ${y - 1}` : ''}, abgeglichen
              mit dem Ordner {y}.
            </p>
            <JobLine job={data.checklist} running="KI gleicht ab… (dauert 1–2 Minuten)" label="Abgeglichen" />
          </div>
          <button type="button" className={btnPrimary} disabled={busy || !data.aiConfigured || data.checklist.status === 'RUNNING'}
            onClick={() => start(() => refreshChecklist(y), 'Abgleich gestartet')}>
            {data.items.some((i) => i.source !== 'MANUAL') ? 'Neu abgleichen' : 'Checkliste erstellen'}
          </button>
        </div>
        {data.checklistStale && data.checklist.status !== 'RUNNING' && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
            Im Ordner hat sich seit dem letzten Abgleich etwas geändert.
          </p>
        )}
        {data.checklistSummary && (
          <p className="mt-3 text-sm text-slate-700 whitespace-pre-line">{data.checklistSummary}</p>
        )}

        {groups.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Noch keine Checkliste. „Checkliste erstellen“ vergleicht den Ordner {y} mit {y - 1}.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {groups.map(([rubric, items]) => (
              <div key={rubric}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{rubric}</h3>
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white/60 mt-1">
                  {items.map((i) => (
                    <ItemRow key={`${i.id}-${i.userStatus}-${i.aiStatus}`} item={i}
                      onChanged={load} onError={setError} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3">
          <AddItemForm year={y} rubrics={data.rubrics} onDone={load} onError={setError} />
        </div>
      </section>

      {/* Prior return */}
      <section className="glass rounded-2xl p-4 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Steuererklärung {y - 1}</h2>
            <p className="text-xs text-slate-500">
              PDF der Erklärung oder des Bescheids {y - 1}: die KI liest daraus, welche Belege {y} wieder nötig sind.
              Die Datei wird nicht gespeichert.
            </p>
            {data.priorReturnFilename && data.priorReturn.status !== 'RUNNING' && (
              <p className="text-xs text-slate-600 mt-1">Importiert: {data.priorReturnFilename}</p>
            )}
            <JobLine job={data.priorReturn} running="KI liest die Steuererklärung… danach wird neu abgeglichen" label="Gelesen" />
          </div>
          <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) start(() => importPriorReturn(y, f), `„${f.name}“ wird gelesen`);
            }} />
          <button type="button" className={btnOutline}
            disabled={busy || !data.aiConfigured || data.priorReturn.status === 'RUNNING'}
            onClick={() => fileInput.current?.click()}>
            PDF hochladen
          </button>
        </div>
        {data.priorReturnSummary && (
          <p className="mt-3 text-sm text-slate-700 whitespace-pre-line">{data.priorReturnSummary}</p>
        )}
      </section>

      {/* Hints */}
      <section className="mb-4">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Hinweise aus deinem Archiv</h2>
              <p className="text-xs text-slate-500">
                Dokumente aus {y} in Gesundheit, Rechnungen, Finanzen … die steuerrelevant sein könnten.
                Kopieren legt eine Kopie in den Steuerordner, das Original bleibt.
              </p>
              <JobLine job={data.hints} running="KI prüft deine Dokumente…" label="Zuletzt geprüft" />
            </div>
            <button type="button" className={btnOutline}
              disabled={busy || !data.aiConfigured || data.hints.status === 'RUNNING' || data.uncheckedDocuments === 0}
              onClick={() => start(() => scanHints(y), 'Suche gestartet')}>
              {data.uncheckedDocuments > 0 ? `${data.uncheckedDocuments} Dokumente prüfen` : 'Alles geprüft'}
            </button>
          </div>
        </div>
        {pendingHints.length > 0 && (
          <ul className="space-y-3 mt-3">
            {pendingHints.map((h) => (
              <HintCard key={`${h.id}-${h.status}`} hint={h} year={y}
                onChanged={(m) => { if (m) setNotice(m); load(); }} onError={setError} />
            ))}
          </ul>
        )}
        {decidedHints.length > 0 && (
          <ul className="glass rounded-2xl divide-y divide-slate-100 mt-3">
            {decidedHints.map((h) => (
              <HintCard key={`${h.id}-${h.status}`} hint={h} year={y}
                onChanged={(m) => { if (m) setNotice(m); load(); }} onError={setError} />
            ))}
          </ul>
        )}
      </section>

      {/* Folder content */}
      <section className="glass rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-slate-800">Im Ordner „Steuerunterlagen {y}“ ({data.files.length})</h2>
        {data.listingUpdatedAt && (
          <p className="text-[11px] text-slate-400">Stand vom Mac: {formatDate(data.listingUpdatedAt)}</p>
        )}
        <div className="mt-2 space-y-1">
          {[...filesByRubric.keys()].sort((a, b) => a.localeCompare(b, 'de')).map((rubric) => (
            <details key={rubric} className="rounded-lg bg-white/60 border border-slate-100 px-3 py-1.5">
              <summary className="cursor-pointer text-sm text-slate-700">
                {rubric} <span className="text-slate-400">({filesByRubric.get(rubric)})</span>
              </summary>
              <ul className="mt-1 mb-1 text-xs text-slate-600 space-y-0.5">
                {data.files.filter((f) => f.rubric === rubric).map((f) => (
                  <li key={f.path} className="break-words">{f.name}</li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
