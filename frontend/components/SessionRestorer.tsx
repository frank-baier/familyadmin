'use client';

/**
 * Runs on every page load inside the app shell.
 * Attempts a silent token refresh using the HttpOnly refresh_token cookie.
 * If it fails (cookie expired/missing), redirects to /login.
 * On success, fetches /api/auth/me and stores the user in UserContext.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken, setAccessToken } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { useUser } from '@/lib/user-context';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

export function SessionRestorer() {
  const router = useRouter();
  const { user, setUser } = useUser();

  useEffect(() => {
    async function restore() {
      if (!getAccessToken()) {
        try {
          const res = await fetch(`${API_BASE}/api/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });
          if (!res.ok) {
            router.push('/login');
            return;
          }
          const data: { accessToken: string } = await res.json();
          setAccessToken(data.accessToken);
        } catch {
          router.push('/login');
          return;
        }
      }

      if (!user) {
        const me = await getCurrentUser();
        if (!me) {
          router.push('/login');
          return;
        }
        setUser(me);
      }
    }

    restore();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
