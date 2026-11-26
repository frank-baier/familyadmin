/**
 * Auth helpers for FamilyAdmin
 * - login / logout / getCurrentUser / refreshToken
 * - Uses apiFetch wrapper (credentials: include for HttpOnly refresh cookie)
 */

import { apiFetch, clearAccessToken, setAccessToken } from './api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  whatsappPhone?: string;
}

interface LoginResponse {
  accessToken: string;
  user: User;
}

/**
 * Authenticate with email + password.
 * Stores access token in memory on success.
 * Returns the authenticated User object.
 */
export async function login(email: string, password: string): Promise<User> {
  const data = await apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  setAccessToken(data.accessToken);
  return data.user;
}

/**
 * Log out the current user.
 * Clears the in-memory access token. Backend invalidates the refresh-token cookie.
 */
export async function logout(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } finally {
    clearAccessToken();
  }
}

/**
 * Refresh the access token using the HttpOnly refresh-token cookie.
 * Updates the in-memory token.
 */
export async function refreshToken(): Promise<string> {
  const data = await apiFetch<{ accessToken: string }>('/api/auth/refresh', {
    method: 'POST',
  });
  setAccessToken(data.accessToken);
  return data.accessToken;
}

/**
 * Get the currently authenticated user.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    return await apiFetch<User>('/api/auth/me');
  } catch {
    return null;
  }
}
