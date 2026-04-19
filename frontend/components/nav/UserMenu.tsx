'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { logout } from '@/lib/auth';
import { useUser } from '@/lib/user-context';

export function UserMenu() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { user } = useUser();

  async function handleLogout() {
    setIsLoggingOut(true);
    try { await logout(); } finally { window.location.href = '/login'; }
  }

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div className="space-y-0.5">
      {/* User info row */}
      <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold text-indigo-700"
          style={{ background: 'linear-gradient(135deg, #e0e7ff, #ede9fe)' }}
          aria-hidden="true"
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {user?.name ?? 'Family Member'}
          </p>
          {user?.role === 'ADMIN' && (
            <p className="text-xs font-medium" style={{ color: '#6366f1' }}>Admin</p>
          )}
        </div>
      </div>

      <Link
        href="/profile"
        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-slate-500
                   hover:bg-white/50 hover:text-slate-900 transition-colors duration-150
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
        My Profile
      </Link>

      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        aria-label="Sign out"
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-slate-500
                   hover:bg-red-50/80 hover:text-red-600 transition-colors duration-150
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
        </svg>
        {isLoggingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  );
}
