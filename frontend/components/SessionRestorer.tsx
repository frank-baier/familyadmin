'use client';

/**
 * Runs on every page load inside the app shell.
 * Attempts a silent token refresh using the HttpOnly refresh_token cookie.
 * If it fails (cookie expired/missing), redirects to /login.
 * On success, fetches /api/auth/me and stores the user in UserContext.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { useUser } from '@/lib/user-context';

export function SessionRestorer() {
  const router = useRouter();
  const { setUser, setSessionReady } = useUser();

  useEffect(() => {
    async function restore() {
      // apiFetch inside getCurrentUser handles 401 → refresh → retry automatically.
      // This shares the singleton refresh promise with any concurrent apiFetch calls.
      const me = await getCurrentUser();
      if (!me) {
        router.push('/login');
        return;
      }
      setUser(me);
      setSessionReady(true);
    }

    restore();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
