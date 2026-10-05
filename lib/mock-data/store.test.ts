import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { requiredBy } from '@/lib/admin/order-ops';
import { dayShift, shiftDataset } from './store';
import { validateDataset } from './validate';
import type { MockDataset } from './types';

const dir = path.join(process.cwd(), 'public', 'mock-data');
const read = (name: string) => JSON.parse(readFileSync(path.join(dir, `${name}.json`), 'utf8'));
const ds: MockDataset = {
  manifest: read('manifest'), customers: read('customers'), orders: read('orders'), products: read('products'), customCakes: read('custom-cakes'),
  payments: read('payments'), invoices: read('invoices'), issues: read('issues'), notifications: read('notifications'), automations: read('automations'),
  inventory: read('inventory'), analytics: read('analytics'), staff: read('staff'), campaigns: read('campaigns'), audit: read('audit'),
};
const DAY = 86_400_000;
const anchor = new Date(ds.manifest.anchor);

describe('moving the dataset to today', () => {
  const now = new Date(anchor.getTime() + 30 * DAY); // same time of day, 30 days later
  const shifted = shiftDataset(ds, now);
  const orig = new Map(ds.orders.map((o) => [o.id, o]));

  it('counts whole days in India', () => {
    expect(dayShift(ds.manifest.anchor, now)).toBe(30 * DAY);
    expect(dayShift(ds.manifest.anchor, new Date(anchor.getTime() + 7 * 3600_000))).toBe(0); // 4 pm + 7 h: still the same day
    expect(dayShift(ds.manifest.anchor, new Date(anchor.getTime() + 9 * 3600_000))).toBe(DAY); // 1 am the next day
    expect(dayShift(ds.manifest.anchor, anchor)).toBe(0);
  });

  it('shifts history by whole days and keeps the time of day', () => {
    const o = shifted.orders[100];
    expect(new Date(o.createdAt).getTime() - new Date(orig.get(o.id)!.createdAt).getTime()).toBe(30 * DAY);
    expect(o.history.every((h, i) => new Date(h.at).getTime() - new Date(orig.get(o.id)!.history[i].at).getTime() === 30 * DAY)).toBe(true);
  });

  it('places today’s live orders relative to now', () => {
    for (const o of shifted.orders.filter((x) => x.liveOffsetMin !== undefined)) {
      expect(now.getTime() - new Date(o.createdAt).getTime()).toBe(o.liveOffsetMin! * 60_000);
    }
  });

  it('rewrites dated custom cake slots to the shifted day', () => {
    const dated = shifted.orders.filter((o) => /\d{1,2}\s+[A-Za-z]{3}\s*·/.test(o.slot));
    expect(dated.length).toBeGreaterThan(50);
    for (const o of dated.slice(0, 40)) {
      const before = requiredBy(orig.get(o.id)!).getTime();
      const after = requiredBy(o).getTime();
      expect(after - before).toBe(30 * DAY);
    }
  });

  it('keeps every relationship and total valid after the shift', () => {
    expect(validateDataset(shifted).problems).toEqual([]);
  });

  it('does not change the shipped data', () => {
    expect(ds.orders[0].createdAt).toBe(read('orders')[0].createdAt);
  });
});
