import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { parseHost, targetHost } from '@/lib/modules';

/**
 * Keeps every module subdomain on its own content: "/" opens the module, paths of other
 * modules (or of the portal) are sent to their host. The portal serves everything.
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const { module } = parseHost(host);
  if (!module) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const protocol = request.headers.get('x-forwarded-proto') ?? 'http';

  if (pathname === '/') {
    return NextResponse.redirect(`${protocol}://${host}/${module.key}${search}`);
  }

  const target = targetHost(pathname, host);
  if (target) {
    return NextResponse.redirect(`${protocol}://${target}${pathname}${search}`);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|uploads|_next/static|_next/image|favicon.ico).*)'],
};
