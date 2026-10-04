// Mock payment gateway. No money moves. Faults come from the test hook
// (localStorage 'tresor-mock-faults'.payment) so failure paths can be exercised.

import type { PaymentMethod } from '@/lib/orders';
import { readFaults } from './runner';

export type PaymentResult = { ok: true; reference: string } | { ok: false; reason: 'declined' | 'timeout' | 'cancelled'; message: string };

const ONCE_KEY = 'tresor-mock-payment-failed-once';

export async function mockPay(amount: number, method: PaymentMethod): Promise<PaymentResult> {
  if (method === 'COD') return { ok: true, reference: 'COD' };
  const fault = readFaults().payment ?? 'ok';
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  if (fault === 'timeout') { await wait(2500); return { ok: false, reason: 'timeout', message: 'The payment timed out. No money was taken. Please try again.' }; }
  await wait(fault === 'slow' ? 2200 : 900);
  if (fault === 'decline') return { ok: false, reason: 'declined', message: 'Your payment was declined. No money was taken. Try again or choose another method.' };
  if (fault === 'cancel') return { ok: false, reason: 'cancelled', message: 'Payment cancelled. Your bag is still here.' };
  if (fault === 'fail-once') {
    let failed = false;
    try { failed = localStorage.getItem(ONCE_KEY) === '1'; } catch { /* ignore */ }
    if (!failed) {
      try { localStorage.setItem(ONCE_KEY, '1'); } catch { /* ignore */ }
      return { ok: false, reason: 'declined', message: 'Your payment was declined. No money was taken. Try again or choose another method.' };
    }
  }
  return { ok: true, reference: `SIM-${Date.now().toString(36).toUpperCase()}-${amount}` };
}
