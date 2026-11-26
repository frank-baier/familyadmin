import { createProxy } from '@familyadmin/shared/proxy';

// The portal renders no module itself any more: every module runs as its own app on <module>.<portal>.
export const proxy = createProxy({
  serves: [],
});

export const config = {
  matcher: ['/((?!api|uploads|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
