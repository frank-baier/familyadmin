'use client';

/**
 * Floating mobile header — shows brand mark + user avatar.
 * Hidden on md+ screens (desktop uses the sidebar).
 */

import Link from 'next/link';
import { useUser } from '@/lib/user-context';

export function MobileHeader() {
  const { user } = useUser();

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '·';

  return (
    <header className="md:hidden fixed top-0 inset-x-0 z-30 pt-safe px-3 pb-2">
      <div className="glass rounded-[1.5rem] pl-3 pr-2 py-2 flex items-center justify-between gap-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 min-w-0 rounded-xl px-1 py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label="FamilyAdmin home"
        >
          <span
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background:
                'linear-gradient(135deg, #6366f1 0%, #8b5cf6 60%, #a855f7 100%)',
              boxShadow: '0 6px 16px rgb(99 102 241 / 0.35)',
            }}
            aria-hidden="true"
          >
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"
              />
            </svg>
          </span>
          <span className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-slate-900 leading-tight truncate">
              FamilyAdmin
            </span>
            <span className="text-[0.6875rem] text-slate-500 leading-tight truncate">
              Baier family
            </span>
          </span>
        </Link>

        <Link
          href="/profile"
          aria-label={user?.name ? `Signed in as ${user.name}` : 'Your profile'}
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[0.75rem] font-bold
                     text-indigo-700 bg-gradient-to-br from-indigo-100 to-violet-100
                     border border-white/70
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1
                     transition-transform duration-150 active:scale-95"
        >
          {initials}
        </Link>
      </div>
    </header>
  );
}
