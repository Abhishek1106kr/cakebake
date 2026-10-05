'use client';

// Mock frontend authentication for demonstration only.
// This must be replaced with backend/session authentication before production.
//
// Sits above AdminShell/AdminProvider: nothing of the admin mounts (or reads its data)
// until the demo sign-in is present. /admin/login renders on its own, without the shell.

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isMockAdminAuthenticated, loginUrlFor, onMockAuthChange } from '@/lib/admin/mock-auth';
import { AdminShell } from './shell';

export function MockAdminAuthGate({ children, className }: { children: ReactNode; className?: string }) {
  const pathname = usePathname() ?? '/admin';
  const router = useRouter();
  // Unknown until the browser is reached: the server can't see browser storage.
  const [state, setState] = useState<'checking' | 'in' | 'out'>('checking');
  const isLogin = pathname === '/admin/login';

  useEffect(() => {
    const update = () => setState(isMockAdminAuthenticated() ? 'in' : 'out');
    update();
    return onMockAuthChange(update);
  }, []);

  useEffect(() => {
    if (state === 'out' && !isLogin) {
      const { pathname: p, search, hash } = window.location;
      router.replace(loginUrlFor(`${p}${search}${hash}`) as never);
    }
  }, [state, isLogin, router]);

  if (isLogin) return <div className={`ad-root ad-login-root ${className ?? ''}`}>{children}</div>;
  if (state !== 'in') {
    return (
      <div className={`ad-root ad-gate ${className ?? ''}`} aria-busy="true">
        <p>{state === 'out' ? 'Taking you to the demo sign-in…' : 'Checking demo sign-in…'}</p>
      </div>
    );
  }
  return <AdminShell className={className}>{children}</AdminShell>;
}
