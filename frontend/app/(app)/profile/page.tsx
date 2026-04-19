'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useUser } from '@/lib/user-context';
import { logout } from '@/lib/auth';
import type { User } from '@/lib/auth';

export default function ProfilePage() {
  const router = useRouter();
  const { user, setUser } = useUser();
  const [name, setName] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setWhatsappPhone(user.whatsappPhone ?? '');
    }
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null); setSuccess(false);
    try {
      const updated = await apiFetch<User>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, whatsappPhone: whatsappPhone || null }),
      });
      setUser(updated);
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try { await logout(); } finally { window.location.href = '/login'; }
  }

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div className="max-w-lg mx-auto space-y-5">

      {/* Profile hero */}
      <div className="glass rounded-3xl px-6 py-7 flex items-center gap-5 relative overflow-hidden">
        <div
          className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-25 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent 70%)' }}
          aria-hidden="true"
        />
        <div
          className="w-18 h-18 w-[4.5rem] h-[4.5rem] rounded-2xl flex items-center justify-center text-xl font-bold shrink-0"
          style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 60%, #a855f7 100%)',
            color: '#ffffff',
            boxShadow: '0 8px 20px rgb(99 102 241 / 0.35)',
          }}
          aria-hidden="true"
        >
          {initials}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900">{user?.name ?? 'Family Member'}</h1>
          <p className="text-sm text-slate-500">{user?.email}</p>
          {user?.role === 'ADMIN' && (
            <span className="pill bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/60 mt-1 inline-flex">
              Admin
            </span>
          )}
        </div>
      </div>

      {/* Edit form */}
      <div className="glass rounded-3xl px-6 py-6">
        <h2 className="section-label mb-4">Profile Settings</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="px-4 py-3 rounded-2xl bg-red-50/80 text-red-700 text-sm border border-red-200/60">{error}</p>
          )}
          {success && (
            <p className="px-4 py-3 rounded-2xl bg-emerald-50/80 text-emerald-700 text-sm border border-emerald-200/60">
              Profile updated successfully.
            </p>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Name</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
              className="input-field" placeholder="Your name" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Email</label>
            <input type="email" value={user?.email ?? ''} disabled
              className="input-field opacity-50 cursor-not-allowed" />
            <p className="mt-1 text-xs text-slate-400">Email can only be changed by an admin.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              WhatsApp number
            </label>
            <input type="tel" value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)}
              className="input-field" placeholder="+491234567890" />
            <p className="mt-1 text-xs text-slate-400">
              International format, e.g. +491234567890. Used for task notifications.
            </p>
          </div>

          <div className="flex justify-end pt-1">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Quick links */}
      <div className="glass rounded-3xl px-6 py-4 space-y-1">
        <h2 className="section-label mb-3">More</h2>

        <Link
          href="/documents"
          className="flex items-center gap-3 px-3 py-3 rounded-2xl text-sm text-slate-600
                     hover:bg-white/50 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <span className="flex-1">Documents</span>
          <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>

        {user?.role === 'ADMIN' && (
          <Link
            href="/admin/users"
            className="flex items-center gap-3 px-3 py-3 rounded-2xl text-sm text-slate-600
                       hover:bg-white/50 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <span className="flex-1">Family Members</span>
            <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        )}

        <div className="hairline my-1" />

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-sm text-red-500
                     hover:bg-red-50/80 hover:text-red-700 transition-colors cursor-pointer
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          {loggingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>

    </div>
  );
}
