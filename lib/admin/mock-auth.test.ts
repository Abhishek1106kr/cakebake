import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEMO_ADMIN, MOCK_AUTH_KEY, isMockAdminAuthenticated, loginMockAdmin, loginUrlFor, logoutMockAdmin, onMockAuthChange, safeAdminNext } from './mock-auth';

// A minimal browser: localStorage and window events.
function fakeWindow(opts: { blocked?: boolean } = {}) {
  const store = new Map<string, string>();
  const target = new EventTarget();
  const localStorage = {
    getItem: (k: string) => { if (opts.blocked) throw new Error('blocked'); return store.has(k) ? store.get(k)! : null; },
    setItem: (k: string, v: string) => { if (opts.blocked) throw new Error('blocked'); store.set(k, String(v)); },
    removeItem: (k: string) => { if (opts.blocked) throw new Error('blocked'); store.delete(k); },
  };
  const win = { localStorage, addEventListener: target.addEventListener.bind(target), removeEventListener: target.removeEventListener.bind(target), dispatchEvent: target.dispatchEvent.bind(target) };
  (globalThis as unknown as { window: unknown }).window = win;
  return { store };
}

afterEach(() => { delete (globalThis as unknown as { window?: unknown }).window; });

describe('mock admin authentication (demo only)', () => {
  let store: Map<string, string>;
  beforeEach(() => { ({ store } = fakeWindow()); });

  it('is signed out until the demo credentials are used', () => {
    expect(isMockAdminAuthenticated()).toBe(false);
  });

  it('accepts the demo credentials and stores no password', () => {
    expect(loginMockAdmin(DEMO_ADMIN.email, DEMO_ADMIN.password)).toEqual({ ok: true });
    expect(isMockAdminAuthenticated()).toBe(true);
    const raw = store.get(MOCK_AUTH_KEY)!;
    expect(raw).not.toContain(DEMO_ADMIN.password);
    expect(JSON.parse(raw)).toMatchObject({ v: 1, email: DEMO_ADMIN.email });
  });

  it('compares the email case-insensitively and trims it', () => {
    expect(loginMockAdmin('  TEST@omni.com ', 'testpass').ok).toBe(true);
  });

  it('rejects a wrong password, a wrong email and empty input', () => {
    for (const [e, p] of [['test@omni.com', 'testpass '], ['test@omni.com', 'TESTPASS'], ['other@omni.com', 'testpass'], ['', '']]) {
      const r = loginMockAdmin(e, p);
      expect(r.ok).toBe(false);
    }
    expect(isMockAdminAuthenticated()).toBe(false);
    expect(store.has(MOCK_AUTH_KEY)).toBe(false);
  });

  it('logs out by clearing only its own key', () => {
    store.set('tresor-orders', '[{"id":"TRS-1"}]');
    loginMockAdmin(DEMO_ADMIN.email, DEMO_ADMIN.password);
    logoutMockAdmin();
    expect(isMockAdminAuthenticated()).toBe(false);
    expect(store.get('tresor-orders')).toBe('[{"id":"TRS-1"}]');
  });

  it('ignores a malformed or hand-edited record', () => {
    for (const v of ['not json', 'null', '{}', '{"v":1,"email":"x@y.z","signedInAt":"now"}', '{"v":2,"email":"test@omni.com","signedInAt":"now"}']) {
      store.set(MOCK_AUTH_KEY, v);
      expect(isMockAdminAuthenticated()).toBe(false);
    }
  });

  it('notifies listeners on sign-in and sign-out', () => {
    let calls = 0;
    const off = onMockAuthChange(() => { calls += 1; });
    loginMockAdmin(DEMO_ADMIN.email, DEMO_ADMIN.password);
    logoutMockAdmin();
    off();
    loginMockAdmin(DEMO_ADMIN.email, DEMO_ADMIN.password);
    expect(calls).toBe(2);
  });

  it('fails safely when storage is blocked', () => {
    fakeWindow({ blocked: true });
    expect(isMockAdminAuthenticated()).toBe(false);
    const r = loginMockAdmin(DEMO_ADMIN.email, DEMO_ADMIN.password);
    expect(r.ok).toBe(false);
    expect(() => logoutMockAdmin()).not.toThrow();
  });
});

describe('return path after sign-in (no open redirects)', () => {
  it('keeps admin paths with their query and hash', () => {
    expect(safeAdminNext('/admin/orders/abc')).toBe('/admin/orders/abc');
    expect(safeAdminNext('/admin/orders?status=active#top')).toBe('/admin/orders?status=active#top');
    expect(safeAdminNext('/admin')).toBe('/admin');
  });

  it('refuses anything outside the admin', () => {
    for (const bad of [
      'https://evil.example', '//evil.example', '/\\evil.example', '\\\\evil.example', 'javascript:alert(1)',
      '/shop', '/administrator', '/admin-evil', '/admin/login', '/admin/login?next=/admin', 'admin/orders', '', null, undefined,
      '/admin/../shop', '/%2F%2Fevil.example',
    ]) {
      expect(safeAdminNext(bad as string), String(bad)).not.toMatch(/evil|shop|login|administrator|javascript/);
    }
    expect(safeAdminNext('/admin/../shop')).toBe('/admin');
  });

  it('builds login URLs that carry a safe next', () => {
    expect(loginUrlFor('/admin')).toBe('/admin/login');
    expect(loginUrlFor('/admin/orders/abc')).toBe('/admin/login?next=%2Fadmin%2Forders%2Fabc');
    expect(loginUrlFor('https://evil.example')).toBe('/admin/login');
  });
});
