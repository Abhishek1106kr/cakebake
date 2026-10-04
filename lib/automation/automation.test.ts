import { describe, expect, it } from 'vitest';
import { products } from '@/lib/data';
import { createOrder, makeCustomLine, makeLine, type CheckoutDetails } from '@/lib/orders';
import { defaultConfig } from '@/lib/cake/engine';
import { afterAttempt, buildInvoice, invoiceIsConsistent, invoiceNumberFor, jobId, MAX_ATTEMPTS, maskPhone, newJob, whatsappMessage } from './automation';

const details: CheckoutDetails = { customer: { name: 'Test Customer', phone: '9845012345', email: '' }, address: '12 Test Road, Indiranagar', city: 'Bengaluru', pin: '560038', slot: 'Tue, 6 Oct · 10:00–12:00', paymentMethod: 'UPI' };
const latte = products.find((p) => p.id === 'tresor-latte')!;
const cake = { ...defaultConfig(), size: '8in', sponge: 'chocolate', message: { ...defaultConfig().message, text: 'Happy Birthday' } };
const order = createOrder(details, [makeLine(latte, 'Large', 2), makeCustomLine(cake)], [], new Date('2026-10-04T10:00:00Z'));

describe('invoice', () => {
  it('copies the order exactly, including the custom cake details', () => {
    const inv = buildInvoice(order);
    expect(inv.invoiceNumber).toBe(invoiceNumberFor(order.id));
    expect(inv.total).toBe(order.total);
    expect(inv.lines).toHaveLength(2);
    expect(inv.lines[0]).toMatchObject({ description: 'Tresor Latte (Large)', qty: 2, amount: order.items[0].unitPrice * 2 });
    expect(inv.lines[1].detail.join(' ')).toMatch(/Message: “Happy Birthday”/);
    expect(invoiceIsConsistent(inv, order)).toBe(true);
  });

  it('detects an invoice that does not match its order', () => {
    expect(invoiceIsConsistent({ ...buildInvoice(order), total: 1 }, order)).toBe(false);
  });
});

describe('whatsapp message', () => {
  it('confirms with number, items, custom cake summary, total, slot and tracking', () => {
    const text = whatsappMessage(order, 'confirmation');
    expect(text).toMatch(/Your order is confirmed ✓/);
    expect(text).toContain(`#${order.id}`);
    expect(text).toContain('2 × Tresor Latte (L)');
    expect(text).toContain('1 × Custom dark chocolate cake');
    expect(text).toContain(`₹${order.total.toLocaleString('en-IN')}`);
    expect(text).toContain('Tue, 6 Oct · 10:00–12:00');
    expect(text).toContain(`/track/${order.id}`);
  });

  it('announces status changes', () => {
    expect(whatsappMessage(order, 'status:PREPARING')).toContain('We’re preparing your Tresor order.');
    expect(whatsappMessage(order, 'status:OUT_FOR_DELIVERY')).toContain('STATUS: OUT FOR DELIVERY');
    expect(whatsappMessage(order, 'status:CANCELLED')).toContain('has been cancelled');
  });

  it('masks the phone for display', () => {
    expect(maskPhone('9845012345')).toBe('•••• 2345');
  });
});

describe('jobs', () => {
  it('have one idempotency key per kind, order and topic', () => {
    expect(newJob('whatsapp', 'TRS-1', 'confirmation').id).toBe(jobId('whatsapp', 'TRS-1', 'confirmation'));
    expect(jobId('whatsapp', 'TRS-1', 'confirmation')).not.toBe(jobId('whatsapp', 'TRS-1', 'status:READY'));
  });

  it('retry until the limit, then stop as failed', () => {
    let j = newJob('invoice', 'TRS-1', 'confirmation');
    for (let i = 1; i < MAX_ATTEMPTS; i += 1) { j = afterAttempt(j, { ok: false, error: 'down' }); expect(j.status).toBe('retrying'); }
    j = afterAttempt(j, { ok: false, error: 'down' });
    expect(j).toMatchObject({ status: 'failed', attempts: MAX_ATTEMPTS, lastError: 'down' });
  });

  it('succeed with a result and clear the error', () => {
    const j = afterAttempt(afterAttempt(newJob('invoice', 'TRS-1', 'confirmation'), { ok: false, error: 'down' }), { ok: true, result: { invoiceNumber: 'INV-1' } });
    expect(j).toMatchObject({ status: 'succeeded', attempts: 2, lastError: null, result: { invoiceNumber: 'INV-1' } });
  });
});
