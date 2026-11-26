import { ImageResponse } from 'next/og';
import { headers } from 'next/headers';
import { parseHost } from '@/lib/modules';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

const HOME_ICON =
  'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75';

/** Home screen icon, coloured per module subdomain. */
export default async function AppleIcon() {
  const { module } = parseHost((await headers()).get('host') ?? '');
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: module?.color ?? '#1c1917' }}>
        <svg width="110" height="110" viewBox="0 0 24 24" fill="none" stroke="white"
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d={module?.icon ?? HOME_ICON} />
        </svg>
      </div>
    ),
    size,
  );
}
