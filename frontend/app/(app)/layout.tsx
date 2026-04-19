/**
 * App shell layout for authenticated pages.
 * Mobile-first: bottom tab bar + floating top header.
 * Desktop (md+): fixed glass sidebar on the left.
 */

import { Sidebar } from '@/components/nav/Sidebar';
import { BottomNav } from '@/components/nav/BottomNav';
import { MobileHeader } from '@/components/nav/MobileHeader';
import { SessionRestorer } from '@/components/SessionRestorer';
import { UserProvider } from '@/lib/user-context';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      {/* Skip link — keyboard/screen-reader first */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:px-4 focus:py-2 focus:bg-white focus:text-indigo-700 focus:rounded-xl focus:shadow-lg focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar — hidden below md */}
      <div className="hidden md:block fixed inset-y-0 left-0 z-40 w-72 p-4">
        <Sidebar />
      </div>

      {/* Mobile floating header — hidden md+ */}
      <MobileHeader />

      <SessionRestorer />

      <main
        id="main-content"
        tabIndex={-1}
        className="min-h-dvh md:pl-72 pt-20 md:pt-0 pb-28 md:pb-0"
      >
        <div className="px-4 md:px-10 pt-4 md:pt-10">
          {children}
        </div>
      </main>

      {/* Mobile bottom tab bar — hidden md+ */}
      <BottomNav />
    </UserProvider>
  );
}
