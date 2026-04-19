'use client';

/**
 * Mobile bottom tab bar.
 * Fixed to viewport, glass-styled, respects safe-area insets.
 * Shown only on small screens (md:hidden).
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Tab {
  label: string;
  href: string;
  matchPrefix?: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  {
    label: 'Home',
    href: '/dashboard',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
      </svg>
    ),
  },
  {
    label: 'Tasks',
    href: '/tasks',
    matchPrefix: '/tasks',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Recipes',
    href: '/recipes',
    matchPrefix: '/recipes',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-1.5-.75M3 16.5v-2.625a4.125 4.125 0 014.125-4.125h9.75A4.125 4.125 0 0121 13.875V16.5" />
      </svg>
    ),
  },
  {
    label: 'Travel',
    href: '/travel',
    matchPrefix: '/travel',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253" />
      </svg>
    ),
  },
  {
    label: 'Me',
    href: '/profile',
    matchPrefix: '/profile',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
];

function isActive(pathname: string, tab: Tab): boolean {
  if (tab.matchPrefix) {
    return pathname === tab.href || pathname.startsWith(`${tab.matchPrefix}/`);
  }
  return pathname === tab.href;
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 pb-safe px-3 pt-2"
    >
      <div
        className="glass-strong rounded-[1.75rem] px-1.5 py-1.5 flex items-center justify-between"
        style={{ boxShadow: '0 8px 30px rgb(15 23 42 / 0.12), 0 2px 8px rgb(15 23 42 / 0.06)' }}
      >
        {tabs.map((tab) => {
          const active = isActive(pathname, tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={[
                'relative flex-1 flex flex-col items-center justify-center gap-1',
                'py-2 rounded-2xl min-w-0',
                'transition-all duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
                active
                  ? 'text-white'
                  : 'text-slate-500 hover:text-slate-900 active:scale-95',
              ].join(' ')}
              style={
                active
                  ? {
                      background:
                        'linear-gradient(135deg, #6366f1 0%, #8b5cf6 60%, #a855f7 100%)',
                      boxShadow: '0 6px 16px rgb(99 102 241 / 0.4)',
                    }
                  : undefined
              }
            >
              <span className="w-6 h-6 shrink-0" aria-hidden="true">
                {tab.icon}
              </span>
              <span className="text-[0.625rem] font-semibold tracking-tight">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
