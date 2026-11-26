import { createProxy } from '@familyadmin/shared/proxy';

// Finance app: serves finance.<portal>; everything else is redirected to its own host.
export const proxy = createProxy({
  serves: ['finance'],
});

export const config = {
  matcher: ['/((?!api|uploads|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
