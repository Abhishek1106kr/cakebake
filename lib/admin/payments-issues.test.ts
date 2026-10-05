import { describe, expect, it } from 'vitest';
import { cancelOrder, createOrder, makeLine, markRefunded, type CheckoutDetails } from '@/lib/orders';
import { products } from '@/lib/data';
import type { SeedIssue, SeedPayment } from '@/lib/mock-data/types';
import { filterPayments, paymentFromOrder, paymentStatsFor, paymentsView } from './payments';
import { addCustomerMessage, addInternalNote, assignIssue, canMoveIssue, mergeIssues, moveIssue, newIssue, nextIssueId, queryIssues } from './issues';

const at = new Date('2026-10-05T10:00:00+05:30');
const details = (m: CheckoutDetails['paymentMethod']): CheckoutDetails => ({ customer: { name: 'Asha Rao', phone: '5550000001', email: '' }, address: '1 Test Road, Indiranagar', city: 'Bengaluru', pin: '560038', slot: 'As soon as possible', paymentMethod: m, paymentReference: m === 'COD' ? undefined : 'SIM-T1' });
const croissant = products.find((p) => p.id === 'almond-croissant')!;

describe('payments view', () => {
  const upi = createOrder(details('UPI'), [makeLine(croissant, 'Regular', 2)], [], at);
  const shippedPay: SeedPayment = { ...paymentFromOrder(upi), id: 'PAY-000001', customerId: 'CUS-00001' };
  const failed: SeedPayment = { ...shippedPay, id: 'PAY-000000', status: 'FAILED', attempt: 1, reference: null, failureReason: 'Declined by the bank', capturedAt: null };

  it('uses shipped payments as they are for unchanged orders, failed attempts included', () => {
    const rows = paymentsView([upi], [failed, { ...shippedPay, attempt: 2 }], () => true);
    expect(rows.map((p) => p.status)).toEqual(['CAPTURED', 'FAILED']);
  });

  it('follows an order cancelled here: refund pending, then refunded', () => {
    const cancelled = cancelOrder(upi, new Date(at.getTime() + 60_000));
    const pending = paymentsView([cancelled], [shippedPay], () => false)[0];
    expect(pending.status).toBe('REFUND_PENDING');
    expect(pending.refunds.filter((r) => r.status === 'PENDING')).toHaveLength(1);
    const done = paymentsView([markRefunded(cancelled)], [shippedPay], () => false)[0];
    expect(done.status).toBe('REFUNDED');
    expect(done.refundedAmount).toBe(upi.total);
  });

  it('derives a payment for an order placed in this browser', () => {
    const cod = createOrder(details('COD'), [makeLine(croissant, 'Regular', 1)], [], at);
    const [p] = paymentsView([cod], [], () => false);
    expect(p).toMatchObject({ orderId: cod.id, provider: 'cod', method: 'COD', status: 'CREATED', amount: cod.total });
  });

  it('filters and summarises', () => {
    const rows = paymentsView([upi], [failed, { ...shippedPay, attempt: 2 }], () => true);
    expect(filterPayments(rows, { status: 'FAILED', method: 'ALL', provider: 'ALL', query: '' }, () => '')).toHaveLength(1);
    expect(filterPayments(rows, { status: 'ALL', method: 'ALL', provider: 'ALL', query: 'asha' }, () => 'Asha Rao')).toHaveLength(2);
    const s = paymentStatsFor(rows, new Date(at.getTime() - 86_400_000), new Date(at.getTime() + 86_400_000));
    expect(s).toMatchObject({ captured: upi.total, failedAttempts: 1 });
    expect(s.failureRate).toBeCloseTo(0.5);
  });
});

describe('issues', () => {
  const base = (over: Partial<SeedIssue> = {}): SeedIssue => ({ id: 'ISS-0001', orderId: 'TRS-09000', customerId: 'CUS-00001', category: 'MISSING_ITEM', priority: 'NORMAL', status: 'OPEN', description: 'Missing cookie', assignedTo: null, internalNotes: [], messages: [], refundId: null, createdAt: at.toISOString(), updatedAt: at.toISOString(), resolvedAt: null, resolution: null, ...over });

  it('only allows the listed status moves', () => {
    expect(canMoveIssue('OPEN', 'INVESTIGATING')).toBe(true);
    expect(canMoveIssue('CLOSED', 'OPEN')).toBe(false);
    expect(moveIssue(base(), 'CLOSED', at).ok).toBe(false);
  });

  it('needs a resolution to resolve, and keeps it when closing', () => {
    expect(moveIssue(base(), 'RESOLVED', at).ok).toBe(false);
    const r = moveIssue(base(), 'RESOLVED', at, 'Refunded the cookie');
    expect(r.ok && r.issue.resolvedAt && r.issue.resolution).toBe('Refunded the cookie');
    const c = r.ok ? moveIssue(r.issue, 'CLOSED', at) : null;
    expect(c?.ok && c.issue.resolution).toBe('Refunded the cookie');
    const reopened = r.ok ? moveIssue(r.issue, 'INVESTIGATING', at) : null;
    expect(reopened?.ok && reopened.issue.resolvedAt).toBe(null);
  });

  it('acknowledges an open issue when someone picks it up', () => {
    expect(assignIssue(base(), 'staff-support', at)).toMatchObject({ assignedTo: 'staff-support', status: 'ACKNOWLEDGED' });
  });

  it('keeps internal notes and customer messages apart', () => {
    const n = addInternalNote(base(), 'staff-support', 'Packing missed it', at);
    const m = n.ok ? addCustomerMessage(n.issue, 'staff-support', 'Refunding now', at) : null;
    expect(m?.ok && m.issue.internalNotes.map((x) => x.body)).toEqual(['Packing missed it']);
    expect(m?.ok && m.issue.messages.map((x) => [x.direction, x.body])).toEqual([['outbound', 'Refunding now']]);
    expect(addInternalNote(base(), 'x', ' ', at).ok).toBe(false);
  });

  it('numbers new issues after existing ones and merges overlays', () => {
    expect(nextIssueId([{ id: 'ISS-0076' }, { id: 'ISS-0003' }])).toBe('ISS-0077');
    const r = newIssue({ orderId: 'TRS-09142', customerId: 'CUS-00002', category: 'QUALITY', priority: 'HIGH', description: 'Cream split', existing: [base()], at });
    expect(r.ok && r.issue.id).toBe('ISS-0002');
    const changed = { ...base(), status: 'INVESTIGATING' as const };
    const merged = mergeIssues([base()], { [changed.id]: changed, ...(r.ok ? { [r.issue.id]: r.issue } : {}) });
    expect(merged.map((i) => [i.id, i.status])).toEqual([['ISS-0001', 'INVESTIGATING'], ['ISS-0002', 'OPEN']]);
  });

  it('puts open urgent issues first', () => {
    const list = [base({ id: 'A', status: 'CLOSED', resolvedAt: at.toISOString() }), base({ id: 'B', priority: 'LOW' }), base({ id: 'C', priority: 'URGENT' })];
    expect(queryIssues(list, { view: 'all', category: 'ALL', priority: 'ALL', assignee: 'ALL', query: '' }, () => '').map((i) => i.id)).toEqual(['C', 'B', 'A']);
    expect(queryIssues(list, { view: 'open', category: 'ALL', priority: 'ALL', assignee: 'ALL', query: '' }, () => '').map((i) => i.id)).toEqual(['C', 'B']);
  });
});
