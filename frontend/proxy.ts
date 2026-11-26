/**
 * Request proxy for FamilyAdmin
 *
 * 1. Module subdomains: "/" opens the module, paths of other modules (or of the portal)
 *    are sent to their host. The portal serves everything.
 * 2. Route protection: unauthenticated visitors of non-public paths go to /login,
 *    authenticated visitors of /login go to the host's start page. Authentication is
 *    judged by the refresh_token cookie set by the backend.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { parseHost, targetHost } from '@/lib/modules';

// Paths where unauthenticated access is allowed
const PUBLIC_PATHS = ['/login', '/tasks/preview', '/share', '/manifest.webmanifest', '/apple-icon'];

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get('host') ?? '';
  const { module } = parseHost(host);

  if (module) {
    const protocol = request.headers.get('x-forwarded-proto') ?? 'http';
    if (pathname === '/') {
      return NextResponse.redirect(`${protocol}://${host}/${module.key}${search}`);
    }
    const target = targetHost(pathname, host);
    if (target) {
      return NextResponse.redirect(`${protocol}://${target}${pathname}${search}`);
    }
  }

  const isAuthenticated = Boolean(request.cookies.get('refresh_token')?.value);

  // Authenticated user visiting /login → send to the start page
  if (isAuthenticated && matches(pathname, '/login')) {
    return NextResponse.redirect(new URL(module ? `/${module.key}` : '/dashboard', request.url));
  }

  // Unauthenticated user visiting a protected route → send to /login
  if (!isAuthenticated && !PUBLIC_PATHS.some((p) => matches(pathname, p))) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|uploads|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
