'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { login } from '@/lib/auth';

interface LoginState { error?: string; success?: boolean; }
const initialState: LoginState = {};

async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  if (!email || !password) return { error: 'Please enter your email and password.' };
  try {
    await login(email, password);
    return { success: true };
  } catch {
    return { error: 'Invalid email or password. Please try again.' };
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [state, action, pending] = useActionState(loginAction, initialState);

  useEffect(() => {
    if (state.success) router.push('/dashboard');
  }, [state.success, router]);

  return (
    <div className="w-full max-w-sm">
      {/* Glass card */}
      <div className="glass-strong rounded-3xl px-7 py-8 relative overflow-hidden">
        {/* Decorative blob */}
        <div
          className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-30 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent 70%)' }}
          aria-hidden="true"
        />

        {/* Logo */}
        <div className="relative text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-3xl mb-5"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 60%, #a855f7 100%)',
              boxShadow: '0 12px 32px rgb(99 102 241 / 0.45)',
            }}
            aria-hidden="true"
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">FamilyAdmin</h1>
          <p className="text-sm text-slate-500 mt-1">Baier family · Private hub</p>
        </div>

        {/* Error */}
        {state.error && (
          <div
            role="alert"
            aria-live="polite"
            className="flex items-start gap-3 mb-5 p-3.5 rounded-2xl bg-red-50/80 border border-red-200/60 text-red-700 text-sm"
          >
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
            <span>{state.error}</span>
          </div>
        )}

        {/* Form */}
        <form action={action} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Email
            </label>
            <input
              id="email" name="email" type="email"
              autoComplete="email" required disabled={pending}
              className="input-field"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Password
            </label>
            <input
              id="password" name="password" type="password"
              autoComplete="current-password" required disabled={pending}
              className="input-field"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="btn-primary w-full mt-2"
          >
            {pending ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Signing in…
              </>
            ) : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          Accounts are managed by the family admin.
        </p>
      </div>
    </div>
  );
}
