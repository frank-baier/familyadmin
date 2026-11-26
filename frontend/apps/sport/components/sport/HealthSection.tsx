'use client';

/**
 * Apple Health — daily values pushed by an iOS Shortcuts automation (POST /api/health/ingest).
 * Per user only; never shown to anyone else.
 */

import { useCallback, useEffect, useState } from 'react';
import type { HealthDaily, HealthToken } from '@/lib/health';
import { HEALTH_METRICS, getHealthDaily, getHealthToken, revokeHealthToken, rotateHealthToken } from '@/lib/health';
import { errorMessage } from '@/lib/sport';

const dtf = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function avg(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function fmt(v: number, decimals: number): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(v);
}

function Sparkline({ points }: { points: (number | null)[] }) {
  const vals = points.filter((p): p is number => p != null);
  if (vals.length < 2) return null;
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const w = 120, h = 28;
  const step = w / (points.length - 1);
  let d = '';
  points.forEach((p, i) => {
    if (p == null) return;
    const x = i * step, y = h - 2 - ((p - min) / range) * (h - 4);
    d += `${d === '' || points[i - 1] == null ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-7 mt-2" aria-hidden="true" preserveAspectRatio="none">
      <path d={d} fill="none" stroke="#2a78d6" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

export function HealthSection() {
  const [data, setData] = useState<HealthDaily | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  const load = useCallback(() => {
    getHealthDaily(90)
      .then((d) => { setData(d); setError(null); })
      .catch((err) => setError(errorMessage(err, 'Health-Daten konnten nicht geladen werden.')));
  }, []);

  useEffect(load, [load]);

  const days = data?.days ?? [];
  const hasData = days.length > 0;

  // Last 30 calendar days, so gaps show as gaps in the sparkline.
  const last30: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last30.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  const byDate = new Map(days.map((d) => [d.date, d.metrics]));

  const tiles = HEALTH_METRICS.flatMap((m) => {
    const series = last30.map((date) => byDate.get(date)?.[m.key] ?? null);
    const all = days.filter((d) => d.metrics[m.key] != null);
    if (all.length === 0) return [];
    const latest = all[all.length - 1];
    const avg7 = avg(series.slice(-7).filter((v): v is number => v != null));
    const avg30 = avg(series.filter((v): v is number => v != null));
    return [{ m, series, latest, avg7, avg30 }];
  });

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="section-label">Apple Health</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {data?.lastSyncAt ? `Letzte Synchronisation ${dtf.format(new Date(data.lastSyncAt))}` : 'Noch nicht synchronisiert'}
          </p>
        </div>
        {hasData && (
          <button onClick={() => setShowSetup((s) => !s)} className="btn-ghost" aria-expanded={showSetup}>iPhone-Sync</button>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {(!hasData || showSetup) && data && <HealthSyncSetup onChanged={load} />}

      {hasData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {tiles.map(({ m, series, latest, avg7, avg30 }) => {
            const delta = avg7 != null && avg30 != null && avg30 !== 0 ? (avg7 - avg30) / avg30 : null;
            const up = delta != null && delta > 0.02, down = delta != null && delta < -0.02;
            const good = m.neutral ? null : m.lowerIsBetter ? down : up;
            const bad = m.neutral ? null : m.lowerIsBetter ? up : down;
            return (
              <div key={m.key} className="glass rounded-2xl p-4">
                <p className="text-xs font-medium text-slate-500">{m.label}</p>
                <p className="text-2xl font-semibold text-slate-900 tabular-nums mt-1">
                  {fmt(latest.metrics[m.key], m.decimals)}
                  {m.unit && <span className="text-sm font-normal text-slate-400 ml-1">{m.unit}</span>}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' }).format(new Date(`${latest.date}T00:00:00`))}
                  {avg7 != null && <> · Ø 7 T {fmt(avg7, m.decimals)}</>}
                  {(up || down) && (
                    <span className={`ml-1 ${good ? 'text-emerald-600' : bad ? 'text-amber-600' : 'text-slate-500'}`}>
                      {up ? '↑' : '↓'}
                    </span>
                  )}
                </p>
                <Sparkline points={series} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function HealthSyncSetup({ onChanged }: { onChanged: () => void }) {
  const [status, setStatus] = useState<HealthToken | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { getHealthToken().then(setStatus).catch(() => setStatus(null)); }, []);

  const endpoint = typeof window !== 'undefined' ? `${window.location.origin}/api/health/ingest` : '/api/health/ingest';

  async function generate() {
    if (status?.exists && !confirm('Neuen Token erzeugen? Der bisherige Kurzbefehl funktioniert danach nicht mehr, bis du den neuen Token einträgst.')) return;
    setBusy(true);
    setError(null);
    try {
      const t = await rotateHealthToken();
      setNewToken(t.token);
      setStatus({ ...t, token: null });
    } catch (err) {
      setError(errorMessage(err, 'Token konnte nicht erzeugt werden.'));
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!confirm('Sync-Token widerrufen? Der Kurzbefehl kann danach keine Daten mehr senden.')) return;
    await revokeHealthToken();
    setStatus({ exists: false, createdAt: null, lastUsedAt: null, token: null });
    setNewToken(null);
    onChanged();
  }

  async function copy(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="glass rounded-3xl p-6 md:p-8">
      <h3 className="text-lg font-semibold text-slate-900">Apple Health automatisch synchronisieren</h3>
      <p className="text-sm text-slate-600 mt-1">
        Ein Kurzbefehl auf deinem iPhone liest täglich deine Health-Werte und schickt sie hierher. Kostenlos, ohne Zusatz-App.
      </p>

      <div className="mt-5 space-y-3">
        <div>
          <p className="text-xs font-medium text-slate-500">1 · Adresse (URL)</p>
          <div className="flex gap-2 items-center mt-1">
            <code className="text-xs bg-stone-100 rounded px-2 py-1.5 break-all flex-1">{endpoint}</code>
            <button className="btn-ghost text-xs" onClick={() => copy('url', endpoint)}>{copied === 'url' ? 'Kopiert' : 'Kopieren'}</button>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-500">2 · Sync-Token (Header <code>X-Health-Token</code>)</p>
          {newToken ? (
            <>
              <div className="flex gap-2 items-center mt-1">
                <code className="text-xs bg-amber-50 border border-amber-200 rounded px-2 py-1.5 break-all flex-1">{newToken}</code>
                <button className="btn-ghost text-xs" onClick={() => copy('token', newToken)}>{copied === 'token' ? 'Kopiert' : 'Kopieren'}</button>
              </div>
              <p className="text-xs text-amber-700 mt-1">Wird nur jetzt angezeigt. Trage ihn gleich im Kurzbefehl ein.</p>
            </>
          ) : (
            <div className="flex gap-2 items-center mt-1 flex-wrap">
              <span className="text-sm text-slate-600">
                {status?.exists
                  ? `Aktiv seit ${dtf.format(new Date(status.createdAt!))}${status.lastUsedAt ? ` · zuletzt genutzt ${dtf.format(new Date(status.lastUsedAt))}` : ' · noch nie genutzt'}`
                  : 'Noch kein Token'}
              </span>
              <button className={status?.exists ? 'btn-secondary' : 'btn-primary'} onClick={generate} disabled={busy}>
                {busy ? 'Erzeuge…' : status?.exists ? 'Neuen Token erzeugen' : 'Token erzeugen'}
              </button>
              {status?.exists && <button className="btn-ghost text-xs text-red-600" onClick={revoke}>Widerrufen</button>}
            </div>
          )}
          {error && <p role="alert" className="text-sm text-red-600 mt-1">{error}</p>}
        </div>

        <details className="text-sm text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-700">3 · Kurzbefehl einrichten</summary>
          <ol className="mt-2 space-y-1.5 list-decimal list-inside">
            <li>App <b>Kurzbefehle</b> → neuer Kurzbefehl „FamilyAdmin Health“.</li>
            <li>Je Wert: <b>Health-Beispiele suchen</b> (Typ z. B. Schritte, Startdatum „ist gestern“) → <b>Statistik berechnen</b> (Summe für Schritte/Energie/Minuten, Durchschnitt für Ruhepuls/HRV, für Gewicht „Neueste“ und Limit 1).</li>
            <li><b>Datum formatieren</b>: gestern, benutzerdefiniert <code>yyyy-MM-dd</code>.</li>
            <li><b>Wörterbuch</b> mit <code>date</code> und den Werten: <code>steps</code>, <code>active_energy_kcal</code>, <code>exercise_minutes</code>, <code>walking_distance_km</code>, <code>flights_climbed</code>, <code>resting_hr</code>, <code>hrv_ms</code>, <code>vo2max</code>, <code>sleep_hours</code> (oder <code>sleep_minutes</code>), <code>weight_kg</code>, <code>body_fat_pct</code>. Alle optional.</li>
            <li><b>Inhalte von URL abrufen</b>: URL oben, Methode POST, Header <code>X-Health-Token</code>, Hauptteil JSON → das Wörterbuch.</li>
            <li>Tab <b>Automation</b> → <b>Tageszeit</b> (z. B. 9:00, täglich) → „Sofort ausführen“. Optional eine zweite Automation, z. B. beim Öffnen einer oft genutzten App.</li>
          </ol>
          <p className="text-xs text-slate-400 mt-2">
            iOS gibt Health-Daten nur bei entsperrtem iPhone frei. Wähle eine Zeit, zu der du das Telefon meist nutzt. Mehrfaches Senden desselben Tages überschreibt nur, nichts wird doppelt gezählt.
            Mehrere Tage auf einmal: <code>{'{"days":[{"date":…},…]}'}</code>.
          </p>
        </details>
      </div>
    </div>
  );
}
