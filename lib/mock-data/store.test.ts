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

  it('never puts anything in the future when it is earlier in the day than the anchor', () => {
    const morning = new Date(anchor.getTime() + 30 * DAY - 6 * 3600_000); // 10 am, 30 days later
    const m = shiftDataset(ds, morning);
    const t = morning.getTime();
    const stamps: [string, string][] = [
      ...m.orders.flatMap((o) => [[o.id, o.createdAt], ...o.history.map((h) => [o.id, h.at])] as [string, string][]),
      ...m.payments.flatMap((p) => [[p.id, p.createdAt], ...(p.capturedAt ? [[p.id, p.capturedAt]] : [])] as [string, string][]),
      ...m.issues.flatMap((i) => [[i.id, i.createdAt], [i.id, i.updatedAt], ...i.messages.map((x) => [i.id, x.at]), ...i.internalNotes.map((x) => [i.id, x.at])] as [string, string][]),
      ...m.notifications.map((n) => [n.id, n.createdAt] as [string, string]),
      ...m.inventory.movements.map((x) => [x.id, x.at] as [string, string]),
      ...m.audit.map((r) => [r.id, r.at] as [string, string]),
      ...m.automations.jobs.map((j) => [j.id, j.createdAt] as [string, string]),
    ];
    const future = stamps.filter(([, at]) => new Date(at).getTime() > t + 1000);
    expect(future.slice(0, 3)).toEqual([]);
    // Threads keep their order.
    for (const i of m.issues) for (let k = 1; k < i.messages.length; k += 1) expect(i.messages[k].at >= i.messages[k - 1].at).toBe(true);
    // Today's live orders are still today, newest last placed most recently.
    const live = m.orders.filter((o) => o.liveOffsetMin !== undefined).sort((a, b) => b.liveOffsetMin! - a.liveOffsetMin!);
    for (let k = 1; k < live.length; k += 1) expect(live[k].createdAt > live[k - 1].createdAt).toBe(true);
    expect(validateDataset(m).problems.filter((p) => !p.startsWith('analytics')).slice(0, 3)).toEqual([]);
  });

  it('does not change the shipped data', () => {
    expect(ds.orders[0].createdAt).toBe(read('orders')[0].createdAt);
  });
});
