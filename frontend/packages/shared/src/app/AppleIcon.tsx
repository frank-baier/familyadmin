import { ImageResponse } from 'next/og';
import { headers } from 'next/headers';
import { parseHost } from '../modules';
import { appIconDataUrl } from './app-icons';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** Home screen icon per module subdomain (see app-icons.ts). */
export async function AppleIcon() {
  const { module } = parseHost((await headers()).get('host') ?? '');
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={appIconDataUrl(module?.key)} width={180} height={180} alt="" />,
    size,
  );
}

/** Browser tab icon: same design, rounded so it reads well small. */
export async function AppIcon() {
  const { module } = parseHost((await headers()).get('host') ?? '');
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={appIconDataUrl(module?.key)} width={64} height={64} alt=""
      style={{ borderRadius: 14 }} />,
    { width: 64, height: 64 },
  );
}
