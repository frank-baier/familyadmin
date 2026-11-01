import type { MetadataRoute } from 'next';

// Home-screen app always starts on the dashboard (instead of the page it was added from)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FamilyAdmin',
    short_name: 'FamilyAdmin',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#fafaf7',
    theme_color: '#fafaf7',
    icons: [{ src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' }],
  };
}
