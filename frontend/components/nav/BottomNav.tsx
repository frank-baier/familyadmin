'use client';

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
    label: 'Start',
    href: '/dashboard',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
      </svg>
    ),
  },
  {
    label: 'Finanzen',
    href: '/finance',
    matchPrefix: '/finance',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.518l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
  },
  {
    label: 'Rezepte',
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
    label: 'Notizen',
    href: '/notes',
    matchPrefix: '/notes',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
      </svg>
    ),
  },
  {
    label: 'Profil',
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
      aria-label="Hauptnavigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 pb-safe px-3 pt-2"
    >
      <div
        className="bg-white rounded-2xl px-1.5 py-1.5 flex items-center justify-between"
        style={{ border: '1px solid #e0e0dc', boxShadow: '0 -2px 16px rgb(0 0 0 / 0.06), 0 1px 3px rgb(0 0 0 / 0.04)' }}
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
                'py-2 rounded-xl min-w-0',
                'transition-all duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1',
                active
                  ? 'text-white'
                  : 'text-stone-500 hover:text-stone-900 active:scale-95',
              ].join(' ')}
              style={
                active
                  ? { background: '#111111', boxShadow: '0 2px 8px rgb(0 0 0 / 0.25)' }
                  : undefined
              }
            >
              <span className="w-5 h-5 shrink-0" aria-hidden="true">
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
