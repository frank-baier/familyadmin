import { createProxy } from '@familyadmin/shared/proxy';

// Documents app: serves documents.<portal>; everything else is redirected to its own host.
export const proxy = createProxy({
  serves: ['documents'],
});

export const config = {
  matcher: ['/((?!api|uploads|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
