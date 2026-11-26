/**
 * Login redirects with a validated return target.
 *
 * Module apps (tasks., recipes., travel. …) send unauthenticated users to the central
 * login page with ?next=<where they came from>. After login we only follow `next` when it
 * points to this host or one of its subdomains — anything else would be an open redirect
 * that a crafted link could use to bounce a freshly logged-in user to a foreign site.
 */

import { parseHost } from './modules';

const DEFAULT_AFTER_LOGIN = '/dashboard';

/** URL of the login page that returns to the current page afterwards. */
export function loginUrlForCurrentPage(): string {
  if (typeof window === 'undefined') return '/login';
  const here = window.location.href;
  return `/login?next=${encodeURIComponent(here)}`;
}

/** Where to go after a successful login: a safe `next` target, else the host's start page. */
export function resolveAfterLogin(next: string | null, currentHost: string): string {
  const { module } = parseHost(currentHost);
  const fallback = module ? `/${module.key}` : DEFAULT_AFTER_LOGIN;
  if (!next) return fallback;

  // Relative path on this host — but not protocol-relative ("//evil.com") or "/\evil.com".
  if (next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')) {
    return next.startsWith('/login') ? fallback : next;
  }

  let url: URL;
  try {
    url = new URL(next);
  } catch {
    return fallback;
  }

  const host = url.hostname.toLowerCase();
  const self = currentHost.toLowerCase();
  const sameSite = host === self || host.endsWith(`.${self}`);
  const secureEnough = url.protocol === 'https:' || (url.protocol === 'http:' && isLocal(self));
  if (!sameSite || !secureEnough || url.username || url.password) return fallback;
  if (host === self && url.pathname.startsWith('/login')) return fallback;

  return url.toString();
}

function isLocal(host: string): boolean {
  return host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1';
}
