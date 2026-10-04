// Admin analytics beyond the engine's core metrics. Pure functions over orders,
// events and jobs; each returns the count of records it is based on, so every
// number on the page can say where it came from.

import type { Order, OrderStatus } from '@/lib/orders';
import type { Job } from '@/lib/automation/automation';
import type { TresorEvent } from '@/engine/intelligence';

const DAY = 86400000;
const counted = (o: Order) => o.status !== 'CANCELLED';

export type PeriodSummary = { revenue: number; orders: number; aov: number; cancelled: number; customCakes: number; basedOn: number };

export function periodSummary(orders: Order[], from: number, to: number): PeriodSummary {
  const inRange = orders.filter((o) => { const t = Date.parse(o.createdAt); return t >= from && t < to; });
  const ok = inRange.filter(counted);
  const revenue = ok.reduce((s, o) => s + o.total, 0);
  return { revenue, orders: ok.length, aov: ok.length ? Math.round(revenue / ok.length) : 0, cancelled: inRange.length - ok.length, customCakes: ok.reduce((s, o) => s + o.items.filter((l) => l.custom).reduce((n, l) => n + l.qty, 0), 0), basedOn: inRange.length };
}

/** This period and the one before it, for "vs previous" deltas. */
export function comparePeriods(orders: Order[], now: Date, days: number) {
  const t = now.getTime();
  return { current: periodSummary(orders, t - days * DAY, t + 1), previous: periodSummary(orders, t - 2 * days * DAY, t - days * DAY) };
}

export const delta = (a: number, b: number): number | null => (b ? Math.round(((a - b) / b) * 100) : null);

export function dailySeries(orders: Order[], now: Date, days: number): { date: string; revenue: number; orders: number }[] {
  const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (days - 1));
  const out = Array.from({ length: days }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return { date: d.toISOString().slice(0, 10), revenue: 0, orders: 0, key: d.toDateString() }; });
  const byKey = new Map(out.map((d) => [d.key, d]));
  for (const o of orders) { if (!counted(o)) continue; const d = byKey.get(new Date(o.createdAt).toDateString()); if (d) { d.revenue += o.total; d.orders += 1; } }
  return out.map(({ key: _k, ...rest }) => rest);
}

export function categoryPerformance(orders: Order[]): { category: string; units: number; revenue: number; share: number }[] {
  const m = new Map<string, { units: number; revenue: number }>();
  let total = 0;
  for (const o of orders) if (counted(o)) for (const l of o.items) {
    const cat = l.custom ? 'Custom cake' : l.product.category || 'Other';
    const cur = m.get(cat) ?? { units: 0, revenue: 0 };
    m.set(cat, { units: cur.units + l.qty, revenue: cur.revenue + l.unitPrice * l.qty });
    total += l.unitPrice * l.qty;
  }
  return [...m.entries()].map(([category, v]) => ({ category, ...v, share: total ? v.revenue / total : 0 })).sort((a, b) => b.revenue - a.revenue);
}

export type CheckoutStats = { started: number; paymentStarted: number; paid: number; failed: number; orders: number; completion: number | null };
export function checkoutStats(events: TresorEvent[]): CheckoutStats {
  const sessions = (type: string) => new Set(events.filter((e) => e.type === type && e.sessionId).map((e) => e.sessionId)).size;
  const started = sessions('checkout_started');
  const orders = events.filter((e) => e.type === 'order_created').length;
  return { started, paymentStarted: events.filter((e) => e.type === 'payment_started').length, paid: events.filter((e) => e.type === 'payment_success' && !e.payload.refund).length, failed: events.filter((e) => e.type === 'payment_failure').length, orders, completion: started ? Math.min(1, sessions('order_created') / started) : null };
}

export function paymentStats(orders: Order[], events: TresorEvent[]) {
  const byMethod = new Map<string, { orders: number; revenue: number }>();
  for (const o of orders) if (counted(o)) { const cur = byMethod.get(o.paymentMethod) ?? { orders: 0, revenue: 0 }; byMethod.set(o.paymentMethod, { orders: cur.orders + 1, revenue: cur.revenue + o.total }); }
  const failures = new Map<string, number>();
  for (const e of events) if (e.type === 'payment_failure') { const k = `${e.payload.method ?? '?'} · ${e.payload.reason ?? 'unknown'}`; failures.set(k, (failures.get(k) ?? 0) + 1); }
  return {
    byMethod: [...byMethod.entries()].map(([method, v]) => ({ method, ...v })).sort((a, b) => b.revenue - a.revenue),
    failures: [...failures.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    refundPending: orders.filter((o) => o.paymentStatus === 'REFUND_PENDING').length,
    refunded: orders.filter((o) => o.paymentStatus === 'REFUNDED').length,
    codDue: orders.filter((o) => o.paymentStatus === 'DUE' && o.status !== 'CANCELLED').reduce((s, o) => s + o.total, 0),
  };
}

const STAGES: [OrderStatus, OrderStatus, string][] = [
  ['CONFIRMED', 'PREPARING', 'Confirmed → started'], ['PREPARING', 'READY', 'Preparing → ready'], ['READY', 'OUT_FOR_DELIVERY', 'Ready → with rider'], ['OUT_FOR_DELIVERY', 'DELIVERED', 'Out → delivered'],
];

/** Median and p90 minutes for each step, from the orders' own status history (custom cakes excluded: they run for hours by design). */
export function deliveryStages(orders: Order[]): { label: string; median: number | null; p90: number | null; count: number }[] {
  return STAGES.map(([from, to, label]) => {
    const mins: number[] = [];
    for (const o of orders) {
      if (o.items.some((l) => l.custom)) continue;
      const a = o.history.find((h) => h.status === from)?.at; const b = o.history.find((h) => h.status === to)?.at;
      if (a && b) mins.push((Date.parse(b) - Date.parse(a)) / 60000);
    }
    mins.sort((x, y) => x - y);
    const q = (p: number) => (mins.length ? Math.round(mins[Math.min(mins.length - 1, Math.floor(p * mins.length))]) : null);
    return { label, median: q(0.5), p90: q(0.9), count: mins.length };
  });
}

export function notificationStats(jobs: Job[]) {
  const rows = new Map<string, { kind: string; total: number; succeeded: number; failed: number; retried: number }>();
  for (const j of jobs) {
    const key = j.kind === 'invoice' ? 'Invoice' : j.topic === 'confirmation' ? 'WhatsApp · confirmation' : 'WhatsApp · status updates';
    const cur = rows.get(key) ?? { kind: key, total: 0, succeeded: 0, failed: 0, retried: 0 };
    cur.total += 1; if (j.status === 'succeeded') cur.succeeded += 1; if (j.status === 'failed') cur.failed += 1; if (j.attempts > 1) cur.retried += 1;
    rows.set(key, cur);
  }
  return [...rows.values()];
}

export function recommendationStats(events: TresorEvent[]) {
  const m = new Map<string, { shown: number; clicked: number }>();
  for (const e of events) {
    if (e.type !== 'recommendation_shown' && e.type !== 'recommendation_clicked') continue;
    const s = String(e.payload.surface ?? 'unknown');
    const cur = m.get(s) ?? { shown: 0, clicked: 0 };
    if (e.type === 'recommendation_shown') cur.shown += 1; else cur.clicked += 1;
    m.set(s, cur);
  }
  return [...m.entries()].map(([surface, v]) => ({ surface, ...v, ctr: v.shown ? v.clicked / v.shown : null })).sort((a, b) => b.shown - a.shown);
}

export function analyticsCsvRows(series: { date: string; revenue: number; orders: number }[]): (string | number)[][] {
  return [['Date', 'Orders', 'Revenue', 'Average order'], ...series.map((d) => [d.date, d.orders, d.revenue, d.orders ? Math.round(d.revenue / d.orders) : 0])];
}
