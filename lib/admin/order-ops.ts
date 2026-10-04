// Operational view of orders: when each is needed, how urgent it is, and the
// filters, sorts, searches and bulk plans the admin runs over them. Pure functions
// over the shared order records (the same ones the shop and tracking page use).

import { STATUS_LABEL, isActive, prepTarget, type Order, type OrderStatus } from '@/lib/orders';
import { needsFor, type Ingredient } from '@/lib/inventory';
import { canTransition } from '@/lib/tracking/status';
import type { AutomationEvent } from '@/lib/automation/automation';
import type { AuditRecord } from './audit';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DELIVERY_MIN = 35;

export const hasCustom = (o: Order) => o.items.some((l) => l.custom);
export const customHours = (o: Order) => o.items.reduce((m, l) => Math.max(m, l.custom?.productionHours ?? 0), 0);

/**
 * When the order has to be ready (start of its delivery window). Slots are stored as
 * text: "18:00–20:00" (the day it was placed, or the next day if that window had
 * passed), "Sat, 10 Oct · 10:00–12:00" (custom cakes), or "As soon as possible".
 */
export function requiredBy(order: Pick<Order, 'slot' | 'createdAt' | 'items'>): Date {
  const placed = new Date(order.createdAt);
  const time = order.slot.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
  if (!time) return new Date(placed.getTime() + (prepTarget(order as Order) + 5) * 60000);
  const day = new Date(placed);
  const dated = order.slot.toLowerCase().match(/(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
  if (dated) {
    day.setMonth(MONTHS.indexOf(dated[2]), Number(dated[1]));
    if (day.getTime() < placed.getTime() - 86400000) day.setFullYear(day.getFullYear() + 1);
  }
  day.setHours(Number(time[1]), Number(time[2]), 0, 0);
  if (!dated) {
    const end = new Date(day); end.setHours(Number(time[3]), Number(time[4]), 0, 0);
    if (end.getTime() < placed.getTime()) day.setDate(day.getDate() + 1);
  }
  return day;
}

/** End of the delivery window: after this, an undelivered order is late for the customer. */
export function deliverBy(order: Pick<Order, 'slot' | 'createdAt' | 'items'>): Date {
  const start = requiredBy(order);
  const time = order.slot.match(/[–-]\s*(\d{1,2}):(\d{2})/);
  if (!time) return new Date(start.getTime() + DELIVERY_MIN * 60000);
  const end = new Date(start); end.setHours(Number(time[1]), Number(time[2]), 0, 0);
  return end < start ? new Date(start.getTime() + 2 * 3600000) : end;
}

export type DueState = 'late' | 'at-risk' | 'on-track' | 'done';
export type Priority = 'URGENT' | 'HIGH' | 'NORMAL';

/** Minutes of kitchen work still ahead of an order. */
function workLeft(o: Order): number {
  if (o.status === 'NEW' || o.status === 'CONFIRMED') return prepTarget(o);
  if (o.status === 'PREPARING') return Math.ceil(prepTarget(o) / 2);
  return 0;
}

/**
 * On track, at risk or late. Before READY the deadline is the start of the slot; out for
 * delivery it is the end of the window. At risk: less than 30 minutes of slack (2 hours
 * for custom cakes, which can't be rushed).
 */
export function dueState(o: Order, now: Date): DueState {
  if (!isActive(o)) return 'done';
  const deadline = o.status === 'OUT_FOR_DELIVERY' || o.status === 'READY' ? deliverBy(o) : requiredBy(o);
  const slack = (deadline.getTime() - now.getTime()) / 60000 - workLeft(o);
  if (now > deadline) return 'late';
  return slack < (hasCustom(o) ? 120 : 30) ? 'at-risk' : 'on-track';
}

export function priorityOf(o: Order, now: Date): Priority {
  const due = dueState(o, now);
  if (due === 'late' || due === 'at-risk') return 'URGENT';
  const hoursLeft = (requiredBy(o).getTime() - now.getTime()) / 3600000;
  if (isActive(o) && (hoursLeft < 2 || (hasCustom(o) && hoursLeft < 24))) return 'HIGH';
  return 'NORMAL';
}

const PRIORITY_RANK: Record<Priority, number> = { URGENT: 0, HIGH: 1, NORMAL: 2 };

// ---------- Filters, search, sort, pages ----------

export type AdminOrderFilter = 'ALL' | 'ACTIVE' | 'NEW' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | 'PAYMENT_FAILED' | 'REFUND_PENDING' | 'URGENT';
export const ORDER_FILTERS: { id: AdminOrderFilter; label: string }[] = [
  { id: 'ACTIVE', label: 'Active' }, { id: 'URGENT', label: 'Urgent' }, { id: 'NEW', label: 'New' }, { id: 'CONFIRMED', label: 'Confirmed' },
  { id: 'PREPARING', label: 'Preparing' }, { id: 'READY', label: 'Ready' }, { id: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { id: 'DELIVERED', label: 'Delivered' }, { id: 'CANCELLED', label: 'Cancelled' }, { id: 'REFUND_PENDING', label: 'Refund pending' },
  { id: 'PAYMENT_FAILED', label: 'Payment failed' }, { id: 'ALL', label: 'All' },
];

export function matchesFilter(o: Order, f: AdminOrderFilter, now: Date): boolean {
  switch (f) {
    case 'ALL': return true;
    case 'ACTIVE': return isActive(o);
    case 'URGENT': return priorityOf(o, now) === 'URGENT';
    case 'PAYMENT_FAILED': return o.paymentStatus === 'FAILED';
    case 'REFUND_PENDING': return o.paymentStatus === 'REFUND_PENDING';
    default: return o.status === f;
  }
}

const digits = (s: string) => s.replace(/\D/g, '');

/** Order number, customer name, phone, email, product, or custom cake (design id / title). */
export function matchesQuery(o: Order, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const qd = digits(q);
  return o.id.toLowerCase().includes(q)
    || o.customer.name.toLowerCase().includes(q)
    || (qd.length >= 3 && digits(o.customer.phone).includes(qd))
    || (o.customer.email ?? '').toLowerCase().includes(q)
    || o.items.some((l) => l.product.name.toLowerCase().includes(q) || l.product.id.includes(q) || (l.custom && (l.custom.designId.toLowerCase().includes(q) || l.custom.title.toLowerCase().includes(q) || q === 'custom cake' || q === 'custom')));
}

export type OrderSort = 'newest' | 'oldest' | 'value' | 'due' | 'priority';
export const ORDER_SORTS: { id: OrderSort; label: string }[] = [
  { id: 'newest', label: 'Newest' }, { id: 'oldest', label: 'Oldest' }, { id: 'value', label: 'Highest value' }, { id: 'due', label: 'Delivery time' }, { id: 'priority', label: 'Priority' },
];

export function sortOrders(list: Order[], sort: OrderSort, now: Date): Order[] {
  const by = [...list];
  switch (sort) {
    case 'oldest': return by.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case 'value': return by.sort((a, b) => b.total - a.total || b.createdAt.localeCompare(a.createdAt));
    case 'due': return by.sort((a, b) => requiredBy(a).getTime() - requiredBy(b).getTime());
    case 'priority': return by.sort((a, b) => PRIORITY_RANK[priorityOf(a, now)] - PRIORITY_RANK[priorityOf(b, now)] || requiredBy(a).getTime() - requiredBy(b).getTime());
    default: return by.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export function queryOrders(orders: Order[], opts: { filter: AdminOrderFilter; query: string; sort: OrderSort; now: Date }): Order[] {
  return sortOrders(orders.filter((o) => matchesFilter(o, opts.filter, opts.now) && matchesQuery(o, opts.query)), opts.sort, opts.now);
}

export function filterCounts(orders: Order[], now: Date): Record<AdminOrderFilter, number> {
  const out = Object.fromEntries(ORDER_FILTERS.map((f) => [f.id, 0])) as Record<AdminOrderFilter, number>;
  for (const o of orders) for (const f of ORDER_FILTERS) if (matchesFilter(o, f.id, now)) out[f.id] += 1;
  return out;
}

export function paginate<T>(list: T[], page: number, size: number): { items: T[]; page: number; pages: number; total: number } {
  const pages = Math.max(1, Math.ceil(list.length / size));
  const p = Math.min(Math.max(1, page), pages);
  return { items: list.slice((p - 1) * size, p * size), page: p, pages, total: list.length };
}

// ---------- Bulk ----------

export type BulkAction = 'confirm' | 'ready';
export const BULK_TARGET: Record<BulkAction, { from: OrderStatus; to: OrderStatus; label: string }> = {
  confirm: { from: 'NEW', to: 'CONFIRMED', label: 'Confirm' },
  ready: { from: 'PREPARING', to: 'READY', label: 'Mark ready' },
};

/** Which selected orders the action applies to, and why the rest are skipped. Never guesses. */
export function bulkPlan(orders: Order[], ids: string[], action: BulkAction): { apply: string[]; skipped: { id: string; reason: string }[] } {
  const { from, to } = BULK_TARGET[action];
  const apply: string[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const id of ids) {
    const o = orders.find((x) => x.id === id);
    if (!o) skipped.push({ id, reason: 'no longer exists' });
    else if (o.status !== from || !canTransition(o.status, to)) skipped.push({ id, reason: `is ${STATUS_LABEL[o.status].toLowerCase()}` });
    else apply.push(id);
  }
  return { apply, skipped };
}

// ---------- Cancel impact ----------

export type CancelImpact = {
  allowed: boolean;
  restoresStock: boolean;
  ingredients: { id: string; name: string; amount: number; unit: string }[];
  payment: string;
  notifies: boolean;
};

/** What cancelling would do, shown before anyone confirms. */
export function cancelImpact(o: Order, inventory: Ingredient[]): CancelImpact {
  const allowed = ['NEW', 'CONFIRMED', 'PREPARING', 'READY'].includes(o.status);
  const restoresStock = o.status === 'NEW' || o.status === 'CONFIRMED';
  const needs = needsFor(o.items);
  return {
    allowed,
    restoresStock,
    ingredients: Object.entries(needs).map(([id, amount]) => { const i = inventory.find((x) => x.id === id); return { id, name: i?.name ?? id, amount, unit: i?.unit ?? '' }; }),
    payment: o.paymentStatus === 'PAID' ? `Paid ₹${o.total.toLocaleString('en-IN')} becomes refund pending (complete it from the order).` : o.paymentStatus === 'DUE' ? 'Nothing was collected (cash on delivery): the payment is voided.' : `Payment stays ${o.paymentStatus.toLowerCase().replace('_', ' ')}.`,
    notifies: true,
  };
}

// ---------- Timeline ----------

export type TimelineEntry = { at: string; kind: 'status' | 'payment' | 'invoice' | 'whatsapp' | 'audit' | 'note'; label: string; detail?: string; tone: 'ok' | 'warn' | 'error' | 'info' };

const AUTOMATION_LABEL: Partial<Record<AutomationEvent['type'], [TimelineEntry['kind'], string, TimelineEntry['tone']]>> = {
  'invoice.generated': ['invoice', 'Invoice generated', 'ok'],
  'invoice.failed': ['invoice', 'Invoice failed', 'error'],
  'invoice.retrying': ['invoice', 'Invoice retrying', 'warn'],
  'whatsapp.sent': ['whatsapp', 'WhatsApp sent', 'ok'],
  'whatsapp.failed': ['whatsapp', 'WhatsApp failed', 'error'],
  'whatsapp.retrying': ['whatsapp', 'WhatsApp retrying', 'warn'],
};

/** Everything that happened to an order, oldest first: status steps, payment, automations, staff changes. */
export function orderTimeline(o: Order, log: AutomationEvent[], audit: AuditRecord[]): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  o.history.forEach((h, i) => out.push({ at: h.at, kind: 'status', label: i === 0 ? 'Order created' : STATUS_LABEL[h.status], tone: h.status === 'CANCELLED' ? 'error' : 'info' }));
  out.push({
    at: o.createdAt, kind: 'payment',
    label: o.paymentMethod === 'COD' ? 'Cash on delivery' : `Paid by ${o.paymentMethod} (simulated)`,
    detail: o.paymentReference && o.paymentReference !== 'COD' ? `Ref ${o.paymentReference}` : undefined, tone: 'ok',
  });
  for (const e of log) {
    if (e.orderId !== o.id) continue;
    const m = AUTOMATION_LABEL[e.type];
    if (m) out.push({ at: e.timestamp, kind: m[0], label: m[1], detail: e.detail, tone: m[2] });
  }
  for (const r of audit) {
    if (r.entity.type !== 'order' && r.entity.type !== 'customCake' && r.entity.type !== 'invoice') continue;
    if (r.action === 'order.status.changed') continue; // already a status step
    out.push({ at: r.at, kind: r.action.includes('note') ? 'note' : 'audit', label: r.action.replace(/\./g, ' '), detail: `${r.actor.name}${r.reason ? ` · ${r.reason}` : ''}`, tone: 'info' });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

/** Minutes an order has spent in its current status. */
export function minutesInStatus(o: Order, now: Date): number {
  const since = [...o.history].reverse().find((h) => h.status === o.status)?.at ?? o.createdAt;
  return Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / 60000));
}

export function ordersCsvRows(orders: Order[], now: Date): (string | number)[][] {
  return [
    ['Order', 'Placed', 'Required by', 'Customer', 'Phone', 'Email', 'Status', 'Priority', 'Payment', 'Payment status', 'Items', 'Custom cake', 'Subtotal', 'Delivery', 'Total'],
    ...orders.map((o) => [
      o.id, o.createdAt, requiredBy(o).toISOString(), o.customer.name, o.customer.phone, o.customer.email, STATUS_LABEL[o.status], priorityOf(o, now),
      o.paymentMethod, o.paymentStatus, o.items.map((l) => `${l.qty} × ${l.product.name}`).join('; '), hasCustom(o) ? 'yes' : '', o.subtotal, o.delivery, o.total,
    ]),
  ];
}
