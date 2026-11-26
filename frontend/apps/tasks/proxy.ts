import { createProxy } from '@familyadmin/shared/proxy';

// Tasks app: serves tasks.<portal>; everything else is redirected to its own host.
export const proxy = createProxy({
  serves: ['tasks'],
  publicPaths: ['/tasks/preview'],
});

export const config = {
  matcher: ['/((?!api|uploads|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
