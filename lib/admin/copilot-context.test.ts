import { describe, expect, it } from 'vitest';
import { buildCopilotContext, COPILOT_CONTEXT_LIMIT } from './copilot-context';
import { seedOrders } from '@/lib/orders';
import { initialInventory } from '@/lib/inventory';
import { checkLimits, resetLimits } from '@/app/api/ai/copilot/limits';

const now = new Date('2026-10-05T11:00:00+05:30');

describe('copilot context (what the language model may see)', () => {
  const orders = seedOrders(now).map((o, i) => ({ ...o, customer: { name: `Asha Rao ${i}`, phone: `98450${10000 + i}`, email: `asha${i}@example.com` } }));
  const ctx = buildCopilotContext({ orders, inventory: initialInventory, jobs: [], now });
  const json = JSON.stringify(ctx);

  it('never includes phone numbers or email addresses', () => {
    for (const o of orders) {
      expect(json).not.toContain(o.customer.phone);
      expect(json).not.toContain(o.customer.email);
    }
    expect(json).not.toMatch(/@example\.com/);
  });

  it('reduces customer names to first names', () => {
    expect(json).toContain('"customer":"Asha"');
    expect(json).not.toContain('Asha Rao');
  });

  it('carries the live figures the copilot is asked about', () => {
    expect(ctx.activeOrderCount).toBe(orders.filter((o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED').length);
    expect(ctx.today.orders).toBe(orders.filter((o) => o.status !== 'CANCELLED').length);
    expect(ctx.stock.every((s) => s.level !== 'HEALTHY')).toBe(true);
  });

  it('stays within the size the server accepts, even with many active orders', () => {
    const many = Array.from({ length: 400 }, (_, i) => ({ ...orders[i % orders.length], id: `TRS-${20000 + i}`, status: 'CONFIRMED' as const }));
    const big = buildCopilotContext({ orders: many, inventory: initialInventory, jobs: [], now });
    expect(JSON.stringify(big).length).toBeLessThanOrEqual(COPILOT_CONTEXT_LIMIT);
  });
});

describe('copilot route limits', () => {
  it('allows 10 questions per visitor per 10 minutes, then asks them to wait', () => {
    resetLimits();
    const t = Date.parse('2026-10-05T06:00:00Z');
    for (let i = 0; i < 10; i += 1) expect(checkLimits('visitor-a', t + i).ok).toBe(true);
    const blocked = checkLimits('visitor-a', t + 11);
    expect(blocked.ok).toBe(false);
    expect(!blocked.ok && blocked.retryAfter).toBeGreaterThan(0);
    expect(checkLimits('visitor-b', t + 12).ok).toBe(true);
    expect(checkLimits('visitor-a', t + 10 * 60_000 + 1).ok).toBe(true);
  });

  it('caps the whole day across visitors', () => {
    resetLimits();
    const t = Date.parse('2026-10-05T06:00:00Z');
    let allowed = 0;
    for (let i = 0; i < 400; i += 1) if (checkLimits(`v-${i}`, t + i).ok) allowed += 1;
    expect(allowed).toBe(300);
    expect(checkLimits('v-next-day', Date.parse('2026-10-06T00:00:01Z')).ok).toBe(true);
  });
});
