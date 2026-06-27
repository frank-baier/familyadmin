'use client';

import { useState, useEffect } from 'react';
import {
  getLegs,
  addLeg,
  updateLeg,
  deleteLeg,
  refreshFlightStatus,
  formatInstant,
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
  TRANSPORT_TYPE_LABELS,
  TRANSPORT_TYPE_ICONS,
  type TransportLeg,
  type TransportLegRequest,
  type TransportType,
} from '@/lib/travel-transport';

// ─── Form ─────────────────────────────────────────────────────────────────────

const TYPES: TransportType[] = ['FLIGHT', 'TRAIN', 'BUS', 'CAR', 'FERRY', 'OTHER'];

interface LegFormProps {
  tripId: string;
  nextPosition: number;
  initial?: TransportLeg;
  onSaved: (leg: TransportLeg) => void;
  onCancel: () => void;
}

function LegForm({ tripId, nextPosition, initial, onSaved, onCancel }: LegFormProps) {
  const [type, setType] = useState<TransportType>(initial?.type ?? 'FLIGHT');
  const [fromLocation, setFromLocation] = useState(initial?.fromLocation ?? '');
  const [toLocation, setToLocation] = useState(initial?.toLocation ?? '');
  const [departureAt, setDepartureAt] = useState(toDatetimeLocalValue(initial?.departureAt ?? null));
  const [arrivalAt, setArrivalAt] = useState(toDatetimeLocalValue(initial?.arrivalAt ?? null));
  const [carrier, setCarrier] = useState(initial?.carrier ?? '');
  const [bookingReference, setBookingReference] = useState(initial?.bookingReference ?? '');
  const [seat, setSeat] = useState(initial?.seat ?? '');
  const [flightNumber, setFlightNumber] = useState(initial?.flightNumber ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromLocation.trim() || !toLocation.trim() || !departureAt || !arrivalAt) {
      setError('Bitte alle Pflichtfelder ausfüllen.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const req: TransportLegRequest = {
        type,
        fromLocation: fromLocation.trim(),
        toLocation: toLocation.trim(),
        departureAt: fromDatetimeLocalValue(departureAt),
        arrivalAt: fromDatetimeLocalValue(arrivalAt),
        carrier: carrier.trim() || undefined,
        bookingReference: bookingReference.trim() || undefined,
        seat: seat.trim() || undefined,
        flightNumber: flightNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        position: initial?.position ?? nextPosition,
      };
      const saved = initial
        ? await updateLeg(tripId, initial.id, req)
        : await addLeg(tripId, req);
      onSaved(saved);
    } catch {
      setError('Speichern fehlgeschlagen.');
      setSaving(false);
    }
  }

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400';
  const labelCls = 'block text-xs font-medium text-slate-500 mb-1';

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-orange-200 bg-orange-50 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>Typ</label>
          <select value={type} onChange={(e) => setType(e.target.value as TransportType)} className={inputCls}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {TRANSPORT_TYPE_ICONS[t]} {TRANSPORT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Von *</label>
          <input value={fromLocation} onChange={(e) => setFromLocation(e.target.value)}
            placeholder="Frankfurt FRA" required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Nach *</label>
          <input value={toLocation} onChange={(e) => setToLocation(e.target.value)}
            placeholder="New York JFK" required className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Abfahrt *</label>
          <input type="datetime-local" value={departureAt} onChange={(e) => setDepartureAt(e.target.value)}
            required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Ankunft *</label>
          <input type="datetime-local" value={arrivalAt} onChange={(e) => setArrivalAt(e.target.value)}
            required className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Carrier / Anbieter</label>
          <input value={carrier} onChange={(e) => setCarrier(e.target.value)}
            placeholder="Lufthansa" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Buchungsnummer</label>
          <input value={bookingReference} onChange={(e) => setBookingReference(e.target.value)}
            placeholder="ABCDEF" className={inputCls} />
        </div>

        {type === 'FLIGHT' && (
          <div>
            <label className={labelCls}>Flugnummer</label>
            <input value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)}
              placeholder="LH401" className={inputCls} />
          </div>
        )}

        <div className={type === 'FLIGHT' ? '' : 'col-span-2'}>
          <label className={labelCls}>Sitzplatz</label>
          <input value={seat} onChange={(e) => setSeat(e.target.value)}
            placeholder="23A" className={inputCls} />
        </div>

        <div className="col-span-2">
          <label className={labelCls}>Notizen</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            rows={2} placeholder="Optionale Hinweise…" className={`${inputCls} resize-none`} />
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-orange-500 hover:bg-orange-600
                     disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          {saving ? 'Speichert…' : initial ? 'Speichern' : 'Hinzufügen'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 bg-white border border-slate-200
                     hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}

// ─── Flight status badge ───────────────────────────────────────────────────────

function FlightStatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const map: Record<string, string> = {
    scheduled: 'bg-sky-50 text-sky-700 border-sky-200',
    active: 'bg-green-50 text-green-700 border-green-200',
    landed: 'bg-slate-50 text-slate-600 border-slate-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
    incident: 'bg-red-50 text-red-700 border-red-200',
    diverted: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  };
  const cls = map[status.toLowerCase()] ?? 'bg-slate-50 text-slate-600 border-slate-200';
  const labels: Record<string, string> = {
    scheduled: 'Planmäßig',
    active: 'Im Flug',
    landed: 'Gelandet',
    cancelled: 'Gestrichen',
    incident: 'Zwischenfall',
    diverted: 'Umgeleitet',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium border ${cls}`}>
      {labels[status.toLowerCase()] ?? status}
    </span>
  );
}

// ─── Leg card ─────────────────────────────────────────────────────────────────

interface LegCardProps {
  leg: TransportLeg;
  tripId: string;
  onUpdated: (leg: TransportLeg) => void;
  onDeleted: (id: string) => void;
  nextPosition: number;
}

function LegCard({ leg, tripId, onUpdated, onDeleted, nextPosition }: LegCardProps) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteLeg(tripId, leg.id);
      onDeleted(leg.id);
    } catch {
      setDeleting(false);
    }
  }

  async function handleRefreshFlight() {
    setRefreshing(true);
    try {
      const updated = await refreshFlightStatus(tripId, leg.id);
      onUpdated(updated);
    } finally {
      setRefreshing(false);
    }
  }

  if (editing) {
    return (
      <LegForm
        tripId={tripId}
        nextPosition={nextPosition}
        initial={leg}
        onSaved={(updated) => { onUpdated(updated); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
      {/* Header row */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <div className="shrink-0 w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center text-xl">
          {TRANSPORT_TYPE_ICONS[leg.type]}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-800">
              {leg.fromLocation}
            </span>
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            <span className="text-sm font-semibold text-slate-800">
              {leg.toLocation}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-slate-500">
            <span>{formatInstant(leg.departureAt)}</span>
            <span className="text-slate-300">→</span>
            <span>{formatInstant(leg.arrivalAt)}</span>
          </div>

          {(leg.carrier || leg.bookingReference || leg.seat || leg.flightNumber) && (
            <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-slate-400">
              {leg.carrier && <span>{leg.carrier}</span>}
              {leg.flightNumber && <span className="font-mono">{leg.flightNumber}</span>}
              {leg.bookingReference && <span>· {leg.bookingReference}</span>}
              {leg.seat && <span>· Sitz {leg.seat}</span>}
            </div>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-1">
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50
                       transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400"
            title="Bearbeiten"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50
                       transition-colors focus:outline-none focus:ring-2 focus:ring-red-400
                       disabled:opacity-40"
            title="Löschen"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      </div>

      {/* Flight status section */}
      {leg.type === 'FLIGHT' && leg.flightNumber && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 flex items-center gap-3 flex-wrap">
          <FlightStatusBadge status={leg.flightStatus} />

          {leg.delayMinutes != null && leg.delayMinutes > 0 && (
            <span className="text-xs font-medium text-amber-600">
              +{leg.delayMinutes} Min. Verspätung
            </span>
          )}

          {(leg.departureGate || leg.departureTerminal) && (
            <span className="text-xs text-slate-500">
              Abflug: {[leg.departureTerminal && `Terminal ${leg.departureTerminal}`, leg.departureGate && `Gate ${leg.departureGate}`].filter(Boolean).join(' · ')}
            </span>
          )}

          {(leg.arrivalGate || leg.arrivalTerminal) && (
            <span className="text-xs text-slate-500">
              Ankunft: {[leg.arrivalTerminal && `Terminal ${leg.arrivalTerminal}`, leg.arrivalGate && `Gate ${leg.arrivalGate}`].filter(Boolean).join(' · ')}
            </span>
          )}

          <button
            onClick={handleRefreshFlight}
            disabled={refreshing}
            className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium
                       text-sky-700 bg-sky-50 border border-sky-200
                       hover:bg-sky-100 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            {refreshing ? 'Aktualisiert…' : 'Flugstatus'}
          </button>

          {leg.statusCheckedAt && (
            <span className="text-xs text-slate-400 w-full">
              Zuletzt geprüft: {formatInstant(leg.statusCheckedAt)}
            </span>
          )}
        </div>
      )}

      {leg.notes && (
        <div className="border-t border-slate-100 px-4 py-2">
          <p className="text-xs text-slate-500">{leg.notes}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TransportListProps {
  tripId: string;
}

export function TransportList({ tripId }: TransportListProps) {
  const [legs, setLegs] = useState<TransportLeg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setLegs(await getLegs(tripId));
    } catch {
      setError('Transport konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  function handleAdded(leg: TransportLeg) {
    setLegs((prev) => [...prev, leg].sort((a, b) =>
      new Date(a.departureAt).getTime() - new Date(b.departureAt).getTime()
    ));
    setShowForm(false);
  }

  function handleUpdated(leg: TransportLeg) {
    setLegs((prev) =>
      prev.map((l) => (l.id === leg.id ? leg : l))
        .sort((a, b) => new Date(a.departureAt).getTime() - new Date(b.departureAt).getTime())
    );
  }

  function handleDeleted(id: string) {
    setLegs((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-600">
          {legs.length === 0 ? 'Noch keine Reiseabschnitte' : `${legs.length} Abschnitt${legs.length === 1 ? '' : 'e'}`}
        </p>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                       text-white bg-orange-500 hover:bg-orange-600
                       focus:outline-none focus:ring-2 focus:ring-orange-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Hinzufügen
          </button>
        )}
      </div>

      {showForm && (
        <LegForm
          tripId={tripId}
          nextPosition={legs.length}
          onSaved={handleAdded}
          onCancel={() => setShowForm(false)}
        />
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((n) => (
            <div key={n} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : legs.length === 0 && !showForm ? (
        <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 px-6 py-10 text-center">
          <p className="text-sm text-slate-400">Noch keine Reiseabschnitte vorhanden.</p>
          <p className="text-xs text-slate-400 mt-1">Füge Flüge, Züge oder andere Verbindungen hinzu.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {legs.map((leg) => (
            <LegCard
              key={leg.id}
              leg={leg}
              tripId={tripId}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
              nextPosition={legs.length}
            />
          ))}
        </div>
      )}
    </div>
  );
}
