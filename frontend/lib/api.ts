/**
 * API client utility for FamilyAdmin
 * - Stores access token in module-level variable (NOT localStorage)
 * - Includes Authorization Bearer header when token available
 * - Sets credentials: 'include' for HttpOnly cookie (refresh token)
 * - Auto-refresh on 401, retries once
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

// Module-level token storage (memory only — survives page-level re-renders, lost on tab close)
let _accessToken: string | null = null;

export function getAccessToken(): string | null {
  return _accessToken;
}

export function setAccessToken(token: string): void {
  _accessToken = token;
}

export function clearAccessToken(): void {
  _accessToken = null;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function doFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include', // Send HttpOnly refresh-token cookie
  });
}

/**
 * Main fetch wrapper. Handles 401 → auto-refresh → retry once.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response = await doFetch(path, options);

  if (response.status === 401) {
    // Attempt token refresh using the HttpOnly refresh-token cookie
    const refreshed = await tryRefresh();
    if (refreshed) {
      // Retry original request with new token
      response = await doFetch(path, options);
    }
  }

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    throw new ApiError(
      response.status,
      `API error ${response.status}: ${response.statusText}`,
      body,
    );
  }

  // Handle empty responses (204 No Content, etc.)
  const contentType = response.headers.get('Content-Type') ?? '';
  if (!contentType.includes('application/json')) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

/**
 * Attempt to refresh the access token using the HttpOnly cookie.
 * Returns true if successful, false otherwise.
 */
async function tryRefresh(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) return false;

    const data = (await response.json()) as { accessToken?: string };
    if (data.accessToken) {
      setAccessToken(data.accessToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
