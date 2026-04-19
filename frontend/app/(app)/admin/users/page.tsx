'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useUser } from '@/lib/user-context';
import { useRouter } from 'next/navigation';

interface UserEntry {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  whatsappPhone?: string;
}

type ModalMode =
  | { type: 'create' }
  | { type: 'edit'; user: UserEntry }
  | { type: 'password'; user: UserEntry }
  | null;

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function AdminUsersPage() {
  const { user: currentUser } = useUser();
  const router = useRouter();
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'ADMIN') {
      router.replace('/dashboard');
    }
  }, [currentUser, router]);

  async function loadUsers() {
    try {
      const data = await apiFetch<UserEntry[]>('/api/admin/users');
      setUsers(data);
    } catch {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(id: string) {
    if (!confirm('Delete this family member? This cannot be undone.')) return;
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch {
      setError('Failed to delete user.');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Family Members</h1>
          <p className="text-sm text-slate-500 mt-1">Manage who has access to FamilyAdmin.</p>
        </div>
        <button onClick={() => setModal({ type: 'create' })} className="btn-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add member
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-2xl bg-red-50/80 text-red-700 text-sm border border-red-200/60">
          {error}
        </div>
      )}

      {/* User list */}
      <div className="glass rounded-3xl overflow-hidden">
        {users.length === 0 ? (
          <p className="px-6 py-8 text-center text-slate-400 text-sm">No family members yet.</p>
        ) : (
          <ul role="list">
            {users.map((u, idx) => (
              <li
                key={u.id}
                className={[
                  'flex items-center gap-4 px-6 py-4',
                  idx > 0 ? 'hairline' : '',
                ].join(' ')}
              >
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-sm font-bold"
                  style={{
                    background: 'linear-gradient(135deg, #e0e7ff, #ede9fe)',
                    color: '#4f46e5',
                  }}
                  aria-hidden="true"
                >
                  {getInitials(u.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{u.name}</p>
                  <p className="text-xs text-slate-500 truncate">{u.email}</p>
                  {u.whatsappPhone && (
                    <p className="text-xs text-emerald-600 truncate">{u.whatsappPhone}</p>
                  )}
                </div>

                {/* Role badge */}
                <span className={[
                  'pill shrink-0',
                  u.role === 'ADMIN'
                    ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/60'
                    : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200/60',
                ].join(' ')}>
                  {u.role === 'ADMIN' ? 'Admin' : 'Member'}
                </span>

                {/* Actions */}
                <div className="shrink-0 flex items-center gap-1">
                  <button
                    onClick={() => setModal({ type: 'password', user: u })}
                    title="Reset password"
                    className="p-1.5 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/80 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setModal({ type: 'edit', user: u })}
                    title="Edit"
                    className="p-1.5 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/80 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                    </svg>
                  </button>
                  {u.id !== currentUser?.id && (
                    <button
                      onClick={() => handleDelete(u.id)}
                      title="Delete"
                      className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50/80 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modals */}
      {modal?.type === 'create' && (
        <CreateUserModal
          onClose={() => setModal(null)}
          onCreated={(u) => { setUsers((prev) => [...prev, u]); setModal(null); }}
        />
      )}
      {modal?.type === 'edit' && (
        <EditUserModal
          user={modal.user}
          onClose={() => setModal(null)}
          onSaved={(u) => { setUsers((prev) => prev.map((x) => (x.id === u.id ? u : x))); setModal(null); }}
        />
      )}
      {modal?.type === 'password' && (
        <ResetPasswordModal user={modal.user} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal primitives
// ---------------------------------------------------------------------------

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-strong rounded-3xl w-full max-w-md px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100/80 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create user modal
// ---------------------------------------------------------------------------

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (user: UserEntry) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const user = await apiFetch<UserEntry>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      if (role === 'ADMIN') {
        const updated = await apiFetch<UserEntry>(`/api/admin/users/${user.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name, email, role }),
        });
        onCreated(updated);
      } else {
        onCreated(user);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create user.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add family member" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50/80 border border-red-200/60 rounded-2xl px-3 py-2">{error}</p>}
        <Field label="Name">
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="Jane Baier" />
        </Field>
        <Field label="Email">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" placeholder="jane@example.com" />
        </Field>
        <Field label="Password">
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" placeholder="Min. 8 characters" />
        </Field>
        <Field label="Role">
          <select value={role} onChange={(e) => setRole(e.target.value as 'ADMIN' | 'MEMBER')} className="input-field">
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create member'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Edit user modal
// ---------------------------------------------------------------------------

function EditUserModal({ user, onClose, onSaved }: { user: UserEntry; onClose: () => void; onSaved: (user: UserEntry) => void }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>(user.role);
  const [whatsappPhone, setWhatsappPhone] = useState(user.whatsappPhone ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const updated = await apiFetch<UserEntry>(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, email, role, whatsappPhone: whatsappPhone || null }),
      });
      onSaved(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Edit family member" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50/80 border border-red-200/60 rounded-2xl px-3 py-2">{error}</p>}
        <Field label="Name">
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
        </Field>
        <Field label="Email">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" />
        </Field>
        <Field label="Role">
          <select value={role} onChange={(e) => setRole(e.target.value as 'ADMIN' | 'MEMBER')} className="input-field">
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>
        </Field>
        <Field label="WhatsApp phone">
          <input type="tel" value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} className="input-field" placeholder="+491234567890" />
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Reset password modal
// ---------------------------------------------------------------------------

function ResetPasswordModal({ user, onClose }: { user: UserEntry; onClose: () => void }) {
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      await apiFetch(`/api/admin/users/${user.id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ newPassword }),
      });
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reset password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Reset password — ${user.name}`} onClose={onClose}>
      {done ? (
        <div className="space-y-4">
          <p className="text-sm text-emerald-700 bg-emerald-50/80 border border-emerald-200/60 px-4 py-3 rounded-2xl">
            Password updated. The user&apos;s existing sessions have been invalidated.
          </p>
          <div className="flex justify-end">
            <button onClick={onClose} className="btn-primary">Done</button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50/80 border border-red-200/60 rounded-2xl px-3 py-2">{error}</p>}
          <Field label="New password">
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input-field"
              placeholder="Min. 8 characters"
            />
          </Field>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Resetting…' : 'Reset password'}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
