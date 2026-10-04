import { describe, expect, it } from 'vitest';
import { products } from '@/lib/data';
import { advanceOrder, createOrder, makeCustomLine, makeLine, STATUS_FLOW, type CheckoutDetails, type Order } from '@/lib/orders';
import { defaultConfig } from '@/lib/cake/engine';
import { canTransition, deliveryProgress, estimate, isTerminal, JOURNEY, statusCopy, TRANSITIONS, type TrackingStatus } from './status';
import { acceptEvent, makeStatusEvent } from './events';

const details: CheckoutDetails = { customer: { name: 'T', phone: '9845012345', email: '' }, address: '12 Test Road, Indiranagar', city: 'Bengaluru', pin: '560038', slot: '18:00–20:00', paymentMethod: 'UPI' };
const at = new Date('2026-10-04T13:00:00+05:30');
const latte = products.find((p) => p.id === 'tresor-latte')!;
const toast = products.find((p) => p.id === 'mushroom-toast')!;
const basic = createOrder(details, [makeLine(latte, 'Regular', 2), makeLine(toast, 'Regular', 1)], [], at);
const step = (o: Order, n: number, minutes = 10) => { let x = o; for (let i = 1; i <= n; i += 1) x = advanceOrder(x, new Date(at.getTime() + i * minutes * 60000)); return x; };

describe('state machine', () => {
  it('allows only the defined steps', () => {
    expect(canTransition('CONFIRMED', 'PREPARING')).toBe(true);
    expect(canTransition('PREPARING', 'READY')).toBe(true);
    expect(canTransition('OUT_FOR_DELIVERY', 'DELIVERED')).toBe(true);
    expect(canTransition('DELIVERED', 'PREPARING')).toBe(false);
    expect(canTransition('CONFIRMED', 'DELIVERED')).toBe(false);
    expect(canTransition('OUT_FOR_DELIVERY', 'CANCELLED')).toBe(false);
  });

  it('agrees with the order flow and ends in terminal states', () => {
    for (let i = 0; i < STATUS_FLOW.length - 1; i += 1) expect(canTransition(STATUS_FLOW[i], STATUS_FLOW[i + 1])).toBe(true);
    expect(JOURNEY).toEqual(STATUS_FLOW);
    for (const s of ['DELIVERED', 'CANCELLED', 'PAYMENT_FAILED'] as TrackingStatus[]) expect(isTerminal(s)).toBe(true);
    for (const s of Object.keys(TRANSITIONS) as TrackingStatus[]) for (const t of TRANSITIONS[s]) expect(TRANSITIONS[t]).toBeDefined();
  });
});

describe('events', () => {
  it('accepts valid steps and rejects invalid or repeated ones', () => {
    const e = (cur: TrackingStatus, prev: TrackingStatus | null, source: 'admin' | 'reconcile' | 'dev' = 'admin') => makeStatusEvent(basic, prev, cur, source);
    expect(acceptEvent('CONFIRMED', e('PREPARING', 'CONFIRMED'))).toBe(true);
    expect(acceptEvent('DELIVERED', e('PREPARING', 'DELIVERED'))).toBe(false);
    expect(acceptEvent('PREPARING', e('PREPARING', 'CONFIRMED'))).toBe(false);
    // After a gap the net change is trusted from the authoritative snapshot, even if it skips steps.
    expect(acceptEvent('CONFIRMED', e('OUT_FOR_DELIVERY', 'CONFIRMED', 'reconcile'))).toBe(true);
  });

  it('carry ETA fields and a unique id', () => {
    const a = makeStatusEvent(basic, 'CONFIRMED', 'PREPARING', 'admin', at);
    const b = makeStatusEvent(basic, 'CONFIRMED', 'PREPARING', 'admin', at);
    expect(a.eventId).not.toBe(b.eventId);
    expect(a).toMatchObject({ orderId: basic.id, previousStatus: 'CONFIRMED', currentStatus: 'PREPARING', source: 'admin' });
    expect(a.estimatedReadyAt).not.toBeNull();
  });
});

describe('customer copy', () => {
  it('uses warm words, not enums', () => {
    expect(statusCopy('PREPARING').headline).toBe('We’re baking it.');
    expect(statusCopy('PREPARING', { cake: true }).headline).toBe('Your cake is being made.');
    expect(statusCopy('OUT_FOR_DELIVERY').headline).toBe('It’s on the way.');
    expect(statusCopy('DELIVERED').headline).toBe('It’s here.');
    for (const s of Object.keys(TRANSITIONS) as TrackingStatus[]) expect(statusCopy(s).headline).not.toMatch(/_/);
  });
});

describe('estimates', () => {
  it('give an approximate ready time from the slowest item', () => {
    const preparing = step(basic, 1);
    const e = estimate(preparing, 'PREPARING', new Date(at.getTime() + 11 * 60000));
    expect(e.title).toBe('Ready around');
    expect(e.approximate).toBe(true);
    expect(e.detail).toMatch(/min to go|Any minute/);
  });

  it('show a delivery range, never a precise countdown', () => {
    const out = step(basic, 3);
    const e = estimate(out, 'OUT_FOR_DELIVERY', new Date(at.getTime() + 31 * 60000));
    expect(e.value).toMatch(/^around .+–.+$/);
    expect(e.approximate).toBe(true);
  });

  it('are production-aware for custom cakes', () => {
    const cake = createOrder({ ...details, slot: 'Tue, 6 Oct · 10:00–12:00' }, [makeCustomLine({ ...defaultConfig(), size: '8in', finish: 'ruffled' })], [], at);
    const e = estimate(cake, 'CONFIRMED', at);
    expect(e.title).toBe('Earliest ready');
    expect(e.detail).toBe('Your cake needs about 30 hours to bake and finish. Delivery slot: Tue, 6 Oct · 10:00–12:00.');
    expect(e.value).toMatch(/^Tomorrow · around/);
  });

  it('move the delivery marker with time, staying inside the line', () => {
    const out = step(basic, 3);
    const outAt = new Date(out.history.find((h) => h.status === 'OUT_FOR_DELIVERY')!.at);
    expect(deliveryProgress(out, outAt)).toBeCloseTo(0.04);
    expect(deliveryProgress(out, new Date(outAt.getTime() + 14 * 60000))).toBeGreaterThan(0.4);
    expect(deliveryProgress(out, new Date(outAt.getTime() + 300 * 60000))).toBe(0.92);
  });
});
