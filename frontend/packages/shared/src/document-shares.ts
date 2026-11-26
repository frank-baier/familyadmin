import { apiFetch } from './api';

export interface ShareableUser {
  id: string;
  name: string;
  email: string;
}

export function getMyShares(): Promise<ShareableUser[]> {
  return apiFetch<ShareableUser[]>('/api/document-shares');
}

export function getShareableUsers(): Promise<ShareableUser[]> {
  return apiFetch<ShareableUser[]>('/api/document-shares/users');
}

export function shareWith(userId: string): Promise<void> {
  return apiFetch<void>(`/api/document-shares/${userId}`, { method: 'PUT' });
}

export function revokeShare(userId: string): Promise<void> {
  return apiFetch<void>(`/api/document-shares/${userId}`, { method: 'DELETE' });
}
