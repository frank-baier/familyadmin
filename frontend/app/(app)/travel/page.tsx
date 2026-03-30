'use client';

/**
 * Travel list page — /travel
 * - Two sections: Upcoming (start_date >= today) and Past
 * - Grid of TripCards
 * - "Plan a Trip" button → /travel/new
 * - Empty state per section
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TripCard } from '@/components/travel/TripCard';
import { getTrips } from '@/lib/travel';
import type { Trip } from '@/lib/travel';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TripCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden animate-pulse">
      <div className="aspect-[16/7] bg-slate-100" />
      <div className="p-4 space-y-2">
        <div className="h-4 w-2/3 bg-slate-100 rounded" />
        <div className="h-3 w-1/2 bg-slate-50 rounded" />
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isUpcoming(trip: Trip): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(`${trip.startDate}T00:00:00`);
  return start >= today;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TravelPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getTrips();
      setTrips(data);
    } catch (err) {
      setError('Failed to load trips. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const upcoming = trips.filter(isUpcoming).sort(
    (a, b) => a.startDate.localeCompare(b.startDate),
  );
  const past = trips
    .filter((t) => !isUpcoming(t))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Travel</h1>
          <p className="text-slate-500 text-sm mt-1">Family trip planner</p>
        </div>

        <Link
          href="/travel/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                     bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                     transition-all duration-150 shadow-sm shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Plan a Trip
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6 flex items-center justify-between"
        >
          {error}
          <button
            onClick={load}
            className="ml-4 text-xs font-medium text-red-700 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-8">
          <div>
            <div className="h-4 w-28 bg-slate-100 rounded animate-pulse mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <TripCardSkeleton key={i} />)}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {!loading && (
        <div className="space-y-10">
          {/* Upcoming section */}
          <section aria-label="Upcoming trips">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
              Upcoming
            </h2>
            {upcoming.length === 0 ? (
              <div className="text-center py-12 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                      d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-700 mb-1">No upcoming trips</p>
                <p className="text-xs text-slate-500 mb-4">Time to plan your next adventure!</p>
                <Link
                  href="/travel/new"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold
                             bg-indigo-600 text-white hover:bg-indigo-700
                             focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                             transition-all duration-150"
                >
                  Plan a Trip
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcoming.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>
            )}
          </section>

          {/* Past section */}
          {past.length > 0 && (
            <section aria-label="Past trips">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
                Past trips
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-80">
                {past.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
