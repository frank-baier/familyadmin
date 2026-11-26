import { createProxy } from '@familyadmin/shared/proxy';

// Modules still rendered by the portal; the others run as their own app on <module>.<portal>.
export const proxy = createProxy({
  serves: ['tasks', 'documents', 'finance'],
  publicPaths: ['/tasks/preview'],
});

export const config = {
  matcher: ['/((?!api|uploads|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
