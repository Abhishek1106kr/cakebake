// The facts the copilot's language model may use. Built in the browser from the same records
// the admin shows, kept small (the server caps it), and free of customer contact details:
// names are reduced to first names, phones and emails are never included.

import type { Order } from '@/lib/orders';
import { isActive, isSameDay, itemsSummary, STATUS_LABEL } from '@/lib/orders';
import type { Ingredient } from '@/lib/inventory';
import { availableQty, stockLevel } from '@/lib/inventory';
import { dueState, requiredBy } from './order-ops';

export const COPILOT_CONTEXT_LIMIT = 16_000; // characters of JSON; the server refuses more

type Job = { kind: string; orderId: string; topic: string; status: string; attempts: number; lastError: string | null };
export type RuleAnswer = { topic: string; answer: string; facts: { label: string; value: string }[] };

const day = (d: Date, offset = 0) => { const x = new Date(d); x.setDate(x.getDate() + offset); return x; };
const revenueOn = (orders: Order[], d: Date) => orders.filter((o) => o.status !== 'CANCELLED' && isSameDay(o.createdAt, d)).reduce((s, o) => s + o.total, 0);
const countOn = (orders: Order[], d: Date) => orders.filter((o) => o.status !== 'CANCELLED' && isSameDay(o.createdAt, d)).length;
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

export function buildCopilotContext(input: { orders: Order[]; inventory: Ingredient[]; jobs: Job[]; now: Date; rule?: RuleAnswer | null }) {
  const { orders, inventory, jobs, now } = input;
  const last7 = [...Array(7)].map((_, i) => day(now, -i));
  const since30 = now.getTime() - 30 * 86400000;
  const recent = orders.filter((o) => new Date(o.createdAt).getTime() >= since30 && o.status !== 'CANCELLED');

  const units: Record<string, { name: string; units: number; revenue: number }> = {};
  for (const o of recent) for (const l of o.items) {
    const key = l.custom ? 'custom-cake' : l.product.id;
    const row = (units[key] ??= { name: l.custom ? 'Custom cakes' : l.product.name, units: 0, revenue: 0 });
    row.units += l.qty; row.revenue += l.unitPrice * l.qty;
  }

  const active = orders.filter(isActive).sort((a, b) => requiredBy(a).getTime() - requiredBy(b).getTime());
  const customSoon = orders.filter((o) => isActive(o) && o.items.some((l) => l.custom) && requiredBy(o).getTime() - now.getTime() < 72 * 3600000);

  const context = {
    note: 'Demo bakery with mock data. Amounts in Indian rupees. Times are local.',
    now: now.toISOString(),
    today: { revenue: revenueOn(orders, now), orders: countOn(orders, now), cancelled: orders.filter((o) => o.status === 'CANCELLED' && isSameDay(o.createdAt, now)).length },
    yesterday: { revenue: revenueOn(orders, day(now, -1)), orders: countOn(orders, day(now, -1)) },
    last7Days: last7.map((d) => ({ date: d.toISOString().slice(0, 10), revenue: revenueOn(orders, d), orders: countOn(orders, d) })),
    last30Days: {
      orders: recent.length,
      revenue: recent.reduce((s, o) => s + o.total, 0),
      topItems: Object.values(units).sort((a, b) => b.revenue - a.revenue).slice(0, 8),
      paymentMix: ['UPI', 'Card', 'COD'].map((m) => ({ method: m, orders: recent.filter((o) => o.paymentMethod === m).length })),
    },
    activeOrders: active.slice(0, 25).map((o) => ({
      order: o.id, status: STATUS_LABEL[o.status], due: requiredBy(o).toISOString(), timing: dueState(o, now),
      items: itemsSummary(o).slice(0, 120), total: o.total, customer: firstName(o.customer.name), custom: o.items.some((l) => l.custom),
    })),
    activeOrderCount: active.length,
    customCakesNext72h: customSoon.slice(0, 12).map((o) => ({ order: o.id, due: requiredBy(o).toISOString(), status: STATUS_LABEL[o.status], cakes: o.items.filter((l) => l.custom).map((l) => l.custom!.title).join('; ').slice(0, 140) })),
    refundsPending: orders.filter((o) => o.paymentStatus === 'REFUND_PENDING').map((o) => ({ order: o.id, total: o.total })).slice(0, 10),
    stock: inventory
      .map((i) => ({ item: i.name, unit: i.unit, available: Math.round(availableQty(i) * 1000) / 1000, reorderAt: i.reorderPoint, level: stockLevel(i) }))
      .filter((i) => i.level !== 'HEALTHY'),
    automations: {
      failed: jobs.filter((j) => j.status === 'failed').slice(0, 10).map((j) => ({ kind: j.kind, order: j.orderId, topic: j.topic, error: (j.lastError ?? '').slice(0, 100) })),
      retrying: jobs.filter((j) => j.status === 'retrying').length,
    },
    ruleBasedAnswer: input.rule ? { topic: input.rule.topic, answer: input.rule.answer, facts: input.rule.facts.slice(0, 10) } : null,
  };

  // Stay under the server's limit: drop the longest lists first.
  let json = JSON.stringify(context);
  for (const trim of ['activeOrders', 'last7Days', 'customCakesNext72h'] as const) {
    if (json.length <= COPILOT_CONTEXT_LIMIT) break;
    (context as Record<string, unknown>)[trim] = (context[trim] as unknown[]).slice(0, 5);
    json = JSON.stringify(context);
  }
  return context;
}
