import { createProxy } from '@familyadmin/shared/proxy';

// Sport app: serves sport.<portal>; everything else is redirected to its own host.
export const proxy = createProxy({
  serves: ['sport'],
});

export const config = {
  matcher: ['/((?!api|uploads|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
