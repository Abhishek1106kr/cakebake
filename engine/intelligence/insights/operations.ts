// Operational insights (admin command centre): custom cake production deadlines,
// automation reliability, payment failures, demand and search trends. Same
// contract as the core insights: what, why, evidence, confidence, next step.
// Observations only; any action goes through the decision engine's levels.

import type { Product } from '@/lib/data';
import type { Order } from '@/lib/orders';
import { customHours, hasCustom, requiredBy } from '@/lib/admin/order-ops';
import { runOperation, type IntelligenceResult } from '../core/contract';
import type { TresorEvent } from '../events/schema';
import type { Insight } from './insights';

export const OPERATIONS_INSIGHTS_VERSION = 'ops-insights-v1';

export type JobLike = { id: string; kind: 'invoice' | 'whatsapp'; orderId: string; topic: string; status: string; attempts: number; lastError: string | null; updatedAt: string };
export type OperationsInput = { orders: Order[]; jobs: JobLike[]; events: TresorEvent[]; products: Product[]; now: Date };

const DAY = 86400000;
const pct = (a: number, b: number) => Math.round(((a - b) / Math.max(b, 1)) * 100);

export function generateOperationalInsights(input: OperationsInput): IntelligenceResult<Insight[]> {
  return runOperation('insights.operations', () => {
    const { orders, jobs, events, products, now } = input;
    const t = now.getTime();
    const out: Insight[] = [];
    const warnings: string[] = [];
    const name = (id: string) => products.find((p) => p.id === id)?.name ?? id;

    // ---- Custom cakes that must start soon (production time counted back from the slot) ----
    const pendingCakes = orders.filter((o) => hasCustom(o) && (o.status === 'NEW' || o.status === 'CONFIRMED'));
    const startSoon = pendingCakes.filter((o) => requiredBy(o).getTime() - customHours(o) * 3600000 - t <= 4 * 3600000);
    if (startSoon.length) {
      const overdue = startSoon.filter((o) => requiredBy(o).getTime() - customHours(o) * 3600000 < t);
      out.push({
        id: `custom:start:${startSoon.map((o) => o.id).join(',')}`, kind: 'custom', severity: 'act',
        title: `${startSoon.length} custom cake${startSoon.length === 1 ? ' needs' : 's need'} preparation within 4 hours`,
        detail: `${startSoon.map((o) => o.id).join(', ')}.${overdue.length ? ` ${overdue.length} should already have started.` : ''} Production time is counted back from each delivery slot.`,
        evidence: [
          { kind: 'data', label: 'Custom cakes not started', value: pendingCakes.length },
          { kind: 'rule', label: 'Start by', value: 'slot start − production hours' },
          ...startSoon.slice(0, 4).map((o) => ({ kind: 'data' as const, label: o.id, value: `${customHours(o)} h · slot ${o.slot}` })),
        ],
        confidence: 0.95, next: { label: 'Open urgent custom cakes', href: '/admin/custom-cakes?view=URGENT' },
      });
    }
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
    const dueTomorrow = orders.filter((o) => hasCustom(o) && o.status !== 'CANCELLED' && requiredBy(o).toDateString() === tomorrow.toDateString());
    if (dueTomorrow.length) {
      out.push({
        id: `custom:tomorrow:${tomorrow.toISOString().slice(0, 10)}:${dueTomorrow.length}`, kind: 'custom', severity: 'info',
        title: `${dueTomorrow.length} custom cake${dueTomorrow.length === 1 ? '' : 's'} due tomorrow`,
        detail: `Plan sponge and frosting prep today: ${dueTomorrow.map((o) => o.id).join(', ')}.`,
        evidence: [{ kind: 'data', label: 'Due tomorrow', value: dueTomorrow.length }],
        confidence: 0.95, next: { label: 'See upcoming cakes', href: '/admin/custom-cakes?view=UPCOMING' },
      });
    }

    // ---- Automation reliability ----
    const failed = jobs.filter((j) => j.status === 'failed');
    for (const j of failed.slice(0, 3)) {
      out.push({
        id: `automation:${j.id}`, kind: 'automation', severity: 'act',
        title: `${j.kind === 'invoice' ? 'Invoice' : `WhatsApp ${j.topic === 'confirmation' ? 'confirmation' : j.topic.replace('status:', '').toLowerCase().replace(/_/g, ' ')}`} failed for #${j.orderId}`,
        detail: `${j.lastError ?? 'Unknown error'} after ${j.attempts} attempts. The order itself is unaffected.`,
        evidence: [{ kind: 'data', label: 'Job', value: j.id }, { kind: 'data', label: 'Attempts', value: j.attempts }, { kind: 'data', label: 'Last error', value: j.lastError ?? '—' }],
        confidence: 1, next: { label: 'Retry in Automations', href: `/admin/automations?job=${encodeURIComponent(j.id)}` },
      });
    }
    if (failed.length > 3) warnings.push(`${failed.length - 3} more failed jobs not listed`);

    // ---- Payment failures: last 24 h against the 24 h before ----
    const failuresIn = (from: number, to: number) => events.filter((e) => e.type === 'payment_failure' && Date.parse(e.timestamp) >= from && Date.parse(e.timestamp) < to).length;
    const payNow = failuresIn(t - DAY, t + 1);
    const payBefore = failuresIn(t - 2 * DAY, t - DAY);
    if (payNow >= 3 && payNow > payBefore) {
      out.push({
        id: `payment:${now.toISOString().slice(0, 10)}:${payNow}`, kind: 'payment', severity: 'watch',
        title: 'Payment failures increased',
        detail: `${payNow} failed payment attempts in the last 24 hours, against ${payBefore} the day before. No orders were created for them.`,
        evidence: [{ kind: 'metric', label: 'Last 24 h', value: payNow }, { kind: 'metric', label: 'Previous 24 h', value: payBefore }],
        confidence: Math.min(0.9, 0.5 + payNow * 0.05), next: { label: 'Open payment analytics', href: '/admin/analytics#payments' },
      });
    }

    // ---- Demand: units this week against last week, per product and for custom cakes ----
    const units = (from: number, to: number) => {
      const m = new Map<string, number>();
      for (const o of orders) {
        const at = Date.parse(o.createdAt);
        if (o.status === 'CANCELLED' || at < from || at >= to) continue;
        for (const l of o.items) { const key = l.custom ? 'custom-cake' : l.product.id; m.set(key, (m.get(key) ?? 0) + l.qty); }
      }
      return m;
    };
    const thisWeek = units(t - 7 * DAY, t + 1);
    const lastWeek = units(t - 14 * DAY, t - 7 * DAY);
    const historyDays = orders.length ? (t - Math.min(...orders.map((o) => Date.parse(o.createdAt)))) / DAY : 0;
    if (historyDays < 8) warnings.push('less than 8 days of orders; week-on-week demand trends need two weeks');
    else {
      const rising = [...thisWeek.entries()].filter(([id, n]) => n >= 5 && n >= (lastWeek.get(id) ?? 0) * 1.25).sort((a, b) => pct(b[1], lastWeek.get(b[0]) ?? 0) - pct(a[1], lastWeek.get(a[0]) ?? 0));
      for (const [id, n] of rising.slice(0, 2)) {
        const before = lastWeek.get(id) ?? 0;
        const label = id === 'custom-cake' ? 'Custom cake' : name(id);
        out.push({
          id: `demand:${id}:${n}:${before}`, kind: 'demand', severity: 'info',
          title: `${label} demand is up ${before ? `${pct(n, before)}%` : `to ${n} this week`}`,
          detail: `${n} sold in the last 7 days against ${before} the week before.${id === 'custom-cake' ? ' Check sponge and frosting stock.' : ' Consider featuring it, and check its ingredients.'}`,
          evidence: [{ kind: 'metric', label: 'Last 7 days', value: n }, { kind: 'metric', label: 'Previous 7 days', value: before }],
          confidence: Math.min(0.85, 0.4 + n * 0.03), next: id === 'custom-cake' ? { label: 'Open custom cakes', href: '/admin/custom-cakes' } : { label: 'Open product', href: `/admin/products?p=${id}` },
        });
      }
    }

    // ---- Search: phrases asked for more this week than last ----
    const searches = (from: number, to: number) => {
      const m = new Map<string, number>();
      for (const e of events) {
        if (e.type !== 'search_completed') continue;
        const at = Date.parse(e.timestamp);
        if (at < from || at >= to) continue;
        const q = String(e.payload.query ?? '').trim().toLowerCase();
        if (q.length >= 3) m.set(q, (m.get(q) ?? 0) + 1);
      }
      return m;
    };
    const sNow = searches(t - 7 * DAY, t + 1);
    const sBefore = searches(t - 14 * DAY, t - 7 * DAY);
    const risingSearch = [...sNow.entries()].filter(([q, n]) => n >= 3 && n > (sBefore.get(q) ?? 0) * 1.5).sort((a, b) => b[1] - a[1]).slice(0, 2);
    for (const [q, n] of risingSearch) {
      out.push({
        id: `searchtrend:${q}:${n}`, kind: 'search', severity: 'info',
        title: `Searches for “${q}” are increasing`,
        detail: `${n} this week against ${sBefore.get(q) ?? 0} the week before. Make sure the menu answers it.`,
        evidence: [{ kind: 'metric', label: 'Last 7 days', value: n }, { kind: 'metric', label: 'Previous 7 days', value: sBefore.get(q) ?? 0 }],
        confidence: Math.min(0.8, 0.4 + n * 0.05), next: { label: 'See search analytics', href: '/admin/analytics#search' },
      });
    }

    return {
      result: out, confidence: out.length ? out.reduce((s, i) => s + i.confidence, 0) / out.length : 1,
      evidence: [{ kind: 'data', label: 'Orders', value: orders.length }, { kind: 'data', label: 'Jobs', value: jobs.length }, { kind: 'data', label: 'Events', value: events.length }],
      provider: 'rules', providerKind: 'deterministic', modelVersion: OPERATIONS_INSIGHTS_VERSION, rankingVersion: null, fallbackUsed: false, warnings,
    };
  });
}
