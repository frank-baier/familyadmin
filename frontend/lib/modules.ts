/**
 * Module subdomains: tasks.<portal>, recipes.<portal>, travel.<portal> …
 *
 * Phase 1 of the app split: one Next.js app answers on all hosts and paths stay the same
 * (travel.<portal>/travel/123). Pure functions only — used by the proxy, the server
 * (manifest, icons) and the browser.
 */

export interface AppModule {
  /** Subdomain label and first path segment. */
  key: string;
  name: string;
  color: string;
  /** SVG path (24x24, stroked) for the home screen icon. */
  icon: string;
}

export const MODULES: AppModule[] = [
  { key: 'tasks', name: 'Aufgaben', color: '#4f46e5',
    icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { key: 'recipes', name: 'Rezepte', color: '#e11d48',
    icon: 'M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-1.5-.75M3 16.5v-2.625a4.125 4.125 0 014.125-4.125h9.75A4.125 4.125 0 0121 13.875V16.5' },
  { key: 'travel', name: 'Reisen', color: '#0891b2',
    icon: 'M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253' },
  { key: 'notes', name: 'Notizen', color: '#059669',
    icon: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125' },
  { key: 'documents', name: 'Dokumente', color: '#7c3aed',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z' },
  { key: 'finance', name: 'Finanzen', color: '#d97706',
    icon: 'M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.518l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941' },
  { key: 'sport', name: 'Sport', color: '#2563eb',
    icon: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z' },
];

/** Paths that only live on the portal host. /login and /share work on every host. */
const PORTAL_SEGMENTS = ['dashboard', 'profile', 'admin'];

function findModule(key: string): AppModule | undefined {
  return MODULES.find((m) => m.key === key);
}

export interface HostInfo {
  /** The module this host belongs to, or null on the portal. */
  module: AppModule | null;
  /** Portal host including port, e.g. "admin.example.com". */
  portal: string;
}

export function parseHost(host: string): HostInfo {
  const lower = host.toLowerCase();
  const [label, ...rest] = lower.split('.');
  const found = rest.length > 0 ? findModule(label) : undefined;
  return found ? { module: found, portal: rest.join('.') } : { module: null, portal: lower };
}

/** Subdomains exist for real domains and *.localhost, not for plain localhost or IPs. */
function hasSubdomains(portal: string): boolean {
  const name = portal.split(':')[0];
  return name.includes('.') && !/^[\d.]+$/.test(name);
}

/**
 * Host that should serve `path` when you are on `host`, or null if the current host is
 * already right (or the path works everywhere).
 */
export function targetHost(path: string, host: string): string | null {
  const { portal } = parseHost(host);
  if (!hasSubdomains(portal)) return null;

  const segment = path.split(/[/?#]/)[1] ?? '';
  let target: string;
  if (findModule(segment)) target = `${segment}.${portal}`;
  else if (PORTAL_SEGMENTS.includes(segment)) target = portal;
  else return null;

  return target === host.toLowerCase() ? null : target;
}

/** `path` as a link usable from `host`: relative on the same host, absolute otherwise. */
export function moduleUrl(path: string, host: string, protocol = 'https:'): string {
  const target = host ? targetHost(path, host) : null;
  return target ? `${protocol}//${target}${path}` : path;
}
