'use client';

import Link from 'next/link';
import { useSyncExternalStore, type ComponentProps } from 'react';
import { moduleUrl } from '../modules';

const subscribe = () => () => {};

type Props = Omit<ComponentProps<'a'>, 'href'> & { href: string };

/**
 * Link that may cross module subdomains: a Next <Link> on the same host, a plain <a>
 * (full page load) when the target lives on another host.
 */
export function ModuleLink({ href, ...props }: Props) {
  // Server render and hydration use the relative path; the browser then resolves the host.
  const url = useSyncExternalStore(
    subscribe,
    () => moduleUrl(href, window.location.host, window.location.protocol),
    () => href,
  );
  return url === href ? <Link href={href} {...props} /> : <a href={url} {...props} />;
}
