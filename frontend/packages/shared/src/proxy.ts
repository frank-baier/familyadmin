/**
 * Request proxy shared by all FamilyAdmin apps.
 *
 * 1. Module hosts: "/" opens the module; paths of other modules (or of the portal) are
 *    sent to their host. On the portal host, paths of modules that run as their own app
 *    are sent to that app's subdomain.
 * 2. Route protection: unauthenticated visitors of non-public paths go to /login,
 *    authenticated visitors of /login go to the host's start page. Authentication is
 *    judged by the refresh_token cookie set by the backend.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { moduleOfPath, parseHost, targetHost } from './modules';

const COMMON_PUBLIC_PATHS = ['/login', '/manifest.webmanifest', '/apple-icon', '/icon'];

export interface ProxyOptions {
  /** Module keys whose pages this app renders itself. */
  serves: string[];
  /** Extra paths reachable without login. */
  publicPaths?: string[];
}

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function createProxy({ serves, publicPaths = [] }: ProxyOptions) {
  const publicList = [...COMMON_PUBLIC_PATHS, ...publicPaths];

  return function proxy(request: NextRequest): NextResponse {
    const { pathname, search } = request.nextUrl;
    const host = request.headers.get('host') ?? '';
    const { module } = parseHost(host);
    const protocol = request.headers.get('x-forwarded-proto') ?? 'http';

    if (module && pathname === '/') {
      return NextResponse.redirect(`${protocol}://${host}/${module.key}${search}`);
    }

    const target = targetHost(pathname, host);
    if (target) {
      const owner = moduleOfPath(pathname);
      const servedElsewhere = owner !== null && !serves.includes(owner);
      if (module || servedElsewhere) {
        return NextResponse.redirect(`${protocol}://${target}${pathname}${search}`);
      }
    }

    const isAuthenticated = Boolean(request.cookies.get('refresh_token')?.value);

    // Authenticated user visiting /login → send to the start page.
    // Not when ?next= is set: the app only sends users there after its token refresh failed,
    // so the cookie is unusable — bouncing back would reload the page in an endless loop.
    if (isAuthenticated && matches(pathname, '/login') && !request.nextUrl.searchParams.has('next')) {
      return NextResponse.redirect(new URL(module ? `/${module.key}` : '/dashboard', request.url));
    }

    // Unauthenticated user visiting a protected route → send to /login
    if (!isAuthenticated && !publicList.some((p) => matches(pathname, p))) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  };
}
