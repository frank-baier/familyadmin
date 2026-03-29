/**
 * Dashboard — welcome page after login.
 * Shows module cards for all 5 modules.
 * Server Component.
 */

import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard — FamilyAdmin',
};

interface ModuleCard {
  title: string;
  description: string;
  href: string;
  status: 'active' | 'coming-soon';
  icon: React.ReactNode;
  color: {
    bg: string;
    icon: string;
    badge: string;
    badgeText: string;
  };
}

const modules: ModuleCard[] = [
  {
    title: 'Tasks',
    description: 'Shared to-dos, chores, and assignments for the whole family. Stay on top of what needs to get done.',
    href: '/tasks',
    status: 'coming-soon',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: {
      bg: 'bg-emerald-50',
      icon: 'text-emerald-600',
      badge: 'bg-emerald-100',
      badgeText: 'text-emerald-700',
    },
  },
  {
    title: 'Recipes',
    description: 'Save and share family recipes. Plan meals, build shopping lists, and keep everyone fed.',
    href: '/recipes',
    status: 'coming-soon',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-1.5-.75M3 16.5v-2.625a4.125 4.125 0 014.125-4.125h9.75A4.125 4.125 0 0121 13.875V16.5" />
      </svg>
    ),
    color: {
      bg: 'bg-orange-50',
      icon: 'text-orange-500',
      badge: 'bg-orange-100',
      badgeText: 'text-orange-700',
    },
  },
  {
    title: 'Travel',
    description: 'Plan trips, track itineraries, and manage bookings for family adventures near and far.',
    href: '/travel',
    status: 'coming-soon',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
    color: {
      bg: 'bg-sky-50',
      icon: 'text-sky-500',
      badge: 'bg-sky-100',
      badgeText: 'text-sky-700',
    },
  },
  {
    title: 'Documents',
    description: 'Securely store and share important family documents — insurance, certificates, and more.',
    href: '/documents',
    status: 'coming-soon',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    color: {
      bg: 'bg-violet-50',
      icon: 'text-violet-500',
      badge: 'bg-violet-100',
      badgeText: 'text-violet-700',
    },
  },
];

export default function DashboardPage() {
  const greeting = getTimeBasedGreeting();

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          {greeting}, Baier family!
        </h1>
        <p className="text-slate-500 mt-2 text-base">
          Welcome to FamilyAdmin — your family&apos;s private hub.
        </p>
      </div>

      {/* Module grid */}
      <section aria-labelledby="modules-heading">
        <h2 id="modules-heading" className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
          Modules
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {modules.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className="group flex flex-col gap-4 bg-white rounded-2xl p-6 border border-slate-100
                         hover:border-slate-200 hover:shadow-md hover:shadow-slate-100
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                         transition-all duration-200 cursor-pointer"
            >
              {/* Icon + badge row */}
              <div className="flex items-start justify-between">
                <div className={`w-11 h-11 rounded-xl ${mod.color.bg} flex items-center justify-center`}>
                  <span className={`w-6 h-6 ${mod.color.icon}`}>
                    {mod.icon}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium
                               ${mod.color.badge} ${mod.color.badgeText}`}
                >
                  {mod.status === 'active' ? 'Active' : 'Coming soon'}
                </span>
              </div>

              {/* Text */}
              <div>
                <h3 className="text-base font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">
                  {mod.title}
                </h3>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  {mod.description}
                </p>
              </div>

              {/* Arrow indicator */}
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 group-hover:text-indigo-600 transition-colors mt-auto">
                <span>Explore</span>
                <svg
                  className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Quick stats bar */}
      <section aria-labelledby="stats-heading" className="mt-10">
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h2 id="stats-heading" className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
            Family overview
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { label: 'Members', value: '5', sub: 'Baier family' },
              { label: 'Tasks', value: '—', sub: 'Not yet set up' },
              { label: 'Recipes', value: '—', sub: 'Not yet set up' },
              { label: 'Documents', value: '—', sub: 'Not yet set up' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-sm font-medium text-slate-600 mt-0.5">{stat.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{stat.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function getTimeBasedGreeting(): string {
  // Safe for server-side rendering — uses a fixed hour range
  // In a real app you'd use the user's timezone
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
