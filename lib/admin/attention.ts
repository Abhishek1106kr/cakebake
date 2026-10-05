// What needs attention, derived from current state on every change (never typed in
// by hand, so it can't go stale). Each item has a stable id, so staff can mark it
// read or resolved; when the underlying condition clears, the item disappears.

import { STATUS_LABEL, type Order } from '@/lib/orders';
import { stockLevel, availableQty, type Ingredient } from '@/lib/inventory';
import type { Job } from '@/lib/automation/automation';
import type { TresorEvent } from '@/engine/intelligence';
import { dueState, hasCustom, requiredBy, customHours } from './order-ops';
import type { SeedNotification } from '@/lib/mock-data/types';

export type AttentionKind = 'NEW_ORDER' | 'LATE_ORDER' | 'LOW_STOCK' | 'CUSTOM_CAKE_DUE' | 'INVOICE_FAILED' | 'WHATSAPP_FAILED' | 'PAYMENT_FAILED' | 'DELIVERY_DELAY' | 'REFUND_PENDING' | 'SYSTEM_ISSUE' | 'ISSUE_CREATED';
export type AttentionSeverity = 'critical' | 'warning' | 'info';
export type AttentionState = 'UNREAD' | 'READ' | 'RESOLVED';

export type AttentionItem = {
  id: string;
  kind: AttentionKind;
  severity: AttentionSeverity;
  title: string;
  detail: string;
  href: string;
  at: string;
  entityId: string;
};

export const KIND_LABEL: Record<AttentionKind, string> = {
  NEW_ORDER: 'New order', LATE_ORDER: 'Late order', LOW_STOCK: 'Low stock', CUSTOM_CAKE_DUE: 'Custom cake due', INVOICE_FAILED: 'Invoice failed',
  WHATSAPP_FAILED: 'WhatsApp failed', PAYMENT_FAILED: 'Payment failed', DELIVERY_DELAY: 'Delivery delay', REFUND_PENDING: 'Refund pending', SYSTEM_ISSUE: 'System issue', ISSUE_CREATED: 'Customer issue',
};

export type AttentionInput = {
  orders: Order[];
  inventory: Ingredient[];
  jobs: Job[];
  events: TresorEvent[];
  now: Date;
  thresholds: { lowStock: boolean; customCakeDueHours: number; deliveryDelayMinutes: number };
  /** Orders created after this are "new" (the admin's last visit, or the last hour). */
  newSince: string;
  storageWarning?: string | null;
};

const SEVERITY_RANK: Record<AttentionSeverity, number> = { critical: 0, warning: 1, info: 2 };
const orderHref = (id: string) => `/admin/orders/${id}`;

export function deriveAttention(input: AttentionInput): AttentionItem[] {
  const { orders, inventory, jobs, events, now, thresholds } = input;
  const out: AttentionItem[] = [];
  const iso = now.toISOString();

  for (const o of orders) {
    if (o.source === 'online' && o.createdAt > input.newSince && (o.status === 'NEW' || o.status === 'CONFIRMED')) {
      out.push({ id: `new:${o.id}`, kind: 'NEW_ORDER', severity: 'info', title: `New order ${o.id}`, detail: `₹${o.total.toLocaleString('en-IN')} · ${o.items.length} item${o.items.length === 1 ? '' : 's'}${hasCustom(o) ? ' · custom cake' : ''}`, href: orderHref(o.id), at: o.createdAt, entityId: o.id });
    }
    const due = dueState(o, now);
    if (due === 'late' && o.status !== 'OUT_FOR_DELIVERY') {
      out.push({ id: `late:${o.id}`, kind: 'LATE_ORDER', severity: 'critical', title: `${o.id} is past its slot`, detail: `${STATUS_LABEL[o.status]} · slot ${o.slot}`, href: orderHref(o.id), at: requiredBy(o).toISOString(), entityId: o.id });
    }
    if (o.status === 'OUT_FOR_DELIVERY') {
      const out_ = [...o.history].reverse().find((h) => h.status === 'OUT_FOR_DELIVERY')?.at;
      const mins = out_ ? (now.getTime() - new Date(out_).getTime()) / 60000 : 0;
      if (mins > thresholds.deliveryDelayMinutes) out.push({ id: `delay:${o.id}`, kind: 'DELIVERY_DELAY', severity: 'warning', title: `${o.id} has been out for ${Math.round(mins)} min`, detail: `Longer than the ${thresholds.deliveryDelayMinutes} min alert. Check with the rider.`, href: orderHref(o.id), at: out_ ?? iso, entityId: o.id });
    }
    if (hasCustom(o) && (o.status === 'NEW' || o.status === 'CONFIRMED')) {
      const startBy = requiredBy(o).getTime() - customHours(o) * 3600000;
      const hoursToStart = (startBy - now.getTime()) / 3600000;
      if (hoursToStart <= thresholds.customCakeDueHours) {
        out.push({ id: `cake:${o.id}`, kind: 'CUSTOM_CAKE_DUE', severity: hoursToStart <= 0 ? 'critical' : 'warning', title: hoursToStart <= 0 ? `Custom cake for ${o.id} should have started` : `Start the custom cake for ${o.id} within ${Math.max(1, Math.round(hoursToStart))} h`, detail: `Needs about ${customHours(o)} h · slot ${o.slot}`, href: `/admin/custom-cakes?order=${o.id}`, at: new Date(startBy).toISOString(), entityId: o.id });
      }
    }
    if (o.paymentStatus === 'REFUND_PENDING') out.push({ id: `refund:${o.id}`, kind: 'REFUND_PENDING', severity: 'warning', title: `Refund pending for ${o.id}`, detail: `₹${o.total.toLocaleString('en-IN')} paid by ${o.paymentMethod}; the order was cancelled.`, href: orderHref(o.id), at: o.history[o.history.length - 1]?.at ?? o.createdAt, entityId: o.id });
  }

  if (thresholds.lowStock) {
    for (const i of inventory) {
      const level = stockLevel(i);
      if (level === 'HEALTHY') continue;
      out.push({ id: `stock:${i.id}:${level}`, kind: 'LOW_STOCK', severity: level === 'LOW' ? 'warning' : 'critical', title: level === 'OUT' ? `${i.name} is out` : `${i.name} is ${level.toLowerCase()}`, detail: `${availableQty(i)} ${i.unit} available · reorder at ${i.reorderPoint} ${i.unit}`, href: `/admin/inventory?item=${i.id}`, at: iso, entityId: i.id });
    }
  }

  for (const j of jobs) {
    if (j.status !== 'failed') continue;
    const invoice = j.kind === 'invoice';
    out.push({ id: `job:${j.id}`, kind: invoice ? 'INVOICE_FAILED' : 'WHATSAPP_FAILED', severity: 'critical', title: `${invoice ? 'Invoice' : 'WhatsApp'} failed for ${j.orderId}`, detail: `${j.lastError ?? 'Unknown error'} · ${j.attempts} attempts. The order is safe.`, href: `/admin/automations?job=${encodeURIComponent(j.id)}`, at: j.updatedAt, entityId: j.orderId });
  }

  // Failed payments never create an order; they are recorded as events only.
  const dayAgo = now.getTime() - 86400000;
  const failures = events.filter((e) => e.type === 'payment_failure' && Date.parse(e.timestamp) >= dayAgo);
  if (failures.length) {
    const last = failures[failures.length - 1];
    out.push({ id: `payfail:${now.toISOString().slice(0, 10)}:${failures.length}`, kind: 'PAYMENT_FAILED', severity: failures.length >= 3 ? 'warning' : 'info', title: `${failures.length} payment attempt${failures.length === 1 ? '' : 's'} failed today`, detail: `Last: ${String(last.payload.method ?? '')} ${String(last.payload.reason ?? '')}. No order was created and no money was taken.`, href: '/admin/analytics#payments', at: last.timestamp, entityId: 'payments' });
  }

  if (input.storageWarning) out.push({ id: 'system:storage', kind: 'SYSTEM_ISSUE', severity: 'warning', title: 'Browser storage is nearly full', detail: input.storageWarning, href: '/admin/settings#security', at: iso, entityId: 'system' });

  return out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.at.localeCompare(a.at));
}

/** Visible items: resolved ones hidden, read ones kept but quieter. */
export function withStates(items: AttentionItem[], states: Record<string, AttentionState>): (AttentionItem & { state: AttentionState })[] {
  return items.map((i) => ({ ...i, state: states[i.id] ?? 'UNREAD' })).filter((i) => i.state !== 'RESOLVED');
}

/**
 * The shipped notification history as attention items. Unresolved low stock, failed jobs and cake
 * deadlines are left out: the live checks above raise those from the current records.
 */
export function seedAttention(notes: SeedNotification[]): (AttentionItem & { seedState: AttentionState })[] {
  const KIND: Record<SeedNotification['type'], AttentionKind> = {
    PAYMENT_FAILURE: 'PAYMENT_FAILED', ORDER_URGENT: 'LATE_ORDER', LOW_STOCK: 'LOW_STOCK', ISSUE_CREATED: 'ISSUE_CREATED',
    AUTOMATION_FAILURE: 'WHATSAPP_FAILED', CUSTOM_CAKE_DEADLINE: 'CUSTOM_CAKE_DUE', DELIVERY_DELAY: 'DELIVERY_DELAY',
  };
  const live = new Set<SeedNotification['type']>(['LOW_STOCK', 'AUTOMATION_FAILURE', 'CUSTOM_CAKE_DEADLINE', 'ORDER_URGENT']);
  return notes
    .filter((n) => n.state === 'RESOLVED' || !live.has(n.type))
    .map((n) => ({
      id: `seed:${n.id}`, kind: KIND[n.type], severity: n.type === 'ISSUE_CREATED' || n.type === 'DELIVERY_DELAY' || n.type === 'LOW_STOCK' ? 'warning' : 'info',
      title: n.title, detail: n.body, href: n.href, at: n.createdAt, entityId: n.resourceId, seedState: n.state,
    }));
}
