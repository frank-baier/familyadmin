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

// Singleton refresh promise — prevents concurrent /auth/refresh calls from racing
let _refreshPromise: Promise<boolean> | null = null;

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

  return (await response.json()) as T;
}

/**
 * Fetch wrapper for multipart/form-data (file uploads).
 * Like apiFetch but does NOT set Content-Type (browser sets it with boundary).
 * Handles 401 → auto-refresh → retry once.
 */
export async function apiFetchMultipart<T = unknown>(
  path: string,
  formData: FormData,
  method = 'POST',
): Promise<T> {
  const makeRequest = () => {
    const headers: Record<string, string> = {};
    if (_accessToken) headers['Authorization'] = `Bearer ${_accessToken}`;
    return fetch(`${API_BASE}${path}`, {
      method,
      body: formData,
      credentials: 'include',
      headers,
    });
  };

  let response = await makeRequest();

  if (response.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      response = await makeRequest();
    }
  }

  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { body = undefined; }
    throw new ApiError(response.status, `API error ${response.status}: ${response.statusText}`, body);
  }

  const contentType = response.headers.get('Content-Type') ?? '';
  if (!contentType.includes('application/json')) return undefined as T;
  return (await response.json()) as T;
}

/**
 * Attempt to refresh the access token using the HttpOnly cookie.
 * Deduplicates concurrent calls — multiple callers share a single in-flight request.
 * Returns true if successful, false otherwise.
 */
function tryRefresh(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
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
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}
