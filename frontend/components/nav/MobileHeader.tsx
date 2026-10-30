'use client';

import Link from 'next/link';
import { useUser } from '@/lib/user-context';

export function MobileHeader() {
  const { user } = useUser();

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '·';

  return (
    <header className="md:hidden fixed top-0 inset-x-0 z-30 pt-safe px-3 pb-2">
      <div
        className="bg-white rounded-xl pl-3 pr-2 py-2.5 flex items-center justify-between gap-3"
        style={{ border: '1px solid #e0e0dc', boxShadow: '0 2px 8px rgb(0 0 0 / 0.05)' }}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 min-w-0 rounded-lg px-1 py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          aria-label="FamilyAdmin Startseite"
        >
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-stone-900"
            aria-hidden="true"
          >
            <svg
              className="w-4 h-4 text-white"
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
            <span className="text-sm font-semibold text-stone-900 leading-tight tracking-tight truncate">
              FamilyAdmin
            </span>
            <span className="text-[0.65rem] text-stone-400 leading-tight truncate">
              Familie Baier
            </span>
          </span>
        </Link>

        <Link
          href="/profile"
          aria-label={user?.name ? `Angemeldet als ${user.name}` : 'Dein Profil'}
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[0.75rem] font-semibold
                     text-stone-600 bg-stone-100
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1
                     transition-opacity duration-150 active:opacity-70"
        >
          {initials}
        </Link>
      </div>
    </header>
  );
}
