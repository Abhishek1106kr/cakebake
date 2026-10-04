import { describe, expect, it } from 'vitest';
import { products } from '@/lib/data';
import { initialInventory } from '@/lib/inventory';
import { createOrder, makeCustomLine, makeLine, type CheckoutDetails, type Order } from '@/lib/orders';
import { defaultConfig } from '@/lib/cake/engine';
import '../index';
import { askCopilot } from '../copilot/copilot';
import { generateOperationalInsights } from '../insights/operations';
import { proposeActions } from '../decisions/decisions';

const now = new Date('2026-10-04T15:00:00+05:30');
const details: CheckoutDetails = { customer: { name: 'T', phone: '9845012345', email: '' }, address: '12 Test Road, Indiranagar', city: 'Bengaluru', pin: '560038', slot: '18:00–20:00', paymentMethod: 'UPI' };
const p = (id: string) => products.find((x) => x.id === id)!;
const at = (iso: string, over: Partial<Order> = {}, lines = [makeLine(p('tresor-latte'), 'Regular', 1)]) => ({ ...createOrder(details, lines, [], new Date(iso)), ...over });
const ask = (q: string, orders: Order[], jobs = []) => askCopilot(q, { orders, inventory: initialInventory, events: [], products, now, jobs }).result;

describe('copilot: operational questions answered from the records', () => {
  it('lists failed automations', () => {
    const jobs = [{ id: 'whatsapp:TRS-9:confirmation', kind: 'whatsapp' as const, orderId: 'TRS-9', topic: 'confirmation', status: 'failed', attempts: 3, lastError: 'timeout' }];
    const a = ask('Show failed automations.', [], jobs as never);
    expect(a.topic).toBe('automations');
    expect(a.answer).toContain('TRS-9');
    expect(a.facts.find((f) => f.label === 'Failed')?.value).toBe('1');
  });

  it('counts custom cakes due tomorrow', () => {
    const cake = at('2026-10-04T09:00:00+05:30', { id: 'TRS-50', slot: 'Mon, 5 Oct · 14:00–16:00' }, [makeCustomLine(defaultConfig())]);
    const notTomorrow = at('2026-10-04T09:00:00+05:30', { id: 'TRS-51', slot: 'Tue, 6 Oct · 14:00–16:00' }, [makeCustomLine({ ...defaultConfig(), size: '8in' })]);
    const a = ask('How many custom cake orders are due tomorrow?', [cake, notTomorrow]);
    expect(a.topic).toBe('custom_cakes');
    expect(a.answer).toMatch(/^1 custom cake order due tomorrow: TRS-50/);
  });

  it('finds orders at risk of missing their slot', () => {
    const late = at('2026-10-04T09:00:00+05:30', { id: 'TRS-60', slot: '10:00–12:00' });
    const fine = at('2026-10-04T14:00:00+05:30', { id: 'TRS-61', slot: '18:00–20:00' });
    const a = ask('What orders are at risk of missing their slot?', [late, fine]);
    expect(a.topic).toBe('at_risk');
    expect(a.answer).toContain('TRS-60');
    expect(a.answer).not.toContain('TRS-61');
  });

  it('compares revenue with yesterday at the same time, with the reason', () => {
    const today = at('2026-10-04T10:00:00+05:30');
    const yesterday = [at('2026-10-03T09:00:00+05:30'), at('2026-10-03T11:00:00+05:30'), at('2026-10-03T19:00:00+05:30')];
    const a = ask('Why is revenue lower than yesterday?', [today, ...yesterday]);
    expect(a.topic).toBe('revenue_compare');
    expect(a.answer).toContain('fewer orders (1 vs 2)');
    expect(a.facts[2].value).toContain('3 orders');
  });

  it('says when there is no evidence to choose a cake to feature', () => {
    const a = ask('Which cake should we feature?', []);
    expect(a.topic).toBe('feature');
    expect(a.answer).toMatch(/isn’t enough sales or view history/);
  });

  it('summarises cakes sold today', () => {
    const o = at('2026-10-04T10:00:00+05:30', {}, [makeLine(p('chocolate-truffle'), 'Regular', 2), makeCustomLine(defaultConfig())]);
    const a = ask('How are cakes doing today?', [o]);
    expect(a.topic).toBe('cakes');
    expect(a.answer).toMatch(/^2 cakes from the menu and 1 custom cake today/);
  });
});

describe('operational insights', () => {
  it('flags custom cakes that must start within 4 hours and proposes a recommendation, not an action', () => {
    const cake = at('2026-10-03T12:00:00+05:30', { id: 'TRS-70', slot: 'Mon, 5 Oct · 10:00–12:00' }, [makeCustomLine(defaultConfig())]);
    const r = generateOperationalInsights({ orders: [cake], jobs: [], events: [], products, now: new Date('2026-10-04T08:00:00+05:30') });
    const insight = r.result.find((i) => i.kind === 'custom')!;
    expect(insight.title).toMatch(/1 custom cake needs preparation within 4 hours/);
    const [action] = proposeActions([insight], []);
    expect(action.level).toBe('RECOMMEND');
    expect(action.plan.type).toBe('none');
  });

  it('turns a failed job into an act-now insight that links to the retry', () => {
    const r = generateOperationalInsights({ orders: [], jobs: [{ id: 'whatsapp:TRS-1042:confirmation', kind: 'whatsapp', orderId: 'TRS-1042', topic: 'confirmation', status: 'failed', attempts: 3, lastError: 'Provider error', updatedAt: now.toISOString() }], events: [], products, now });
    expect(r.result[0]).toMatchObject({ severity: 'act', title: 'WhatsApp confirmation failed for #TRS-1042' });
    expect(r.result[0].next?.href).toContain('/admin/automations');
  });

  it('only calls demand trends with two weeks of history, and drafts (never publishes) a feature', () => {
    const r = generateOperationalInsights({ orders: [at('2026-10-04T10:00:00+05:30')], jobs: [], events: [], products, now });
    expect(r.result.some((i) => i.kind === 'demand')).toBe(false);
    expect(r.warnings.join(' ')).toMatch(/two weeks/);
    const old = ['2026-09-20', '2026-09-21', '2026-09-22'].map((d) => at(`${d}T10:00:00+05:30`));
    const recent = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'].map((d) => at(`${d}T10:00:00+05:30`, {}, [makeLine(p('pistachio-tart'), 'Regular', 1)]));
    const r2 = generateOperationalInsights({ orders: [...old, ...recent], jobs: [], events: [], products, now });
    const demand = r2.result.find((i) => i.kind === 'demand')!;
    expect(demand.title).toMatch(/Pistachio Tart demand is up to 6 this week/);
    expect(proposeActions([demand], [])[0].level).toBe('DRAFT');
  });
});
