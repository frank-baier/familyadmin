/**
 * App shell layout for authenticated pages.
 * Renders Sidebar (fixed left) + main content area.
 * Server Component — reads user from cookie for initial render.
 */

import { cookies } from 'next/headers';
import { Sidebar } from '@/components/nav/Sidebar';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Attempt to read the user from the server-side cookie.
  // The full user object is stored as a signed JSON payload in the session cookie,
  // or we can decode it from the JWT. For now, pass null — the sidebar
  // renders gracefully with fallback initials.
  // In a future iteration, parse the JWT claims from the cookie.
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('auth_session');

  // Basic user info — future: decode JWT claims from auth_session
  // to avoid an extra /api/auth/me round-trip on every render.
  const user = sessionCookie ? null : null; // placeholder — renders fallback gracefully

  return (
    <div className="flex min-h-dvh bg-slate-50">
      {/* Fixed sidebar */}
      <div className="fixed inset-y-0 left-0 z-40 w-64">
        <Sidebar user={user} />
      </div>

      {/* Main content — offset by sidebar width */}
      <main
        id="main-content"
        className="flex-1 ml-64 min-h-dvh"
        tabIndex={-1}
      >
        {/* Skip to main content link for keyboard/screen reader users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-indigo-700 focus:rounded-lg focus:shadow-lg focus:text-sm focus:font-medium"
        >
          Skip to main content
        </a>

        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
