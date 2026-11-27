'use client';

import { useUser } from './user-context';

/** True once the user is known and may use the module. */
export function useCanUse(moduleKey: string): boolean {
  const { user } = useUser();
  return !!user && (user.role === 'ADMIN' || (user.modules ?? []).includes(moduleKey));
}

/** Renders children only if the user may use the module. */
export function IfModule({ module, children }: { module: string; children: React.ReactNode }) {
  return useCanUse(module) ? <>{children}</> : null;
}
