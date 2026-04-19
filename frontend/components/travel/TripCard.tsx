'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { Trip } from '@/lib/travel';

const GRADIENTS = [
  'from-indigo-500 to-violet-600',
  'from-violet-500 to-purple-600',
  'from-teal-500 to-cyan-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-emerald-500 to-teal-600',
];

function getGradient(destination: string) {
  return GRADIENTS[destination.charCodeAt(0) % 6] ?? GRADIENTS[0];
}

function formatDateRange(startStr: string, endStr: string): string {
  const start = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T00:00:00`);
  const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric' });
  const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'short' });
  const yearFmt = new Intl.DateTimeFormat('en-GB', { year: 'numeric' });
  const startDay = dayFmt.format(start), startMonth = monthFmt.format(start), startYear = yearFmt.format(start);
  const endDay = dayFmt.format(end), endMonth = monthFmt.format(end), endYear = yearFmt.format(end);
  if (startYear === endYear && startMonth === endMonth) return `${startDay}–${endDay} ${startMonth} ${startYear}`;
  if (startYear === endYear) return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${startYear}`;
  return `${startDay} ${startMonth} ${startYear} – ${endDay} ${endMonth} ${endYear}`;
}

function getDaysUntil(startStr: string, endStr: string): { label: string; variant: 'upcoming' | 'active' | 'past' } {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T00:00:00`);
  if (start > today) {
    const diff = Math.round((start.getTime() - today.getTime()) / 86400000);
    return { label: `In ${diff} day${diff !== 1 ? 's' : ''}`, variant: 'upcoming' };
  }
  if (end >= today) return { label: 'In progress', variant: 'active' };
  const diff = Math.round((today.getTime() - end.getTime()) / 86400000);
  return { label: `${diff} day${diff !== 1 ? 's' : ''} ago`, variant: 'past' };
}

export function TripCard({ trip }: { trip: Trip }) {
  const gradient = getGradient(trip.destination);
  const dateRange = formatDateRange(trip.startDate, trip.endDate);
  const { label: daysLabel, variant } = getDaysUntil(trip.startDate, trip.endDate);

  const badgeStyle = {
    upcoming: { bg: 'bg-white/90', text: 'text-indigo-700' },
    active: { bg: 'bg-emerald-500', text: 'text-white' },
    past: { bg: 'bg-black/30', text: 'text-white' },
  }[variant];

  return (
    <Link
      href={`/travel/${trip.id}`}
      className="glass-interactive rounded-3xl overflow-hidden flex flex-col group
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      aria-label={`Trip to ${trip.destination}: ${dateRange}`}
    >
      {/* Cover */}
      <div className="relative w-full aspect-[16/7] overflow-hidden shrink-0">
        {trip.coverPhotoUrl ? (
          <Image
            src={trip.coverPhotoUrl} alt={trip.destination} fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`} aria-hidden="true">
            <span className="text-5xl font-black text-white/20 select-none uppercase tracking-[0.15em]">
              {trip.destination.slice(0, 2)}
            </span>
          </div>
        )}
        <div className="absolute top-3 right-3">
          <span className={`pill backdrop-blur-md ${badgeStyle.bg} ${badgeStyle.text}`}>
            {daysLabel}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1.5 p-4 flex-1">
        <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-600 transition-colors line-clamp-1">
          {trip.destination}
        </h3>
        {trip.title && trip.title !== trip.destination && (
          <p className="text-xs text-slate-500 line-clamp-1">{trip.title}</p>
        )}
        <p className="text-xs text-slate-400 mt-auto pt-1">{dateRange}</p>
      </div>
    </Link>
  );
}
