// Analytics (Phase 5): sales, product, funnel and search metrics from orders and
// events. Pure functions; every number can be traced back to the records it counts.

import type { TresorEvent } from '../events/schema';
import type { OrderLike } from '../recommend/recommend';

type OrderWithTotal = OrderLike & { total: number; items: { product: { id: string; category?: string }; qty: number; unitPrice?: number }[] };

const dayKey = (iso: string) => {
  // Bengaluru calendar day
  const d = new Date(new Date(iso).getTime() + 330 * 60000);
  return d.toISOString().slice(0, 10);
};

export function salesByDay(orders: OrderWithTotal[], now: Date, days = 7): { date: string; revenue: number; orders: number }[] {
  const out: { date: string; revenue: number; orders: number }[] = [];
  for (let i = days - 1; i >= 0; i -= 1) out.push({ date: dayKey(new Date(now.getTime() - i * 86400000).toISOString()), revenue: 0, orders: 0 });
  const byDate = new Map(out.map((d) => [d.date, d]));
  for (const o of orders) {
    if (o.status === 'CANCELLED') continue;
    const d = byDate.get(dayKey(o.createdAt));
    if (d) { d.revenue += o.total; d.orders += 1; }
  }
  return out;
}

export type ProductStats = { productId: string; units: number; revenue: number; views: number; adds: number; addRate: number | null };

export function productPerformance(orders: OrderWithTotal[], events: TresorEvent[]): ProductStats[] {
  const stats = new Map<string, ProductStats>();
  const get = (id: string) => stats.get(id) ?? (stats.set(id, { productId: id, units: 0, revenue: 0, views: 0, adds: 0, addRate: null }), stats.get(id)!);
  for (const o of orders) {
    if (o.status === 'CANCELLED') continue;
    for (const l of o.items) { const s = get(l.product.id); s.units += l.qty; s.revenue += (l.unitPrice ?? 0) * l.qty; }
  }
  for (const e of events) {
    const id = e.payload.productId;
    if (typeof id !== 'string') continue;
    if (e.type === 'product_view') get(id).views += 1;
    if (e.type === 'product_added') get(id).adds += 1;
  }
  for (const s of stats.values()) s.addRate = s.views ? Math.round((s.adds / s.views) * 100) / 100 : null;
  return [...stats.values()].sort((a, b) => b.revenue - a.revenue || b.units - a.units);
}

export const FUNNEL_STEPS = ['product_view', 'product_added', 'checkout_started', 'order_created'] as const;

/** Sessions reaching each step, in order. A session counts for a step only if it reached it. */
export function funnel(events: TresorEvent[]): { step: (typeof FUNNEL_STEPS)[number]; sessions: number; rate: number | null }[] {
  const reached = new Map<string, Set<string>>();
  for (const e of events) {
    if (!(FUNNEL_STEPS as readonly string[]).includes(e.type) || !e.sessionId) continue;
    const s = reached.get(e.type) ?? new Set<string>();
    s.add(e.sessionId);
    reached.set(e.type, s);
  }
  const first = reached.get(FUNNEL_STEPS[0])?.size ?? 0;
  return FUNNEL_STEPS.map((step) => {
    const sessions = reached.get(step)?.size ?? 0;
    return { step, sessions, rate: first ? Math.round((sessions / first) * 100) / 100 : null };
  });
}

export type SearchStats = {
  searches: number;
  zeroResultRate: number | null;
  topQueries: { query: string; count: number; avgResults: number }[];
  zeroResultQueries: { query: string; count: number }[];
};

export function searchAnalytics(events: TresorEvent[], top = 8): SearchStats {
  const done = events.filter((e) => e.type === 'search_completed' && typeof e.payload.query === 'string');
  const byQuery = new Map<string, { count: number; results: number; zero: number }>();
  for (const e of done) {
    const q = String(e.payload.query).trim().toLowerCase();
    if (!q) continue;
    const r = byQuery.get(q) ?? { count: 0, results: 0, zero: 0 };
    r.count += 1;
    r.results += Number(e.payload.resultCount) || 0;
    if (e.payload.zeroResult === true || Number(e.payload.resultCount) === 0) r.zero += 1;
    byQuery.set(q, r);
  }
  const rows = [...byQuery.entries()];
  const zero = rows.reduce((s, [, r]) => s + r.zero, 0);
  const total = rows.reduce((s, [, r]) => s + r.count, 0);
  return {
    searches: total,
    zeroResultRate: total ? Math.round((zero / total) * 100) / 100 : null,
    topQueries: rows.sort((a, b) => b[1].count - a[1].count).slice(0, top).map(([query, r]) => ({ query, count: r.count, avgResults: Math.round((r.results / r.count) * 10) / 10 })),
    zeroResultQueries: rows.filter(([, r]) => r.zero > 0).sort((a, b) => b[1].zero - a[1].zero).slice(0, top).map(([query, r]) => ({ query, count: r.zero })),
  };
}

export function categoryMix(orders: OrderWithTotal[]): { category: string; units: number; share: number }[] {
  const units = new Map<string, number>();
  let total = 0;
  for (const o of orders) {
    if (o.status === 'CANCELLED') continue;
    for (const l of o.items) { const c = l.product.category ?? 'Other'; units.set(c, (units.get(c) ?? 0) + l.qty); total += l.qty; }
  }
  return [...units.entries()].map(([category, u]) => ({ category, units: u, share: total ? Math.round((u / total) * 100) / 100 : 0 })).sort((a, b) => b.units - a.units);
}

export type CakeStats = {
  opened: number;
  started: number;
  added: number;
  ordered: number;
  conversion: number | null;
  popular: { group: string; optionId: string; count: number }[];
  combos: { combo: string; count: number }[];
  abandonedAt: { group: string; count: number }[];
  withMessage: number | null;
  withPrint: number | null;
};

/** Cake Playground analytics: funnel, popular choices and combinations, where people stop. */
export function cakeAnalytics(events: TresorEvent[]): CakeStats {
  const sessions = (type: string) => new Set(events.filter((e) => e.type === type).map((e) => e.sessionId ?? e.id)).size;
  const opened = sessions('customizer_opened');
  const addedEvents = events.filter((e) => e.type === 'custom_cake_added_to_cart');
  const count = <K extends string>(keys: K[]) => {
    const m = new Map<K, number>();
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const picks = events.filter((e) => e.type === 'option_selected' && !['surprise', 'style', 'suggestion', 'message', 'print', 'notes'].includes(String(e.payload.group)));
  return {
    opened,
    started: sessions('cake_started'),
    added: addedEvents.length,
    ordered: events.filter((e) => e.type === 'custom_cake_ordered').length,
    conversion: opened ? Math.round((sessions('custom_cake_added_to_cart') / opened) * 100) / 100 : null,
    popular: count(picks.map((e) => `${e.payload.group}:${e.payload.optionId}`)).slice(0, 8).map(([k, n]) => ({ group: k.split(':')[0], optionId: k.split(':')[1], count: n })),
    combos: count(addedEvents.map((e) => `${e.payload.size} · ${e.payload.sponge}`)).slice(0, 5).map(([combo, n]) => ({ combo, count: n })),
    abandonedAt: count(events.filter((e) => e.type === 'custom_cake_abandoned').map((e) => String(e.payload.lastGroup))).map(([group, n]) => ({ group, count: n })),
    withMessage: addedEvents.length ? Math.round((addedEvents.filter((e) => Number(e.payload.messageLength) > 0).length / addedEvents.length) * 100) / 100 : null,
    withPrint: addedEvents.length ? Math.round((addedEvents.filter((e) => e.payload.hasPrint === true).length / addedEvents.length) * 100) / 100 : null,
  };
}
