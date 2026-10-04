// Customers, derived from orders (one person = one normalised mobile number) plus a
// small profile the bakery keeps (preferences and internal notes). Lifecycle labels
// come from fixed business rules on order dates and spend, nothing else: no inferred
// personal attributes.

import { normalizePhone, type Order } from '@/lib/orders';

export type Lifecycle = 'NEW' | 'ACTIVE' | 'RETURNING' | 'HIGH_VALUE' | 'AT_RISK' | 'INACTIVE';

export const LIFECYCLE_LABEL: Record<Lifecycle, string> = {
  NEW: 'New', ACTIVE: 'Active', RETURNING: 'Returning', HIGH_VALUE: 'High value', AT_RISK: 'At risk', INACTIVE: 'Inactive',
};

/** The rules, in the order they are checked. Shown in the admin so staff can see why a label applies. */
export const LIFECYCLE_RULES: { id: Lifecycle; rule: string }[] = [
  { id: 'HIGH_VALUE', rule: 'Spent ₹10,000 or more, or 5+ orders, and ordered in the last 90 days' },
  { id: 'INACTIVE', rule: 'No order for more than 90 days' },
  { id: 'AT_RISK', rule: '2+ orders, but none for 45–90 days' },
  { id: 'NEW', rule: 'First order, placed in the last 30 days' },
  { id: 'RETURNING', rule: '2+ orders, the latest within 45 days' },
  { id: 'ACTIVE', rule: 'One order, 30–45 days ago' },
];

export type MarketingPrefs = { whatsappUpdates: boolean; whatsappMarketing: boolean; emailMarketing: boolean };
/** Transactional WhatsApp updates are on (the customer asked for the order); marketing is opt-in, so off until they say yes. */
export const DEFAULT_PREFS: MarketingPrefs = { whatsappUpdates: true, whatsappMarketing: false, emailMarketing: false };

export type CustomerProfile = { id: string; prefs: MarketingPrefs; notes: string; updatedAt: string };

export type Customer = {
  id: string; // normalised phone
  name: string;
  phone: string;
  email: string;
  address: string;
  orders: Order[]; // newest first
  orderCount: number; // excludes cancelled
  totalSpend: number; // excludes cancelled
  averageOrder: number;
  firstOrderAt: string;
  lastOrderAt: string;
  favorites: { productId: string; name: string; qty: number }[];
  topCategory: string | null;
  customCakes: number;
  lifecycle: Lifecycle;
  sample: boolean;
};

const DAY = 86400000;

export function lifecycleOf(c: Pick<Customer, 'orderCount' | 'totalSpend' | 'firstOrderAt' | 'lastOrderAt'>, now: Date): Lifecycle {
  const sinceLast = (now.getTime() - new Date(c.lastOrderAt).getTime()) / DAY;
  const sinceFirst = (now.getTime() - new Date(c.firstOrderAt).getTime()) / DAY;
  if ((c.totalSpend >= 10000 || c.orderCount >= 5) && sinceLast <= 90) return 'HIGH_VALUE';
  if (sinceLast > 90) return 'INACTIVE';
  if (c.orderCount >= 2 && sinceLast > 45) return 'AT_RISK';
  if (c.orderCount <= 1 && sinceFirst <= 30) return 'NEW';
  if (c.orderCount >= 2) return 'RETURNING';
  return 'ACTIVE';
}

export const customerIdFor = (phone: string) => normalizePhone(phone) || `unknown-${phone}`;

export function buildCustomers(orders: Order[], now: Date): Customer[] {
  const groups = new Map<string, Order[]>();
  for (const o of orders) {
    const id = customerIdFor(o.customer.phone);
    groups.set(id, [...(groups.get(id) ?? []), o]);
  }
  return [...groups.entries()].map(([id, list]) => {
    const sorted = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const counted = sorted.filter((o) => o.status !== 'CANCELLED');
    const latest = sorted[0];
    const spend = counted.reduce((s, o) => s + o.total, 0);
    const qty = new Map<string, { name: string; qty: number; category: string }>();
    let customCakes = 0;
    for (const o of counted) for (const l of o.items) {
      if (l.custom) { customCakes += l.qty; continue; }
      const cur = qty.get(l.product.id) ?? { name: l.product.name, qty: 0, category: l.product.category };
      qty.set(l.product.id, { ...cur, qty: cur.qty + l.qty });
    }
    const favorites = [...qty.entries()].map(([productId, v]) => ({ productId, name: v.name, qty: v.qty })).sort((a, b) => b.qty - a.qty).slice(0, 5);
    const byCat = new Map<string, number>();
    for (const v of qty.values()) byCat.set(v.category, (byCat.get(v.category) ?? 0) + v.qty);
    if (customCakes) byCat.set('Custom cake', (byCat.get('Custom cake') ?? 0) + customCakes);
    const topCategory = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const base = {
      orderCount: counted.length, totalSpend: spend,
      firstOrderAt: sorted[sorted.length - 1].createdAt, lastOrderAt: (counted[0] ?? latest).createdAt,
    };
    return {
      id, name: latest.customer.name, phone: latest.customer.phone, email: sorted.find((o) => o.customer.email)?.customer.email ?? '',
      address: latest.address, orders: sorted, ...base, averageOrder: counted.length ? Math.round(spend / counted.length) : 0,
      favorites, topCategory, customCakes, lifecycle: lifecycleOf(base, now), sample: sorted.every((o) => o.source === 'sample'),
    };
  }).sort((a, b) => b.lastOrderAt.localeCompare(a.lastOrderAt));
}

export function searchCustomers(list: Customer[], query: string): Customer[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  const qd = q.replace(/\D/g, '');
  return list.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (qd.length >= 3 && c.id.includes(qd)) || c.orders.some((o) => o.id.toLowerCase() === q || o.id.toLowerCase().includes(q)));
}

export function customersCsvRows(list: Customer[], includePii: boolean): (string | number)[][] {
  return [
    ['Customer', ...(includePii ? ['Phone', 'Email'] : []), 'Orders', 'Total spend', 'Average order', 'Last order', 'Lifecycle'],
    ...list.map((c) => [c.name, ...(includePii ? [c.phone, c.email] : []), c.orderCount, c.totalSpend, c.averageOrder, c.lastOrderAt, LIFECYCLE_LABEL[c.lifecycle]]),
  ];
}
