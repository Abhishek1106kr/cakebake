// Mock order automation: invoices and WhatsApp notifications. No real provider
// is ever contacted. Pure builders and state transitions live here; the browser
// runner (runner.ts) executes jobs with retries and records an event log.
//
// Guarantees:
// - Automation never changes an order. An invoice or WhatsApp failure leaves the
//   order exactly as it was.
// - One job per (kind, order, topic): repeating a trigger cannot send twice.

import type { Order, OrderStatus } from '@/lib/orders';
import { statusCopy } from '@/lib/tracking/status';

export type JobKind = 'invoice' | 'whatsapp';
export type JobStatus = 'requested' | 'retrying' | 'succeeded' | 'failed';
export type Job = {
  id: string; // idempotency key
  kind: JobKind;
  orderId: string;
  topic: string; // 'confirmation' | 'status:READY' | ...
  status: JobStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  claimedAt: number | null;
  result: { invoiceNumber?: string; to?: string; text?: string } | null;
};

export const MAX_ATTEMPTS = 3;
export const RETRY_DELAYS_MS = [800, 1600];

export type AutomationEventType =
  | 'order.created' | 'admin.order.created' | 'analytics.order.created' | 'order.status.changed'
  | 'invoice.requested' | 'invoice.generated' | 'invoice.failed' | 'invoice.retrying'
  | 'whatsapp.requested' | 'whatsapp.sent' | 'whatsapp.failed' | 'whatsapp.retrying' | 'automation.duplicate_suppressed';

export type AutomationEvent = {
  id: string;
  type: AutomationEventType;
  clientId: string | null;
  sessionId: string | null;
  orderId: string;
  timestamp: string;
  status: 'ok' | 'retry' | 'failed' | 'skipped';
  detail?: string;
};

/** Test hooks: deliberately failing providers, set in localStorage 'tresor-mock-faults'. */
export type Faults = {
  invoice?: 'ok' | 'fail-once' | 'fail-always';
  whatsapp?: 'ok' | 'timeout-once' | 'fail-always';
  payment?: 'ok' | 'decline' | 'timeout' | 'slow' | 'fail-once' | 'cancel';
};

export const jobId = (kind: JobKind, orderId: string, topic: string) => `${kind}:${orderId}:${topic}`;

export function newJob(kind: JobKind, orderId: string, topic: string, now = new Date()): Job {
  const iso = now.toISOString();
  return { id: jobId(kind, orderId, topic), kind, orderId, topic, status: 'requested', attempts: 0, lastError: null, createdAt: iso, updatedAt: iso, claimedAt: null, result: null };
}

/** Next state after an attempt. Failures retry until MAX_ATTEMPTS, then stay failed for a person to retry. */
export function afterAttempt(job: Job, outcome: { ok: true; result: Job['result'] } | { ok: false; error: string }, now = new Date()): Job {
  const attempts = job.attempts + 1;
  const base = { ...job, attempts, updatedAt: now.toISOString(), claimedAt: null };
  if (outcome.ok) return { ...base, status: 'succeeded', lastError: null, result: outcome.result };
  return { ...base, status: attempts >= MAX_ATTEMPTS ? 'failed' : 'retrying', lastError: outcome.error };
}

// ---------- Invoice ----------

export type InvoiceLine = { description: string; detail: string[]; qty: number; unitPrice: number; amount: number };
export type Invoice = { invoiceNumber: string; orderId: string; issuedAt: string; customer: string; lines: InvoiceLine[]; subtotal: number; delivery: number; total: number; paymentMethod: string; paymentStatus: string; note: string };

export const invoiceNumberFor = (orderId: string) => `INV-${orderId.replace(/\D/g, '')}`;

/** An invoice built only from the order: totals are copied, never recalculated differently. */
export function buildInvoice(order: Order, now = new Date()): Invoice {
  return {
    invoiceNumber: invoiceNumberFor(order.id),
    orderId: order.id,
    issuedAt: now.toISOString(),
    customer: order.customer.name,
    lines: order.items.map((l) => ({
      description: l.custom ? l.custom.title : `${l.product.name}${l.size === 'Large' ? ' (Large)' : ''}`,
      detail: l.custom ? [`Design ${l.custom.designId}`, ...l.custom.lines] : [],
      qty: l.qty,
      unitPrice: l.unitPrice,
      amount: l.unitPrice * l.qty,
    })),
    subtotal: order.subtotal,
    delivery: order.delivery,
    total: order.total,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    note: 'Simulated invoice for the Tresor prototype. No tax registration or payment is real.',
  };
}

export function invoiceIsConsistent(inv: Invoice, order: Order): boolean {
  const lines = inv.lines.reduce((s, l) => s + l.amount, 0);
  return inv.orderId === order.id && inv.total === order.total && lines === order.subtotal && inv.subtotal + inv.delivery === inv.total && inv.lines.length === order.items.length;
}

// ---------- WhatsApp (mock) ----------

export const maskPhone = (phone: string) => (phone.length >= 4 ? `•••• ${phone.slice(-4)}` : '••••');
export const trackLink = (orderId: string) => `/track/${orderId}`;

/** Statuses that trigger a customer message. */
export const NOTIFY_STATUSES: OrderStatus[] = ['PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

export function whatsappMessage(order: Order, topic: string): string {
  if (topic === 'confirmation') {
    const items = order.items.flatMap((l) => (l.custom
      ? [`${l.qty} × ${l.custom.title}`, ...l.custom.lines.slice(0, 3).map((x) => `  ${x}`)]
      : [`${l.qty} × ${l.product.name}${l.size === 'Large' ? ' (L)' : ''}`]));
    return [
      'TRESOR', '', 'Your order is confirmed ✓', '', `Order: #${order.id}`, '', ...items, '',
      `Total: ₹${order.total.toLocaleString('en-IN')}${order.paymentStatus === 'DUE' ? ' (pay at the door)' : ''}`,
      `Delivery: ${order.slot}`, '', `Track: ${trackLink(order.id)}`,
    ].join('\n');
  }
  // Same words as the tracking page: one status state, one source of copy.
  const status = topic.replace('status:', '') as OrderStatus;
  return ['TRESOR', '', `ORDER: #${order.id}`, `STATUS: ${statusCopy(status).label.toUpperCase()}`, '', statusCopy(status).whatsapp, '', `Track: ${trackLink(order.id)}`].join('\n');
}
