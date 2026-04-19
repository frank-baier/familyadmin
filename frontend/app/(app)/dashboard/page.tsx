import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard — FamilyAdmin' };

interface Module {
  title: string;
  description: string;
  href: string;
  gradient: string;
  shadow: string;
  icon: React.ReactNode;
  accentText: string;
}

const modules: Module[] = [
  {
    title: 'Tasks',
    description: 'Shared to-dos, chores and assignments for the whole family.',
    href: '/tasks',
    gradient: 'from-indigo-500 via-violet-500 to-purple-600',
    shadow: '0 12px 32px rgb(99 102 241 / 0.35)',
    accentText: 'text-indigo-600',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Recipes',
    description: 'Save and share family recipes. Plan meals and build shopping lists.',
    href: '/recipes',
    gradient: 'from-orange-400 via-rose-500 to-pink-600',
    shadow: '0 12px 32px rgb(249 115 22 / 0.3)',
    accentText: 'text-orange-600',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-1.5-.75M3 16.5v-2.625a4.125 4.125 0 014.125-4.125h9.75A4.125 4.125 0 0121 13.875V16.5" />
      </svg>
    ),
  },
  {
    title: 'Travel',
    description: 'Plan trips, track itineraries and manage family adventures.',
    href: '/travel',
    gradient: 'from-sky-500 via-cyan-500 to-teal-500',
    shadow: '0 12px 32px rgb(14 165 233 / 0.3)',
    accentText: 'text-sky-600',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253" />
      </svg>
    ),
  },
  {
    title: 'Documents',
    description: 'Securely store and share important family documents.',
    href: '/documents',
    gradient: 'from-violet-500 via-fuchsia-500 to-purple-600',
    shadow: '0 12px 32px rgb(139 92 246 / 0.3)',
    accentText: 'text-violet-600',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
];

const stats = [
  { label: 'Family members', value: '5' },
  { label: 'Active tasks', value: '—' },
  { label: 'Recipes saved', value: '—' },
  { label: 'Trips planned', value: '—' },
];

export default function DashboardPage() {
  const greeting = getGreeting();

  return (
    <div className="max-w-2xl md:max-w-5xl mx-auto space-y-8">

      {/* Hero greeting */}
      <div className="glass rounded-3xl px-6 py-7 md:px-8 md:py-8 relative overflow-hidden">
        {/* Decorative blobs */}
        <div
          className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent 70%)' }}
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full opacity-15 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }}
          aria-hidden="true"
        />
        <div className="relative">
          <p className="section-label mb-2">Baier Family Hub</p>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">
            {greeting}
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Everything your family needs — in one place.
          </p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-2xl px-4 py-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Module grid */}
      <section aria-labelledby="modules-heading">
        <h2 id="modules-heading" className="section-label mb-4">Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {modules.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className="glass-interactive rounded-3xl overflow-hidden group focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              aria-label={mod.title}
            >
              {/* Gradient header band */}
              <div
                className={`h-24 bg-gradient-to-br ${mod.gradient} relative flex items-center justify-center overflow-hidden`}
                style={{ boxShadow: 'inset 0 -1px 0 rgb(0 0 0 / 0.08)' }}
              >
                <span className="w-10 h-10 text-white/90" aria-hidden="true">
                  {mod.icon}
                </span>
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: 'radial-gradient(circle at 70% 30%, rgb(255 255 255 / 0.18), transparent 60%)' }}
                  aria-hidden="true"
                />
              </div>

              {/* Content */}
              <div className="px-5 py-4">
                <h3 className={`text-base font-bold text-slate-900 group-hover:${mod.accentText} transition-colors`}>
                  {mod.title}
                </h3>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed line-clamp-2">
                  {mod.description}
                </p>
                <div className={`flex items-center gap-1 mt-3 text-xs font-semibold ${mod.accentText} opacity-0 group-hover:opacity-100 transition-opacity duration-200`}>
                  Open
                  <svg className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning, Baier family!';
  if (h < 17) return 'Good afternoon, Baier family!';
  return 'Good evening, Baier family!';
}
