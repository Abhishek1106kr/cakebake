'use client';

// Mock frontend authentication for demonstration only.
// This must be replaced with backend/session authentication before production.

import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { DEMO_ADMIN, isMockAdminAuthenticated, loginMockAdmin, safeAdminNext } from '@/lib/admin/mock-auth';

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeAdminNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  // Already signed in (this tab or another): straight on.
  useEffect(() => { if (isMockAdminAuthenticated()) router.replace(next as never); }, [next, router]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = loginMockAdmin(email, password);
    if (!result.ok) { setError(result.error); setBusy(false); return; }
    router.replace(next as never);
  };

  return (
    <main className="ad-login">
      <div className="ad-login-card">
        <div className="ad-login-brand">
          <span className="ad-login-word">Tresor</span>
          <span className="ad-login-sub">Command Centre</span>
        </div>
        <p className="ad-login-env">Demo environment</p>
        <h1 className="ad-login-title">Sign in to continue.</h1>

        <form onSubmit={submit} noValidate className="ad-login-form">
          <label className="ad-login-field">
            <span>Email</span>
            <input type="email" name="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} required aria-invalid={Boolean(error)} aria-describedby={error ? 'ad-login-error' : undefined} />
          </label>
          <label className="ad-login-field">
            <span>Password</span>
            <input type="password" name="password" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }} required aria-invalid={Boolean(error)} aria-describedby={error ? 'ad-login-error' : undefined} />
          </label>
          {error && <p id="ad-login-error" className="ad-login-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
          <button type="submit" className="ad-login-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>

        <div className="ad-login-demo" aria-label="Demo credentials">
          <strong>Demo credentials</strong>
          <span>{DEMO_ADMIN.email}</span>
          <span>{DEMO_ADMIN.password}</span>
          <p>This sign-in exists only for the demonstration. It checks the demo account in your browser and is not real security. All data here is mock data stored in this browser.</p>
        </div>
        <Link href="/" className="ad-login-back">← Back to the shop</Link>
      </div>
    </main>
  );
}
