// Mock frontend authentication for demonstration only.
// This must be replaced with backend/session authentication before production.
//
// What this is: a gate that keeps casual visitors of the public demo out of the admin
// screens and shows how a sign-in step fits the flow. What it is not: security. The
// credentials are public (they are shown on the login page), the check runs in the
// browser, and anyone can set the storage key by hand. All admin data is mock data in
// the visitor's own browser.

/** Demo account. Intentionally part of the demo application and displayed on /admin/login. */
export const DEMO_ADMIN = { email: 'test@omni.com', password: 'testpass' } as const;

export const MOCK_AUTH_KEY = 'tresor-demo-admin-auth';
const CHANGE_EVENT = 'tresor-demo-admin-auth-change';

/** What is stored. Never the password. */
export type MockAuthRecord = { v: 1; email: string; signedInAt: string };

function readRecord(): MockAuthRecord | null {
  try {
    const raw = window.localStorage.getItem(MOCK_AUTH_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<MockAuthRecord> | null;
    return value && value.v === 1 && value.email === DEMO_ADMIN.email && typeof value.signedInAt === 'string' ? (value as MockAuthRecord) : null;
  } catch {
    return null;
  }
}

export function isMockAdminAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return readRecord() !== null;
}

export type MockLoginResult = { ok: true } | { ok: false; error: string };

/** Checks the demo credentials. Email is compared case-insensitively; the password exactly. */
export function loginMockAdmin(email: string, password: string): MockLoginResult {
  if (email.trim().toLowerCase() !== DEMO_ADMIN.email || password !== DEMO_ADMIN.password) {
    return { ok: false, error: 'That email and password don’t match the demo account.' };
  }
  const record: MockAuthRecord = { v: 1, email: DEMO_ADMIN.email, signedInAt: new Date().toISOString() };
  try {
    window.localStorage.setItem(MOCK_AUTH_KEY, JSON.stringify(record));
  } catch {
    return { ok: false, error: 'This browser is blocking site storage, so the demo sign-in can’t be remembered.' };
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return { ok: true };
}

/** Clears the demo sign-in. Demo orders and admin data are left as they are. */
export function logoutMockAdmin(): void {
  try { window.localStorage.removeItem(MOCK_AUTH_KEY); } catch { /* storage blocked: nothing stored */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Follows sign-in and sign-out in this tab and in other tabs. */
export function onMockAuthChange(listener: () => void): () => void {
  const onStorage = (e: StorageEvent) => { if (e.key === MOCK_AUTH_KEY || e.key === null) listener(); };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener('storage', onStorage);
  return () => { window.removeEventListener(CHANGE_EVENT, listener); window.removeEventListener('storage', onStorage); };
}

/**
 * Where to go after signing in. Only paths inside the admin are accepted, so the `next`
 * parameter can't send anyone to another site (no open redirects).
 */
export function safeAdminNext(next: string | null | undefined): string {
  const fallback = '/admin';
  if (!next || typeof next !== 'string') return fallback;
  // Reject protocol-relative and backslash tricks before parsing.
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  let url: URL;
  try { url = new URL(next, 'https://tresor.invalid'); } catch { return fallback; }
  if (url.origin !== 'https://tresor.invalid') return fallback;
  const path = url.pathname;
  if (!(path === '/admin' || path.startsWith('/admin/')) || path === '/admin/login' || path.startsWith('/admin/login/')) return fallback;
  return `${path}${url.search}${url.hash}`;
}

/** The login URL for a requested admin path. */
export const loginUrlFor = (requested: string) => {
  const next = safeAdminNext(requested);
  return next === '/admin' ? '/admin/login' : `/admin/login?next=${encodeURIComponent(next)}`;
};
