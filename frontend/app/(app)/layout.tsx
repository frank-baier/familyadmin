/**
 * App shell layout for authenticated pages.
 * Renders Sidebar (fixed left) + main content area.
 * Server Component — reads user from cookie for initial render.
 */

import { Sidebar } from '@/components/nav/Sidebar';
import { SessionRestorer } from '@/components/SessionRestorer';
import { UserProvider } from '@/lib/user-context';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <div className="flex min-h-dvh bg-slate-50">
        {/* Fixed sidebar */}
        <div className="fixed inset-y-0 left-0 z-40 w-64">
          <Sidebar />
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

          <SessionRestorer />
          <div className="p-8">
            {children}
          </div>
        </main>
      </div>
    </UserProvider>
  );
}
