import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { parseHost } from '@/lib/modules';

// One manifest per host: each module installs as its own home screen app that starts on
// its module; the portal starts on the dashboard.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { module } = parseHost((await headers()).get('host') ?? '');
  const name = module?.name ?? 'FamilyAdmin';
  return {
    name,
    short_name: name,
    start_url: module ? `/${module.key}` : '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#fafaf7',
    theme_color: '#fafaf7',
    icons: [
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
      { src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' },
    ],
  };
}
