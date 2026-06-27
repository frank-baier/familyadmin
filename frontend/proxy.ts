/**
 * Route protection middleware for FamilyAdmin
 *
 * - Protects all routes except /login (and static assets)
 * - Checks for auth_session cookie set by the backend on login
 * - Unauthenticated → redirect to /login
 * - Authenticated visiting /login → redirect to /dashboard
 *
 * Next.js 16: use async Request APIs (await cookies/headers)
 */

import { type NextRequest, NextResponse } from 'next/server';

// Paths where unauthenticated access is allowed
const PUBLIC_PATHS = ['/login', '/tasks/preview'];
// Paths where authenticated users should be bounced away (i.e. the login page)
const AUTH_BOUNCE_PATHS = ['/login'];

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  const authCookie = request.cookies.get('refresh_token');
  const isAuthenticated = Boolean(authCookie?.value);

  const isPublicPath = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const isAuthBouncePath = AUTH_BOUNCE_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  // Authenticated user visiting /login → send to /dashboard
  if (isAuthenticated && isAuthBouncePath) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Unauthenticated user visiting a protected route → send to /login
  if (!isAuthenticated && !isPublicPath) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
