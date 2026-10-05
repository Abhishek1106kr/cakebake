// MockDataStore: loads the shipped demo dataset (public/mock-data/*.json) with fetch, caches it,
// and moves it in time so the dataset's last day is today:
// - history shifts by whole days (bakery hours and weekday patterns stay intact);
// - today's live orders are re-timed relative to now (an order placed "13 minutes ago" stays so);
// - dated custom cake slots ("Tue, 6 Oct · 18:00–20:00") are rewritten to their shifted dates.
// Seed records are read-only. What a visitor changes is stored as small overlays in the browser,
// and Reset demo removes the overlays (see resetDemoData).

import type { Order } from '@/lib/orders';
import { requiredBy } from '@/lib/admin/order-ops';
import type { MockDataset, SeedManifest, SeedOrder } from './types';

const DAY = 86_400_000;
const MIN = 60_000;
const IST_MS = 330 * MIN;
const base = '/mock-data';

/** Start of the calendar day in India for a time. */
const istDayStart = (t: number) => Math.floor((t + IST_MS) / DAY) * DAY - IST_MS;
const shiftIso = (iso: string | null | undefined, ms: number) => (iso ? new Date(new Date(iso).getTime() + ms).toISOString() : (iso ?? null));

/** Whole days between the dataset's anchor day and today (India). */
export function dayShift(anchorIso: string, now: Date): number {
  return Math.round((istDayStart(now.getTime()) - istDayStart(new Date(anchorIso).getTime())) / DAY) * DAY;
}

/** Rewrites a dated slot label by `ms`, keeping its window; other slots are unchanged. */
export function shiftSlot(order: Pick<Order, 'slot' | 'createdAt' | 'items'>, ms: number): string {
  const m = order.slot.match(/·\s*(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})\s*$/);
  if (!m || !/\d{1,2}\s+[A-Za-z]{3}/.test(order.slot)) return order.slot;
  const start = new Date(requiredBy(order).getTime() + ms);
  const day = start.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day} · ${m[1]}–${m[2]}`;
}

/** The dataset moved in time for `now`. Pure: the input is not changed. */
export function shiftDataset(ds: MockDataset, now: Date): MockDataset {
  const D = dayShift(ds.manifest.anchor, now);
  const orderDelta = new Map<string, number>();
  const orders: SeedOrder[] = ds.orders.map((o) => {
    const delta = o.liveOffsetMin !== undefined ? now.getTime() - o.liveOffsetMin * MIN - new Date(o.createdAt).getTime() : D;
    orderDelta.set(o.id, delta);
    return { ...o, createdAt: shiftIso(o.createdAt, delta)!, history: o.history.map((h) => ({ ...h, at: shiftIso(h.at, delta)! })), slot: shiftSlot(o, D) };
  });
  const by = (orderId: string | undefined) => (orderId && orderDelta.has(orderId) ? orderDelta.get(orderId)! : D);
  const byOrderId = new Map(orders.map((o) => [o.id, o]));
  return {
    manifest: { ...ds.manifest, anchor: shiftIso(ds.manifest.anchor, D)! },
    customers: ds.customers.map((c) => {
      const first = c.orderIds[0], last = c.orderIds[c.orderIds.length - 1];
      return { ...c, createdAt: shiftIso(c.createdAt, by(first))!, firstOrderAt: first ? byOrderId.get(first)!.createdAt : null, lastOrderAt: last ? byOrderId.get(last)!.createdAt : null };
    }),
    orders,
    products: ds.products,
    customCakes: ds.customCakes.map((cc) => ({ ...cc, createdAt: shiftIso(cc.createdAt, by(cc.orderId))!, slot: byOrderId.get(cc.orderId)?.slot ?? cc.slot })),
    payments: ds.payments.map((p) => {
      const d = by(p.orderId);
      return { ...p, createdAt: shiftIso(p.createdAt, d)!, capturedAt: shiftIso(p.capturedAt, d), refunds: p.refunds.map((r) => ({ ...r, createdAt: shiftIso(r.createdAt, d)!, processedAt: shiftIso(r.processedAt, d) })) };
    }),
    invoices: ds.invoices.map((i) => ({ ...i, issuedAt: shiftIso(i.issuedAt, by(i.orderId))! })),
    issues: ds.issues.map((x) => {
      const d = by(x.orderId);
      return { ...x, createdAt: shiftIso(x.createdAt, d)!, updatedAt: shiftIso(x.updatedAt, d)!, resolvedAt: shiftIso(x.resolvedAt, d), internalNotes: x.internalNotes.map((n) => ({ ...n, at: shiftIso(n.at, d)! })), messages: x.messages.map((m) => ({ ...m, at: shiftIso(m.at, d)! })) };
    }),
    notifications: ds.notifications.map((n) => {
      const d = n.resourceType === 'order' ? by(n.resourceId) : D;
      return { ...n, createdAt: shiftIso(n.createdAt, d)!, readAt: shiftIso(n.readAt, d), resolvedAt: shiftIso(n.resolvedAt, d) };
    }),
    automations: {
      jobs: ds.automations.jobs.map((j) => ({ ...j, createdAt: shiftIso(j.createdAt, by(j.orderId))!, updatedAt: shiftIso(j.updatedAt, by(j.orderId))! })),
      log: ds.automations.log.map((e) => ({ ...e, timestamp: shiftIso(e.timestamp, by(e.orderId))! })),
    },
    inventory: { ingredients: ds.inventory.ingredients, movements: ds.inventory.movements.map((m) => ({ ...m, at: shiftIso(m.at, D)! })) },
    analytics: { ...ds.analytics, days: ds.analytics.days.map((d) => ({ ...d, date: new Date(Date.parse(`${d.date}T00:00:00Z`) + D).toISOString().slice(0, 10) })) },
    staff: ds.staff.map((s) => ({ ...s, createdAt: shiftIso(s.createdAt, D)! })),
    campaigns: ds.campaigns.map((c) => ({ ...c, start: shiftIso(c.start, D)!, end: shiftIso(c.end, D)!, createdAt: shiftIso(c.createdAt, D)!, updatedAt: shiftIso(c.updatedAt, D)! })),
    audit: ds.audit.map((r) => ({ ...r, at: shiftIso(r.at, r.entity.type === 'order' ? by(r.entity.id) : D)! })),
  };
}

// ───────────── Loading and caching ─────────────

let manifestPromise: Promise<SeedManifest> | null = null;
let datasetPromise: Promise<MockDataset> | null = null;

/** The small manifest (ingredient levels, counts). The storefront needs only this. */
export function loadManifest(): Promise<SeedManifest> {
  manifestPromise ??= fetch(`${base}/manifest.json`, { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw new Error(`manifest ${r.status}`);
    return r.json() as Promise<SeedManifest>;
  }).catch((e) => { manifestPromise = null; throw e; });
  return manifestPromise;
}

/** The whole dataset, shifted to now. Fetched once per page load; files are versioned for caching. */
export function loadDataset(now = new Date()): Promise<MockDataset> {
  datasetPromise ??= (async () => {
    const manifest = await loadManifest();
    const get = async <T,>(name: string): Promise<T> => {
      const r = await fetch(`${base}/${name}.json?v=${encodeURIComponent(manifest.version)}`);
      if (!r.ok) throw new Error(`${name} ${r.status}`);
      return r.json() as Promise<T>;
    };
    const [customers, orders, products, customCakes, payments, invoices, issues, notifications, automations, inventory, analytics, staff, campaigns, audit] = await Promise.all([
      get<MockDataset['customers']>('customers'), get<MockDataset['orders']>('orders'), get<MockDataset['products']>('products'), get<MockDataset['customCakes']>('custom-cakes'),
      get<MockDataset['payments']>('payments'), get<MockDataset['invoices']>('invoices'), get<MockDataset['issues']>('issues'), get<MockDataset['notifications']>('notifications'),
      get<MockDataset['automations']>('automations'), get<MockDataset['inventory']>('inventory'), get<MockDataset['analytics']>('analytics'), get<MockDataset['staff']>('staff'),
      get<MockDataset['campaigns']>('campaigns'), get<MockDataset['audit']>('audit'),
    ]);
    return shiftDataset({ manifest, customers, orders, products, customCakes, payments, invoices, issues, notifications, automations, inventory, analytics, staff, campaigns, audit }, now);
  })().catch((e) => { datasetPromise = null; throw e; });
  return datasetPromise;
}

// ───────────── Overlays and reset ─────────────

/** Browser keys that hold a visitor's changes to the demo. Sign-in, the warning and the bag are not demo data. */
export const DEMO_OVERLAY_KEYS = [
  'tresor-orders', 'tresor-inventory', 'tresor-movements', 'tresor-latest-order-id',
  'tresor-automation-jobs', 'tresor-automation-log', 'tresor-invoices', 'tresor-whatsapp-outbox', 'tresor-order-status',
  'tresor-staff', 'tresor-admin-session', 'tresor-audit', 'tresor-catalog', 'tresor-cake-overrides', 'tresor-settings', 'tresor-campaigns',
  'tresor-content-slots', 'tresor-announcements', 'tresor-media-overlay', 'tresor-internal-notes', 'tresor-customer-profiles',
  'tresor-attention-states', 'tresor-kitchen-state', 'tresor-admin-seen', 'tresor-issues', 'tresor-refunds', 'tresor-domain-log',
] as const;
export const DATA_VERSION_KEY = 'tresor-demo-data-version';

/** Removes every visitor change so the shipped seed state comes back. */
export function resetDemoData(): void {
  try {
    for (const k of DEMO_OVERLAY_KEYS) window.localStorage.removeItem(k);
    window.localStorage.removeItem(DATA_VERSION_KEY);
  } catch { /* storage blocked: nothing stored */ }
}

/**
 * Overlays written for an earlier dataset (or the earlier six sample orders) would mix with the
 * new seed. When the shipped version changes, start clean once.
 */
export function migrateOverlays(version: string): boolean {
  try {
    const stored = window.localStorage.getItem(DATA_VERSION_KEY);
    if (stored === version) return false;
    for (const k of DEMO_OVERLAY_KEYS) if (k !== 'tresor-admin-session') window.localStorage.removeItem(k);
    window.localStorage.setItem(DATA_VERSION_KEY, version);
    return true;
  } catch { return false; }
}
