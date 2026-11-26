import { createProxy } from '@familyadmin/shared/proxy';

// Recipes app: serves recipes.<portal>; everything else is redirected to its own host.
export const proxy = createProxy({
  serves: ['recipes'],
  publicPaths: ['/share'],
});

export const config = {
  matcher: ['/((?!api|uploads|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
