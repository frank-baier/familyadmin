'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import type { SportImportResult, SportProfile } from '@/lib/sport';
import { errorMessage, getSportProfile, importStravaExport, updateSportProfile } from '@/lib/sport';

export function StravaImport({ onImported, compact = false }: { onImported: () => void; compact?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SportImportResult | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const r = await importStravaExport(file);
      setResult(r);
      onImported();
    } catch (err) {
      setError(errorMessage(err, 'Import fehlgeschlagen.'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const button = (
    <label className={`${compact ? 'btn-secondary' : 'btn-primary'} cursor-pointer shrink-0`}>
      {uploading ? 'Wird importiert…' : compact ? 'Neuer Export' : 'Datei auswählen'}
      <input ref={inputRef} type="file" accept=".zip,.csv" onChange={onFile} disabled={uploading} className="hidden" />
    </label>
  );

  return (
    <div>
      {compact ? button : (
        <div className="glass rounded-3xl p-6 md:p-8">
          <h2 className="text-lg font-semibold text-slate-900">Strava-Daten importieren</h2>
          <ol className="mt-3 space-y-2 text-sm text-slate-600 list-decimal list-inside">
            <li>Auf strava.com: <span className="font-medium">Einstellungen → Mein Konto → Konto herunterladen oder löschen → „Anfrage senden“</span>.</li>
            <li>Strava schickt dir per E-Mail einen Link zum ZIP (dauert meist einige Stunden).</li>
            <li>Das ZIP hier hochladen — oder, falls es größer als 100 MB ist, nur die darin enthaltene <code className="text-xs bg-stone-100 px-1 rounded">activities.csv</code>.</li>
          </ol>
          <p className="text-xs text-slate-400 mt-3">Erneutes Importieren eines neueren Exports aktualisiert bestehende Aktivitäten — nichts wird doppelt gezählt. Deine Daten sind nur für dich sichtbar.</p>
          <div className="mt-5">{button}</div>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>}
      {result && (
        <p role="status" className="text-sm text-emerald-700 mt-3">
          {result.imported} neu, {result.updated} aktualisiert — insgesamt {result.totalActivities} Aktivitäten.
        </p>
      )}
      {result && result.warnings.length > 0 && (
        <ul className="text-xs text-amber-700 mt-2 space-y-0.5 list-disc list-inside">
          {result.warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
    </div>
  );
}

type FormState = { ok: boolean; error: string | null };

export function SportSettings({ onSaved, onClose, estimatedMaxHr }: { onSaved: () => void; onClose: () => void; estimatedMaxHr: number }) {
  const [profile, setProfile] = useState<SportProfile | null>(null);

  useEffect(() => {
    getSportProfile().then(setProfile).catch(() => setProfile({ maxHeartRate: null, restingHeartRate: null, birthYear: null, sex: null }));
  }, []);

  const [state, action, pending] = useActionState<FormState, FormData>(async (_prev, fd) => {
    const num = (k: string) => { const v = String(fd.get(k) ?? '').trim(); return v ? Number(v) : null; };
    const sex = String(fd.get('sex') ?? '');
    try {
      await updateSportProfile({
        maxHeartRate: num('maxHeartRate'), restingHeartRate: num('restingHeartRate'),
        birthYear: num('birthYear'), sex: sex === 'MALE' || sex === 'FEMALE' ? sex : null,
      });
      onSaved();
      return { ok: true, error: null };
    } catch (err) {
      return { ok: false, error: errorMessage(err, 'Speichern fehlgeschlagen — Werte prüfen.') };
    }
  }, { ok: false, error: null });

  if (!profile) return <div className="glass rounded-3xl p-5 h-40 animate-pulse" />;

  return (
    <form action={action} className="glass rounded-3xl p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-slate-900">Persönliche Werte</h2>
        <p className="text-xs text-slate-400 mt-0.5">Machen Trainingslast, Form und VO₂max genauer. Leer lassen = Schätzung aus deinen Daten.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <label className="text-sm text-slate-600 space-y-1">
          <span>Max-Puls</span>
          <input name="maxHeartRate" type="number" min={100} max={240} defaultValue={profile.maxHeartRate ?? ''}
            placeholder={`${estimatedMaxHr} (geschätzt)`} className="input-field" />
        </label>
        <label className="text-sm text-slate-600 space-y-1">
          <span>Ruhepuls</span>
          <input name="restingHeartRate" type="number" min={25} max={120} defaultValue={profile.restingHeartRate ?? ''}
            placeholder="60" className="input-field" />
        </label>
        <label className="text-sm text-slate-600 space-y-1">
          <span>Geburtsjahr</span>
          <input name="birthYear" type="number" min={1900} max={2100} defaultValue={profile.birthYear ?? ''} className="input-field" />
        </label>
        <label className="text-sm text-slate-600 space-y-1">
          <span>Geschlecht</span>
          <select name="sex" defaultValue={profile.sex ?? ''} className="input-field">
            <option value="">—</option>
            <option value="MALE">männlich</option>
            <option value="FEMALE">weiblich</option>
          </select>
        </label>
      </div>
      <p className="text-xs text-slate-400">Tipp: Ruhepuls morgens direkt nach dem Aufwachen messen (z. B. mit der Uhr). Max-Puls am besten aus einem harten Intervall oder Wettkampf.</p>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-emerald-700">Gespeichert — Statistiken neu berechnet.</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary">{pending ? 'Speichern…' : 'Speichern'}</button>
        <button type="button" onClick={onClose} className="btn-ghost">Schließen</button>
      </div>
    </form>
  );
}
