'use client';

/**
 * Trip detail page — /travel/[id]
 * - Header: destination, date range, description
 * - Key Info panel: label/value pairs (read-only)
 * - Two main tabs: "Packing List" and "Itinerary"
 * - Packing List tab has sub-tabs: "Shared" | "My Items"
 * - Itinerary tab shows a placeholder (04-03 will replace)
 * - Delete trip button with confirm dialog
 */

import { useState, useEffect, use } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getTrip, deleteTrip } from '@/lib/travel';
import { getCurrentUser } from '@/lib/auth';
import { getLegs } from '@/lib/travel-transport';
import { PackingList } from '@/components/travel/PackingList';
import { DocumentsList } from '@/components/travel/DocumentsList';
import { TransportList } from '@/components/travel/TransportList';
import type { Trip, TripKeyInfo } from '@/lib/travel';
import type { User } from '@/lib/auth';
import type { TransportLeg } from '@/lib/travel-transport';
import type { TripMapProps } from '@/components/travel/TripMap';

const TripMap = dynamic<TripMapProps>(
  () => import('@/components/travel/TripMap').then(m => ({ default: m.TripMap })),
  { ssr: false, loading: () => <div className="h-[420px] bg-slate-50 rounded-2xl animate-pulse" /> }
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateRange(startStr: string, endStr: string): string {
  const start = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T00:00:00`);

  const dayFmt = new Intl.DateTimeFormat('de-DE', { day: 'numeric' });
  const monthFmt = new Intl.DateTimeFormat('de-DE', { month: 'short' });
  const yearFmt = new Intl.DateTimeFormat('de-DE', { year: 'numeric' });

  const startDay = dayFmt.format(start);
  const startMonth = monthFmt.format(start);
  const startYear = yearFmt.format(start);
  const endDay = dayFmt.format(end);
  const endMonth = monthFmt.format(end);
  const endYear = yearFmt.format(end);

  if (startYear === endYear && startMonth === endMonth) {
    return `${startDay}–${endDay} ${startMonth} ${startYear}`;
  }
  if (startYear === endYear) {
    return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${startYear}`;
  }
  return `${startDay} ${startMonth} ${startYear} – ${endDay} ${endMonth} ${endYear}`;
}

// 6 gradient pairs — matches TripCard.tsx
const GRADIENTS = [
  'from-indigo-500 to-indigo-700',
  'from-violet-500 to-violet-700',
  'from-teal-500 to-teal-700',
  'from-amber-500 to-amber-700',
  'from-rose-500 to-rose-700',
  'from-emerald-500 to-emerald-700',
];

function getGradient(destination: string): string {
  const seed = destination.charCodeAt(0) % 6;
  return GRADIENTS[seed] ?? GRADIENTS[0];
}

// ─── Accommodation table (Reiseplan tab) ─────────────────────────────────────

// Meta-lines to strip when extracting address (check-in/out, booking refs, transit notes)
const META_RE = /^(check-in|check-out|buchung|ref:|nacht:|arriving|departing|staying|powered site|price|additional|your group)/i;
// First-line patterns that indicate a hotel/camp name rather than an address
const HOTEL_NAME_RE = /resort|hotel|parks|lodge|big4|tasman|airways|garden|coral|holiday|camping|beach house/i;
const STREET_LINE_RE = /\b(drive|dr|road|rd|street|st\b|avenue|ave|esplanade|way|lane|parade|circuit|crescent|boulevard|blvd|harbour)\b/i;

function mapsUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function isAddressLine(line: string, index: number): boolean {
  if (META_RE.test(line)) return false;
  if (index === 0 && HOTEL_NAME_RE.test(line) && !/^\d/.test(line)) return false;
  if (STREET_LINE_RE.test(line) || /^\d+\s/.test(line)) return true;
  if (index > 0 && line.includes(',') && !/Buchung|Ref:|Check/i.test(line)) return true;
  return false;
}

function KeyInfoValue({ info }: { info: TripKeyInfo }) {
  const lines = info.value.split('\n').map(l => l.trim()).filter(Boolean);
  const query = `${info.label} ${extractAddress(info.value)}`.trim();
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {i > 0 && '\n'}
          {isAddressLine(line, i) ? (
            <a href={mapsUrl(query)} target="_blank" rel="noopener noreferrer"
               className="text-indigo-500 hover:text-indigo-700 hover:underline">
              {line}
            </a>
          ) : line}
        </span>
      ))}
    </>
  );
}

function parseCheckDate(value: string, type: 'in' | 'out'): string | null {
  const keyword = type === 'in' ? 'check-in' : 'check-out';
  for (const line of value.split('\n')) {
    if (line.toLowerCase().includes(keyword)) {
      const german = line.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (german) return `${german[1].padStart(2, '0')}.${german[2].padStart(2, '0')}.${german[3]}`;
      const iso = line.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
      const eng = line.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
      if (eng) {
        const months: Record<string, string> = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' };
        return `${eng[1].padStart(2,'0')}.${months[eng[2]] ?? '01'}.${eng[3]}`;
      }
    }
  }
  return null;
}

function extractAddress(value: string): string {
  const lines = value.split('\n').map(l => l.trim()).filter(Boolean);
  return lines
    .filter((line, i) => {
      if (META_RE.test(line)) return false;
      if (i === 0 && HOTEL_NAME_RE.test(line) && !line.match(/^\d/)) return false;
      return true;
    })
    .join(', ');
}

// Extracts the most recognisable city/suburb from a comma-joined address string.
const STATE_COUNTRY_RE = /^(QLD|NSW|VIC|SA|WA|TAS|NT|ACT|Queensland|New South Wales|Victoria|South Australia|Western Australia|Tasmania|Australien|Australia|Katar|Qatar)\b/i;
const STREET_KEYWORD_RE = /\b(drive|dr|road|rd|street|st\b|avenue|ave|esplanade|way|lane|place|court|ct|boulevard|blvd|highway|hwy)\b/i;

function extractCity(address: string): string {
  if (!address) return '';
  for (const seg of address.split(',').map(s => s.trim()).filter(Boolean)) {
    if (STATE_COUNTRY_RE.test(seg)) continue;
    // Strip leading 4-digit postcode (e.g. "4879 Trinity Beach")
    const s = seg.replace(/^\d{4,5}\s+/, '').trim();
    if (/^(\d|cnr\b|corner\b)/i.test(s)) continue; // street number or "Cnr"
    if (STREET_KEYWORD_RE.test(s)) continue;        // street name
    if (s.length >= 3) return s;
  }
  return '';
}

function dateStrToKey(s: string | null): number {
  if (!s) return 99999999;
  const m = s.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (m) return parseInt(m[3]) * 10000 + parseInt(m[2]) * 100 + parseInt(m[1]);
  return 99999999;
}

function keyToDateStr(key: number): string {
  const year  = Math.floor(key / 10000);
  const month = Math.floor((key % 10000) / 100);
  const day   = key % 100;
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
}

function parseSortKey(value: string): number {
  const ci = parseCheckDate(value, 'in');
  if (ci) return dateStrToKey(ci);
  // Transit "Nacht: 10./11.08.2026" — take first date found
  const m = value.match(/(\d{1,2})\.\/?(?:\d{1,2}\.)?(\d{2})\.(\d{4})/);
  if (m) return parseInt(m[3]) * 10000 + parseInt(m[2]) * 100 + parseInt(m[1]);
  return 99999999;
}

function formatPeriod(inKey: number, outKey: number): string {
  const inStr  = keyToDateStr(inKey);
  const outStr = keyToDateStr(outKey);
  return `${inStr.slice(0, 5)} – ${outStr.slice(0, 5)}.${outStr.slice(6)}`;
}

// ─── Key-info type detection & sorting ───────────────────────────────────────

type KiType = 'transit' | 'car_rental' | 'accommodation' | 'other';

function detectKiType(ki: { label: string; value: string }): KiType {
  const lbl = ki.label.toLowerCase();
  const val = ki.value.toLowerCase();
  if (/mietwagen|camper|wohnmobil|car hire|rental car/i.test(lbl)) return 'car_rental';
  if (/transit|stpc|stopover/i.test(lbl)) return 'transit';
  if (/check-in|check-out/i.test(val)) return 'accommodation';
  if (/hotel|lodge|resort|park|hostel|camp|pension|b&b|big4|tasman|coral|garden/i.test(lbl)) return 'accommodation';
  return 'other';
}

const KI_TYPE_ORDER: Record<KiType, number> = { transit: 0, car_rental: 1, accommodation: 2, other: 9 };

const KI_TYPE_STYLE: Record<KiType, { dot: string; label: string }> = {
  transit:       { dot: 'bg-amber-400',   label: 'Transit' },
  car_rental:    { dot: 'bg-sky-400',     label: 'Mietwagen' },
  accommodation: { dot: 'bg-emerald-400', label: 'Unterkunft' },
  other:         { dot: 'bg-slate-300',   label: 'Info' },
};

function sortKeyInfos(keyInfos: { label: string; value: string; id: string; position: number }[]) {
  return [...keyInfos].sort((a, b) => {
    const aDate = parseSortKey(a.value);
    const bDate = parseSortKey(b.value);
    if (aDate !== bDate) return aDate - bDate;
    return KI_TYPE_ORDER[detectKiType(a)] - KI_TYPE_ORDER[detectKiType(b)];
  });
}

// ─────────────────────────────────────────────────────────────────────────────

type TableRow =
  | { kind: 'accom'; period: string; name: string; city: string; address: string }
  | { kind: 'gap';   period: string };

function AccommodationTable({ keyInfos }: { keyInfos: TripKeyInfo[] }) {
  const accomRows = keyInfos
    .filter(ki => !ki.label.toLowerCase().includes('mietwagen'))
    .map(ki => {
      const checkIn  = parseCheckDate(ki.value, 'in');
      const checkOut = parseCheckDate(ki.value, 'out');
      const inKey    = checkIn ? dateStrToKey(checkIn) : parseSortKey(ki.value);
      const outKey   = checkOut ? dateStrToKey(checkOut) : 99999999;
      const period   = checkIn && checkOut
        ? formatPeriod(inKey, outKey)
        : checkIn ?? checkOut ?? '–';
      const address  = extractAddress(ki.value);
      const city     = extractCity(address);
      return { inKey, outKey, name: ki.label, city, address, period };
    })
    .sort((a, b) => a.inKey - b.inKey);

  if (accomRows.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">Keine Unterkünfte erfasst.</p>;
  }

  // Interleave gap rows wherever consecutive entries don't connect
  const rows: TableRow[] = [];
  for (let i = 0; i < accomRows.length; i++) {
    const cur = accomRows[i];
    rows.push({ kind: 'accom', period: cur.period, name: cur.name, city: cur.city, address: cur.address });
    const next = accomRows[i + 1];
    if (next && cur.outKey < 99999999 && next.inKey > cur.outKey) {
      rows.push({ kind: 'gap', period: formatPeriod(cur.outKey, next.inKey) });
    }
  }

  const thCls = 'text-left text-xs font-semibold text-slate-400 uppercase tracking-wide pb-2';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className={`${thCls} pr-5 whitespace-nowrap`}>Zeitraum</th>
            <th className={`${thCls} pr-5`}>Unterkunft</th>
            <th className={`${thCls} hidden sm:table-cell`}>Adresse</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) =>
            row.kind === 'gap' ? (
              <tr key={i} className="border-t border-dashed border-amber-200 bg-amber-50/50">
                <td className="py-2 pr-5 text-amber-400 font-mono text-xs whitespace-nowrap align-top">{row.period}</td>
                <td className="py-2 pr-5 text-amber-400 text-xs italic align-top" colSpan={2}>
                  Unterkunft fehlt noch
                </td>
              </tr>
            ) : (
              <tr key={i} className="border-t border-slate-50">
                <td className="py-2.5 pr-5 text-slate-500 font-mono text-xs whitespace-nowrap align-top">{row.period}</td>
                <td className="py-2.5 pr-5 align-top">
                  <div className="text-slate-800 font-medium">{row.name}</div>
                  {row.city && <div className="text-xs text-slate-400 mt-0.5">{row.city}</div>}
                </td>
                <td className="py-2.5 text-slate-400 text-xs align-top hidden sm:table-cell">
                  {row.address ? (
                    <a href={mapsUrl(`${row.name} ${row.address}`)} target="_blank" rel="noopener noreferrer"
                       className="hover:text-indigo-500 hover:underline transition-colors">
                      {row.address}
                    </a>
                  ) : null}
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TripDetailSkeleton() {
  return (
    <div className="max-w-3xl mx-auto animate-pulse">
      <div className="h-4 w-24 bg-slate-100 rounded mb-8" />
      <div className="aspect-[16/7] bg-slate-100 rounded-2xl mb-6" />
      <div className="space-y-3 mb-8">
        <div className="h-7 w-2/3 bg-slate-100 rounded" />
        <div className="h-4 w-1/3 bg-slate-100 rounded" />
        <div className="h-4 w-full bg-slate-50 rounded mt-2" />
        <div className="h-4 w-5/6 bg-slate-50 rounded" />
      </div>
      <div className="h-48 bg-slate-100 rounded-2xl" />
    </div>
  );
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-150',
        'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1',
        active
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100',
      ].join(' ')}
      aria-selected={active}
      role="tab"
    >
      {children}
    </button>
  );
}

// ─── Sub-tab button ──────────────────────────────────────────────────────────

function SubTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors duration-150',
        'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1',
        active
          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50',
      ].join(' ')}
      aria-selected={active}
      role="tab"
    >
      {children}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type MainTab = 'packing' | 'itinerary' | 'documents' | 'transport' | 'map';
type PackingSubTab = 'shared' | 'personal';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TripDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [legs, setLegs] = useState<TransportLeg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [activeTab, setActiveTab] = useState<MainTab>('packing');
  const [packingSubTab, setPackingSubTab] = useState<PackingSubTab>('shared');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [tripData, userData, legsData] = await Promise.all([
          getTrip(id),
          getCurrentUser(),
          getLegs(id),
        ]);
        setTrip(tripData);
        setCurrentUser(userData);
        setLegs(legsData);
      } catch {
        setError('Reise nicht gefunden oder kein Zugriff.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleDelete() {
    if (!trip || deleting) return;
    setDeleting(true);
    try {
      await deleteTrip(trip.id);
      router.push('/travel');
    } catch {
      console.error('Failed to delete trip');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  // ─── Loading / error states ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <TripDetailSkeleton />
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="max-w-3xl mx-auto">
        <Link
          href="/travel"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900
                     transition-colors mb-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Zurück zu Reisen
        </Link>
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-red-700 text-sm">
          {error ?? 'Reise nicht gefunden.'}
        </div>
      </div>
    );
  }

  const dateRange = formatDateRange(trip.startDate, trip.endDate);
  const gradient = getGradient(trip.destination);
  const sortedKeyInfos = sortKeyInfos(trip.keyInfos);
  const canDelete =
    !currentUser ||
    currentUser.role === 'ADMIN' ||
    trip.createdBy.id === currentUser.id;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back link */}
      <Link
        href="/travel"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900
                   transition-colors mb-6 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Zurück zu Reisen
      </Link>

      {/* Cover image / gradient fallback */}
      <div className="relative w-full aspect-[16/7] rounded-2xl overflow-hidden bg-slate-100 mb-6">
        {trip.coverPhotoUrl ? (
          <Image
            src={trip.coverPhotoUrl}
            alt={trip.destination}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 768px"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}
            aria-hidden="true"
          >
            <span className="text-6xl font-bold text-white/30 select-none uppercase tracking-widest">
              {trip.destination.slice(0, 2)}
            </span>
          </div>
        )}
      </div>

      {/* Trip header card */}
      <div className="glass rounded-3xl overflow-hidden mb-4">
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-slate-900 leading-snug tracking-tight">
                {trip.destination}
              </h1>
              {trip.title && trip.title !== trip.destination && (
                <p className="text-sm text-slate-500 mt-0.5">{trip.title}</p>
              )}
              <p className="text-sm text-slate-400 mt-1">{dateRange}</p>
            </div>

            {/* Creator badge */}
            <div className="shrink-0 flex items-center gap-1.5">
              <div
                className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold"
                title={`Erstellt von ${trip.createdBy.name}`}
                aria-label={`Erstellt von ${trip.createdBy.name}`}
              >
                {trip.createdBy.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
            </div>
          </div>

          {/* Description */}
          {trip.description && (
            <p className="mt-4 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
              {trip.description}
            </p>
          )}
        </div>

        {/* Key info section */}
        {sortedKeyInfos.length > 0 && (
          <>
            <div className="border-t border-slate-100" />
            <div className="px-6 py-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                Wichtige Infos
              </h2>
              <dl className="space-y-2">
                {sortedKeyInfos.map((info) => {
                  const { dot, label: typeLabel } = KI_TYPE_STYLE[detectKiType(info)];
                  return (
                    <div key={info.id} className="flex items-start gap-3">
                      <dt className="flex items-center gap-1.5 w-36 shrink-0 pt-0.5 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} title={typeLabel} />
                        <span className="text-xs font-medium text-slate-500 truncate">{info.label}</span>
                      </dt>
                      <dd className="text-sm text-slate-800 flex-1 whitespace-pre-line"><KeyInfoValue info={info} /></dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          </>
        )}

        {/* Delete footer */}
        {canDelete && (
          <>
            <div className="border-t border-slate-100" />
            <div className="px-6 py-4 flex justify-end">
              {showDeleteConfirm ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600">Diese Reise löschen?</span>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800
                               border border-slate-200 rounded-lg
                               focus:outline-none focus:ring-2 focus:ring-slate-400
                               transition-all duration-150"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                               text-white bg-red-600 hover:bg-red-700 rounded-lg
                               disabled:opacity-60 disabled:cursor-not-allowed
                               focus:outline-none focus:ring-2 focus:ring-red-500
                               transition-all duration-150"
                  >
                    {deleting ? 'Wird gelöscht…' : 'Ja, löschen'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                             text-red-500 hover:text-red-700 hover:bg-red-50
                             border border-transparent hover:border-red-200
                             focus:outline-none focus:ring-2 focus:ring-red-400
                             transition-all duration-150"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                  Reise löschen
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Main tabs */}
      <div className="overflow-x-auto scrollbar-hide -mx-1 px-1 mb-4">
        <div
          className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl w-fit"
          role="tablist"
          aria-label="Reisebereiche"
        >
          <TabButton active={activeTab === 'packing'} onClick={() => setActiveTab('packing')}>
            Packliste
          </TabButton>
          <TabButton active={activeTab === 'itinerary'} onClick={() => setActiveTab('itinerary')}>
            Reiseplan
          </TabButton>
          <TabButton active={activeTab === 'transport'} onClick={() => setActiveTab('transport')}>
            Transport
          </TabButton>
          <TabButton active={activeTab === 'map'} onClick={() => setActiveTab('map')}>
            Karte
          </TabButton>
          <TabButton active={activeTab === 'documents'} onClick={() => setActiveTab('documents')}>
            Dokumente
          </TabButton>
        </div>
      </div>

      {/* Packing List tab */}
      {activeTab === 'packing' && (
        <div className="glass rounded-3xl overflow-hidden">
          {/* Packing sub-tabs */}
          <div className="flex items-center gap-2 px-6 pt-4 pb-3 border-b border-slate-100"
            role="tablist"
            aria-label="Packlisten-Typ"
          >
            <SubTabButton
              active={packingSubTab === 'shared'}
              onClick={() => setPackingSubTab('shared')}
            >
              Geteilt
            </SubTabButton>
            <SubTabButton
              active={packingSubTab === 'personal'}
              onClick={() => setPackingSubTab('personal')}
            >
              Meine Einträge
            </SubTabButton>
          </div>

          <div className="px-6 py-4">
            {packingSubTab === 'shared' ? (
              <PackingList
                key={`${id}-shared`}
                tripId={id}
                personal={false}
                currentUserId={currentUser?.id}
              />
            ) : (
              <PackingList
                key={`${id}-personal`}
                tripId={id}
                personal={true}
                currentUserId={currentUser?.id}
              />
            )}
          </div>
        </div>
      )}

      {/* Transport tab */}
      {activeTab === 'transport' && (
        <div className="glass rounded-3xl overflow-hidden">
          <div className="px-6 py-5">
            <TransportList tripId={id} />
          </div>
        </div>
      )}

      {/* Documents tab */}
      {activeTab === 'documents' && (
        <div className="glass rounded-3xl overflow-hidden">
          <div className="px-6 py-5">
            <DocumentsList tripId={id} emailToken={trip.emailToken} />
          </div>
        </div>
      )}

      {/* Map tab */}
      {activeTab === 'map' && (
        <div className="glass rounded-3xl overflow-hidden">
          <div className="px-6 pt-5 pb-2">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Reiseroute</h2>
            <TripMap
              tripId={id}
              legs={legs}
              keyInfos={sortedKeyInfos}
              destination={trip.destination}
            />
          </div>
          <div className="px-6 pb-5" />
        </div>
      )}

      {/* Itinerary tab */}
      {activeTab === 'itinerary' && (
        <div className="glass rounded-3xl overflow-hidden">
          <div className="px-6 py-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Unterkünfte</h2>
            <AccommodationTable keyInfos={sortedKeyInfos} />
          </div>
        </div>
      )}
    </div>
  );
}
