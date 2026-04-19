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
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getTrip, deleteTrip } from '@/lib/travel';
import { getCurrentUser } from '@/lib/auth';
import { PackingList } from '@/components/travel/PackingList';
import type { Trip } from '@/lib/travel';
import type { User } from '@/lib/auth';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateRange(startStr: string, endStr: string): string {
  const start = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T00:00:00`);

  const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric' });
  const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'short' });
  const yearFmt = new Intl.DateTimeFormat('en-GB', { year: 'numeric' });

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

type MainTab = 'packing' | 'itinerary';
type PackingSubTab = 'shared' | 'personal';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TripDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
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
        const [tripData, userData] = await Promise.all([
          getTrip(id),
          getCurrentUser(),
        ]);
        setTrip(tripData);
        setCurrentUser(userData);
      } catch {
        setError('Trip not found or you do not have access.');
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
          Back to Travel
        </Link>
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-red-700 text-sm">
          {error ?? 'Trip not found.'}
        </div>
      </div>
    );
  }

  const dateRange = formatDateRange(trip.startDate, trip.endDate);
  const gradient = getGradient(trip.destination);
  const sortedKeyInfos = [...trip.keyInfos].sort((a, b) => a.position - b.position);
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
        Back to Travel
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
                title={`Created by ${trip.createdBy.name}`}
                aria-label={`Created by ${trip.createdBy.name}`}
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
                Key info
              </h2>
              <dl className="space-y-2">
                {sortedKeyInfos.map((info) => (
                  <div key={info.id} className="flex items-start gap-3">
                    <dt className="text-xs font-medium text-slate-500 w-32 shrink-0 pt-0.5">
                      {info.label}
                    </dt>
                    <dd className="text-sm text-slate-800 flex-1">{info.value}</dd>
                  </div>
                ))}
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
                  <span className="text-sm text-slate-600">Delete this trip?</span>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800
                               border border-slate-200 rounded-lg
                               focus:outline-none focus:ring-2 focus:ring-slate-400
                               transition-all duration-150"
                  >
                    Cancel
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
                    {deleting ? 'Deleting…' : 'Yes, delete'}
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
                  Delete trip
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Main tabs */}
      <div
        className="flex items-center gap-2 mb-4 p-1 bg-slate-100 rounded-xl w-fit"
        role="tablist"
        aria-label="Trip sections"
      >
        <TabButton active={activeTab === 'packing'} onClick={() => setActiveTab('packing')}>
          Packing List
        </TabButton>
        <TabButton active={activeTab === 'itinerary'} onClick={() => setActiveTab('itinerary')}>
          Itinerary
        </TabButton>
      </div>

      {/* Packing List tab */}
      {activeTab === 'packing' && (
        <div className="glass rounded-3xl overflow-hidden">
          {/* Packing sub-tabs */}
          <div className="flex items-center gap-2 px-6 pt-4 pb-3 border-b border-slate-100"
            role="tablist"
            aria-label="Packing list type"
          >
            <SubTabButton
              active={packingSubTab === 'shared'}
              onClick={() => setPackingSubTab('shared')}
            >
              Shared
            </SubTabButton>
            <SubTabButton
              active={packingSubTab === 'personal'}
              onClick={() => setPackingSubTab('personal')}
            >
              My Items
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

      {/* Itinerary tab — placeholder for 04-03 */}
      {activeTab === 'itinerary' && (
        <div className="glass rounded-3xl overflow-hidden">
          <div className="px-6 py-12 text-center">
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-slate-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5m-9-6h.008v.008H12V12zm0 3h.008v.008H12v-.008zm0 3h.008v.008H12v-.008zm-3-6h.008v.008H9V12zm0 3h.008v.008H9v-.008zm0 3h.008v.008H9v-.008zm6-6h.008v.008H15V12zm0 3h.008v.008H15v-.008zm0 3h.008v.008H15v-.008z"
                />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-500 mb-1">Itinerary coming soon</p>
            <p className="text-xs text-slate-400">Day-by-day planning will be available shortly.</p>
          </div>
        </div>
      )}
    </div>
  );
}
