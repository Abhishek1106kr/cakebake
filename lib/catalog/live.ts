// Applies the bakery's stored changes (products, Cake Builder, business settings)
// to the live bindings the shop reads. Runs in the browser after hydration, and
// again whenever another tab saves a change. Server rendering always uses the code
// defaults, so the first paint matches the server; an overridden value appears on
// the next frame (a backend serving the catalogue removes that gap).

import { baseProducts, setStorefrontProducts } from '@/lib/data';
import { currentCakeCatalog, setCakeCatalog } from '@/lib/cake/config';
import { setBusinessRules } from '@/lib/config/business';
import { buildCatalog, storefrontProducts, type ProductRecord } from '@/lib/admin/catalog';
import { buildCakeCatalog, normalizeOverrides } from '@/lib/admin/cake-builder';
import { normalizeSettings, rulesFromSettings } from '@/lib/admin/settings';

const KEYS = { catalog: 'tresor-catalog', cake: 'tresor-cake-overrides', settings: 'tresor-settings' } as const;
const read = (k: string): unknown => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };

let revision = 0;
const listeners = new Set<() => void>();
export const catalogRevision = () => revision;
export function onCatalog(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

/** Recompute everything from storage. Cheap: a few dozen records. */
export function applyStoredCatalog() {
  const stored = read(KEYS.catalog);
  setStorefrontProducts(stored && typeof stored === 'object' ? storefrontProducts(buildCatalog(stored as Record<string, ProductRecord>)) : baseProducts);
  const before = currentCakeCatalog().version;
  setCakeCatalog(buildCakeCatalog(normalizeOverrides(read(KEYS.cake))));
  setBusinessRules(rulesFromSettings(normalizeSettings(read(KEYS.settings))));
  revision += 1;
  listeners.forEach((l) => l());
  return { cakeVersionChanged: before !== currentCakeCatalog().version };
}

let started = false;
/** Start once per page: apply now, then follow other tabs. Returns a stop function. */
export function startLiveCatalog(): () => void {
  if (started || typeof window === 'undefined') return () => {};
  started = true;
  applyStoredCatalog();
  const onStorage = (e: StorageEvent) => { if (e.key && (Object.values(KEYS) as string[]).includes(e.key)) applyStoredCatalog(); };
  const onLocal = () => applyStoredCatalog();
  window.addEventListener('storage', onStorage);
  window.addEventListener('tresor-catalog-changed', onLocal);
  return () => { started = false; window.removeEventListener('storage', onStorage); window.removeEventListener('tresor-catalog-changed', onLocal); };
}

/** Same-tab signal after the admin saves (storage events only reach other tabs). */
export const announceCatalogChange = () => window.dispatchEvent(new Event('tresor-catalog-changed'));
