'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ModuleLink } from './ModuleLink';
import { useUser } from '../user-context';
import { useCanUse } from '../module-access';
import { logout } from '../auth';

interface Tab { label: string; href: string; adminOnly?: boolean }

/** In-app navigation per module (what used to be the sidebar sub-items). */
const TABS: Record<string, Tab[]> = {
  tasks: [{ label: 'Aufgaben', href: '/tasks' }, { label: 'Vorlagen', href: '/tasks/templates', adminOnly: true }],
  recipes: [{ label: 'Rezepte', href: '/recipes' }, { label: 'Mahlzeitenplan', href: '/recipes/meal-plan' }],
  documents: [{ label: 'Dokumente', href: '/documents' }, { label: 'Posteingang', href: '/documents/inbox' }, { label: 'KI Fragen', href: '/documents/ask' }],
};

/** Shell of a standalone module app: own header, no portal sidebar, access check. */
export function ModuleShell({ moduleKey, name, iconUrl, children }: {
  moduleKey: string; name: string; iconUrl: string; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, sessionReady } = useUser();
  const allowed = useCanUse(moduleKey);
  const tabs = (TABS[moduleKey] ?? []).filter((t) => !t.adminOnly || user?.role === 'ADMIN');
  const initials = user?.name ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '·';

  async function handleLogout() {
    try { await logout(); } finally { window.location.href = '/login'; }
  }

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-30 pt-safe px-3 pb-2 md:px-6 md:pt-4">
        <div className="max-w-5xl mx-auto bg-white rounded-xl pl-2 pr-2 py-2 flex items-center gap-3"
          style={{ border: '1px solid #e0e0dc', boxShadow: '0 2px 8px rgb(0 0 0 / 0.05)' }}>
          <Link href={`/${moduleKey}`} className="flex items-center gap-2.5 min-w-0 rounded-lg px-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={iconUrl} alt="" className="w-9 h-9 rounded-[10px] shrink-0" />
            <span className="text-base font-semibold text-stone-900 tracking-tight truncate">{name}</span>
          </Link>
          {allowed && tabs.length > 1 && (
            <nav aria-label={`${name} Navigation`} className="flex gap-1 overflow-x-auto">
              {tabs.map((t) => {
                const active = t.href === `/${moduleKey}`
                  ? pathname === t.href || (pathname.startsWith(`${t.href}/`) && !tabs.some((o) => o !== t && pathname.startsWith(o.href)))
                  : pathname === t.href || pathname.startsWith(`${t.href}/`);
                return (
                  <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined}
                    className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${active ? 'bg-blue-50 text-blue-800 font-semibold' : 'text-stone-600 hover:bg-stone-50'}`}>
                    {t.label}
                  </Link>
                );
              })}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-1 shrink-0">
            <ModuleLink href="/profile" aria-label={user?.name ? `Angemeldet als ${user.name}` : 'Profil'}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[0.75rem] font-semibold text-stone-600 bg-stone-100">
              {initials}
            </ModuleLink>
            <button type="button" onClick={handleLogout} aria-label="Abmelden" title="Abmelden"
              className="w-9 h-9 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="min-h-dvh pt-20 md:pt-24 pb-10">
        <div className="px-4 md:px-10 pt-4 max-w-6xl mx-auto">
          {!sessionReady || !user ? null : allowed ? children : (
            <div className="max-w-md mx-auto mt-16 bg-white rounded-2xl p-8 text-center"
              style={{ border: '1px solid #e0e0dc' }}>
              <h1 className="text-lg font-semibold text-stone-900">Kein Zugriff auf {name}</h1>
              <p className="text-sm text-stone-500 mt-2">
                Diese App ist für dein Konto nicht freigeschaltet. Frag einen Admin, wenn du sie brauchst.
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
