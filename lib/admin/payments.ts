// Payments view: the shipped payment records plus what this browser changed. An order placed or
// changed here (refund completed, COD collected on delivery, cancelled) updates its payment; an
// order placed here gets a payment derived from it. Simulated: no real gateway is involved.

import type { Order } from '@/lib/orders';
import type { PaymentRecordStatus, SeedPayment, SeedRefund } from '@/lib/mock-data/types';

export const PAYMENT_STATUS_LABEL: Record<PaymentRecordStatus, string> = {
  CREATED: 'Due', AUTHORIZED: 'Authorised', CAPTURED: 'Captured', FAILED: 'Failed', CANCELLED: 'Cancelled',
  REFUND_PENDING: 'Refund pending', PARTIALLY_REFUNDED: 'Partly refunded', REFUNDED: 'Refunded',
};
export const PAYMENT_STATUSES = Object.keys(PAYMENT_STATUS_LABEL) as PaymentRecordStatus[];

/** What an order's payment status means for its successful (non-failed) payment record. */
function statusFor(order: Order, refunded: number): PaymentRecordStatus {
  switch (order.paymentStatus) {
    case 'DUE': return 'CREATED';
    case 'VOID': return 'CANCELLED';
    case 'REFUND_PENDING': return 'REFUND_PENDING';
    case 'REFUNDED': return 'REFUNDED';
    case 'FAILED': return 'FAILED';
    default: return refunded > 0 && refunded < order.total ? 'PARTIALLY_REFUNDED' : 'CAPTURED';
  }
}

/** A payment record for an order placed in this browser. */
export function paymentFromOrder(order: Order & { customerId?: string }): SeedPayment {
  const delivered = order.history.find((h) => h.status === 'DELIVERED')?.at ?? null;
  const status = statusFor(order, 0);
  const refunds: SeedRefund[] = status === 'REFUNDED' || status === 'REFUND_PENDING'
    ? [{ id: `RFD-${order.id}`, paymentId: `PAY-${order.id}`, orderId: order.id, amount: order.total, reason: 'Order cancelled', status: status === 'REFUNDED' ? 'PROCESSED' : 'PENDING', issueId: null, by: 'staff-owner', createdAt: order.history[order.history.length - 1].at, processedAt: status === 'REFUNDED' ? order.history[order.history.length - 1].at : null }]
    : [];
  return {
    id: `PAY-${order.id}`, orderId: order.id, customerId: order.customerId ?? '', provider: order.paymentMethod === 'COD' ? 'cod' : 'simulated', method: order.paymentMethod,
    status, amount: order.total, attempt: 1, reference: order.paymentReference ?? null, failureReason: null, createdAt: order.createdAt,
    capturedAt: order.paymentMethod === 'COD' ? (order.paymentStatus === 'PAID' ? delivered : null) : order.createdAt,
    refundedAmount: status === 'REFUNDED' ? order.total : 0, refunds,
  };
}

/**
 * All payments, newest first. `orders` is the merged order list; `seedOrders` tells which orders
 * are unchanged shipped records (their payments are used as shipped).
 */
export function paymentsView(orders: Order[], seedPayments: SeedPayment[], isShipped: (o: Order) => boolean): SeedPayment[] {
  const byOrder = new Map<string, SeedPayment[]>();
  for (const p of seedPayments) (byOrder.get(p.orderId) ?? byOrder.set(p.orderId, []).get(p.orderId)!).push(p);
  const out: SeedPayment[] = [];
  for (const o of orders) {
    const shipped = byOrder.get(o.id);
    if (!shipped) { out.push(paymentFromOrder(o)); continue; }
    if (isShipped(o)) { out.push(...shipped); continue; }
    // A shipped order changed here: keep its attempts, update the payment that went through.
    for (const p of shipped) {
      if (p.status === 'FAILED') { out.push(p); continue; }
      const status = statusFor(o, p.refundedAmount);
      const refunds = [...p.refunds];
      if (status === 'REFUNDED' && p.refundedAmount < p.amount) {
        const at = o.history[o.history.length - 1].at;
        const pending = refunds.findIndex((r) => r.status === 'PENDING');
        if (pending >= 0) refunds[pending] = { ...refunds[pending], status: 'PROCESSED', processedAt: at };
        else refunds.push({ id: `RFD-${o.id}`, paymentId: p.id, orderId: o.id, amount: p.amount - p.refundedAmount, reason: 'Order cancelled', status: 'PROCESSED', issueId: null, by: 'staff-owner', createdAt: at, processedAt: at });
      }
      if (status === 'REFUND_PENDING' && !refunds.some((r) => r.status === 'PENDING')) {
        const at = o.history[o.history.length - 1].at;
        refunds.push({ id: `RFD-${o.id}`, paymentId: p.id, orderId: o.id, amount: p.amount - p.refundedAmount, reason: 'Order cancelled', status: 'PENDING', issueId: null, by: 'staff-owner', createdAt: at, processedAt: null });
      }
      const refundedAmount = refunds.filter((r) => r.status === 'PROCESSED').reduce((s, r) => s + r.amount, 0);
      const delivered = o.history.find((h) => h.status === 'DELIVERED')?.at ?? null;
      out.push({ ...p, status, refunds, refundedAmount, capturedAt: p.method === 'COD' ? (o.paymentStatus === 'PAID' ? delivered : null) : p.capturedAt });
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.attempt - a.attempt);
}

export type PaymentFilter = { status: PaymentRecordStatus | 'ALL'; method: 'ALL' | 'UPI' | 'Card' | 'COD'; provider: 'ALL' | 'simulated' | 'cod'; query: string };

export function filterPayments(rows: SeedPayment[], f: PaymentFilter, names: (customerId: string, orderId: string) => string): SeedPayment[] {
  const q = f.query.trim().toLowerCase();
  return rows.filter((p) => (f.status === 'ALL' || p.status === f.status) && (f.method === 'ALL' || p.method === f.method) && (f.provider === 'ALL' || p.provider === f.provider)
    && (!q || p.id.toLowerCase().includes(q) || p.orderId.toLowerCase().includes(q) || p.customerId.toLowerCase().includes(q) || (p.reference ?? '').toLowerCase().includes(q) || names(p.customerId, p.orderId).toLowerCase().includes(q)));
}

/** Headline figures over a period (successful payments only for value). */
export function paymentStatsFor(rows: SeedPayment[], from: Date, to: Date) {
  const inRange = rows.filter((p) => { const t = new Date(p.createdAt); return t >= from && t <= to; });
  const ok = inRange.filter((p) => p.status !== 'FAILED' && p.status !== 'CANCELLED' && p.status !== 'CREATED');
  const online = inRange.filter((p) => p.method !== 'COD');
  const failed = online.filter((p) => p.status === 'FAILED');
  const refunds = rows.flatMap((p) => p.refunds).filter((r) => { const t = new Date(r.createdAt); return t >= from && t <= to; });
  return {
    captured: ok.reduce((s, p) => s + p.amount, 0),
    refunded: refunds.filter((r) => r.status === 'PROCESSED').reduce((s, r) => s + r.amount, 0),
    refundsPending: rows.flatMap((p) => p.refunds).filter((r) => r.status === 'PENDING').length,
    failedAttempts: failed.length,
    failureRate: online.length ? failed.length / online.length : 0,
    codDue: rows.filter((p) => p.method === 'COD' && p.status === 'CREATED').reduce((s, p) => s + p.amount, 0),
  };
}
