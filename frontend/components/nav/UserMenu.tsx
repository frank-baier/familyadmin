'use client';

/**
 * UserMenu — shows the logged-in user's name and a logout button.
 * Lives at the bottom of the Sidebar.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { logout } from '@/lib/auth';

interface UserMenuProps {
  user?: {
    name: string;
    email: string;
    role: 'ADMIN' | 'MEMBER';
  } | null;
}

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      router.push('/login');
    }
  }

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <div className="border-t border-slate-100 pt-4 mt-2">
      {/* User info */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-xl mb-2">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
          <span className="text-sm font-semibold text-indigo-700">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">
            {user?.name ?? 'Family Member'}
          </p>
          {user?.role === 'ADMIN' && (
            <p className="text-xs text-indigo-500 font-medium">Admin</p>
          )}
        </div>
      </div>

      {/* Logout button — visually separated from primary nav */}
      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        aria-label="Sign out"
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500
                   hover:bg-red-50 hover:text-red-600
                   focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors duration-150 group"
      >
        <svg
          className="w-5 h-5 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
          />
        </svg>
        {isLoggingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  );
}
