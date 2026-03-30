'use client';

/**
 * TripCard — compact trip summary card for the trip list.
 * Shows: cover photo (or gradient fallback), destination, date range, days-until badge.
 * Click navigates to /travel/[id].
 */

import Link from 'next/link';
import Image from 'next/image';
import type { Trip } from '@/lib/travel';

// ─── Palette ─────────────────────────────────────────────────────────────────

// 6 gradient pairs: [from, to] — indigo, violet, teal, amber, rose, emerald
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

// ─── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Format two dates as "23 Jul – 3 Aug 2025" or "23–30 Jul 2025" if same month/year.
 */
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

/**
 * Returns "In X days", "In progress", or "X days ago".
 * Dates compared at midnight local time to avoid timezone drift.
 */
function getDaysUntil(startStr: string, endStr: string): { label: string; variant: 'upcoming' | 'active' | 'past' } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T00:00:00`);

  if (start > today) {
    const diff = Math.round((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { label: `In ${diff} day${diff !== 1 ? 's' : ''}`, variant: 'upcoming' };
  }
  if (end >= today) {
    return { label: 'In progress', variant: 'active' };
  }
  const diff = Math.round((today.getTime() - end.getTime()) / (1000 * 60 * 60 * 24));
  return { label: `${diff} day${diff !== 1 ? 's' : ''} ago`, variant: 'past' };
}

// ─── Component ──────────────────────────────────────────────────────────────

interface TripCardProps {
  trip: Trip;
}

export function TripCard({ trip }: TripCardProps) {
  const gradient = getGradient(trip.destination);
  const dateRange = formatDateRange(trip.startDate, trip.endDate);
  const { label: daysLabel, variant } = getDaysUntil(trip.startDate, trip.endDate);

  const badgeClasses = {
    upcoming:
      'bg-indigo-100 text-indigo-700',
    active:
      'bg-emerald-100 text-emerald-700',
    past:
      'bg-slate-100 text-slate-500',
  }[variant];

  return (
    <Link
      href={`/travel/${trip.id}`}
      className="group flex flex-col bg-white rounded-2xl border border-slate-100
                 hover:border-slate-200 hover:shadow-md hover:shadow-slate-100/80
                 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                 transition-all duration-200 overflow-hidden cursor-pointer"
      aria-label={`Trip to ${trip.destination}: ${dateRange}`}
    >
      {/* Cover image / gradient fallback */}
      <div className="relative w-full aspect-[16/7] overflow-hidden shrink-0">
        {trip.coverPhotoUrl ? (
          <Image
            src={trip.coverPhotoUrl}
            alt={trip.destination}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}
            aria-hidden="true"
          >
            <span className="text-4xl font-bold text-white/30 select-none uppercase tracking-widest">
              {trip.destination.slice(0, 2)}
            </span>
          </div>
        )}

        {/* Days badge overlaid on image */}
        <div className="absolute top-3 right-3">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${badgeClasses}`}>
            {daysLabel}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1.5 p-4 flex-1">
        {/* Destination */}
        <h3 className="text-sm font-semibold text-slate-900 leading-snug
                       group-hover:text-indigo-700 transition-colors line-clamp-1">
          {trip.destination}
        </h3>

        {/* Title (if different from destination) */}
        {trip.title && trip.title !== trip.destination && (
          <p className="text-xs text-slate-500 line-clamp-1">{trip.title}</p>
        )}

        {/* Date range */}
        <p className="text-xs text-slate-400 mt-auto pt-1">{dateRange}</p>
      </div>
    </Link>
  );
}
