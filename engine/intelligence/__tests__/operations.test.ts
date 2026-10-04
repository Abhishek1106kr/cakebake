import { describe, expect, it } from 'vitest';
import { products } from '@/lib/data';
import { applyMovement, initialInventory } from '@/lib/inventory';
import { cancelOrder, createOrder, makeLine, seedOrders, type CheckoutDetails, type Order } from '@/lib/orders';
import '../index';
import { cartSuggestions, coPurchases, forYou, pairsWith, similarTo, unitsSold } from '../recommend/recommend';
import { categoryMix, funnel, productPerformance, salesByDay, searchAnalytics } from '../analytics/metrics';
import { backtest, dailyConsumption, ses, stockOutlook } from '../forecast/forecast';
import { generateInsights } from '../insights/insights';
import { createEvent, type EventType, type TresorEvent } from '../events/schema';

const p = (id: string) => products.find((x) => x.id === id)!;
const details: CheckoutDetails = { customer: { name: 'T', phone: '9845012345', email: '' }, address: '12 Test Road, Indiranagar', city: 'Bengaluru', pin: '560038', slot: 'ASAP', paymentMethod: 'UPI' };
const now = new Date('2026-10-04T12:00:00+05:30');

function order(items: [string, number][], at: Date, existing: Order[] = []): Order {
  return createOrder(details, items.map(([id, qty]) => makeLine(p(id), 'Regular', qty)), existing, at);
}

function ev(type: EventType, payload: Record<string, unknown>, sessionId: string): TresorEvent {
  return createEvent(type, payload, { sessionId, at: now });
}

describe('recommendations', () => {
  const orders = [
    order([['tresor-latte', 1], ['almond-croissant', 1]], now),
    order([['tresor-latte', 1], ['almond-croissant', 2]], now),
    order([['tresor-latte', 1], ['chocolate-brownie', 1]], now),
  ];

  it('counts co-purchases and units, ignoring cancelled orders', () => {
    const cancelled = cancelOrder(order([['tresor-latte', 5]], now), now);
    expect(coPurchases(orders).get('tresor-latte')?.get('almond-croissant')).toBe(2);
    expect(unitsSold([...orders, cancelled])['tresor-latte']).toBe(3);
  });

  it('pairs a coffee with what people actually order with it', () => {
    const r = pairsWith(['tresor-latte'], { products, orders });
    expect(r.result[0].product.id).toBe('almond-croissant');
    expect(r.result[0].reasons).toContain('often ordered together');
    expect(r.result.every((x) => x.product.id !== 'tresor-latte')).toBe(true);
    expect(r.result.every((x) => !x.product.cake)).toBe(true); // no whole cakes as an impulse add-on
  });

  it('falls back to popular items when nothing complements', () => {
    const r = pairsWith(['no-such-product'], { products, orders });
    expect(r.fallbackUsed).toBe(true);
    expect(r.result.length).toBeGreaterThan(0);
  });

  it('finds similar items by flavour and category', () => {
    const r = similarTo('chocolate-truffle', { products });
    expect(r.result.map((x) => x.product.id)).toContain('rose-chocolate-truffle');
    expect(r.result.map((x) => x.product.id)).not.toContain('chocolate-truffle');
    expect(similarTo('nope', { products }).warnings).toContain('unknown product');
  });

  it('never recommends what cannot be made', () => {
    const r = pairsWith(['tresor-latte'], { products, orders, availability: (x) => (x.id === 'almond-croissant' ? 0 : 10) });
    expect(r.result.map((x) => x.product.id)).not.toContain('almond-croissant');
  });

  it('nudges towards free delivery with something that closes the gap', () => {
    const r = cartSuggestions([{ productId: 'tresor-latte' }], 180, { products, orders });
    const nudge = r.result.find((x) => x.kind === 'free-delivery');
    expect(nudge).toBeDefined();
    expect(nudge!.product.price).toBeGreaterThanOrEqual(180);
    expect(nudge!.reason).toMatch(/free delivery/i);
  });

  it('suggests reorders and time-of-day picks', () => {
    const morning = forYou({ timeOfDay: 'morning', history: orders }, { products });
    expect(morning.result[0].kind).toBe('reorder');
    const evening = forYou({ timeOfDay: 'evening', history: [] }, { products });
    expect(evening.result.every((x) => x.kind === 'moment')).toBe(true);
  });
});

describe('analytics', () => {
  const orders = [order([['tresor-latte', 2]], now), order([['almond-croissant', 1]], new Date(now.getTime() - 86400000))];
  const events = [
    ev('product_view', { productId: 'tresor-latte' }, 's1'), ev('product_added', { productId: 'tresor-latte', qty: 1 }, 's1'),
    ev('checkout_started', { itemCount: 1, total: 280 }, 's1'), ev('order_created', { orderId: 'TRS-1', total: 280, items: [] }, 's1'),
    ev('product_view', { productId: 'tresor-latte' }, 's2'),
    ev('search_completed', { query: 'eggless', resultCount: 0, zeroResult: true }, 's2'),
    ev('search_completed', { query: 'Eggless', resultCount: 0, zeroResult: true }, 's3'),
    ev('search_completed', { query: 'chocolate', resultCount: 6 }, 's3'),
  ];

  it('sums sales by Bengaluru day', () => {
    const days = salesByDay(orders, now, 3);
    expect(days).toHaveLength(3);
    expect(days[2].orders).toBe(1);
    expect(days[1].orders).toBe(1);
  });

  it('builds a session funnel', () => {
    const f = funnel(events);
    expect(f.map((s) => s.sessions)).toEqual([2, 1, 1, 1]);
    expect(f[3].rate).toBe(0.5);
  });

  it('finds the searches that fail', () => {
    const s = searchAnalytics(events);
    expect(s.searches).toBe(3);
    expect(s.zeroResultQueries).toEqual([{ query: 'eggless', count: 2 }]);
    expect(s.zeroResultRate).toBeCloseTo(0.67, 2);
  });

  it('measures product views, adds and revenue', () => {
    const latte = productPerformance(orders, events).find((x) => x.productId === 'tresor-latte')!;
    expect(latte).toMatchObject({ units: 2, revenue: 420, views: 2, adds: 1, addRate: 0.5 });
  });

  it('computes category mix', () => {
    expect(categoryMix(orders)).toEqual([{ category: 'Coffee', units: 2, share: 0.67 }, { category: 'Pastry', units: 1, share: 0.33 }]);
  });
});

describe('forecasting', () => {
  it('smooths a series and never forecasts below zero', () => {
    expect(ses([10, 10, 10])[0]).toBe(10);
    expect(ses([], 0.4, 2)).toEqual([0, 0]);
    expect(ses([0, 0, 0])[0]).toBe(0);
  });

  it('backtests with MAE and MAPE', () => {
    const bt = backtest([10, 10, 10, 10]);
    expect(bt).toEqual({ mae: 0, mape: 0, points: 2 });
    expect(backtest([5]).mae).toBeNull();
  });

  it('turns orders into daily ingredient use', () => {
    const orders = [order([['tresor-latte', 10]], now)];
    const use = dailyConsumption(orders, now, 3);
    expect(use.milk[2]).toBeCloseTo(2);
    expect(use.milk[0]).toBe(0);
  });

  it('computes cover and restock, and is honest about thin history', () => {
    const orders = Array.from({ length: 5 }, (_, i) => order([['tresor-latte', 20]], new Date(now.getTime() - i * 86400000)));
    const r = stockOutlook(initialInventory, orders, now);
    const milk = r.result.find((x) => x.ingredientId === 'milk')!;
    expect(milk.forecastDaily).toBeCloseTo(4);              // 20 lattes × 0.2 L
    expect(milk.daysOfCover).toBeCloseTo(18 / 4, 1);
    expect(milk.historyDays).toBe(5);
    expect(milk.mae).toBe(0);
    const beans = r.result.find((x) => x.ingredientId === 'beans')!;
    expect(beans.suggestedRestock).toBeGreaterThan(0);       // 2.1 kg on hand, 0.36 kg/day, reorder at 4
    expect(r.confidence).toBeCloseTo(5 / 7, 2);
    expect(stockOutlook(initialInventory, [order([['tresor-latte', 1]], now)], now).warnings.join(' ')).toMatch(/1 day/);
  });
});

describe('insights', () => {
  const base = { orders: seedOrders(now), inventory: initialInventory, events: [] as TresorEvent[], products, now };

  it('flags low stock with what it blocks and evidence', () => {
    const r = generateInsights(base);
    const matcha = r.result.find((i) => i.id === 'stock:matcha')!;
    expect(matcha.severity).toBe('watch');
    expect(matcha.detail).toMatch(/Matcha Cloud/);
    expect(matcha.evidence.some((e) => e.label === 'On hand')).toBe(true);
    expect(matcha.next?.href).toBe('/admin/inventory');
  });

  it('escalates an ingredient that has run out', () => {
    const r = generateInsights({ ...base, inventory: applyMovement(initialInventory, 'matcha', -1) });
    expect(r.result[0]).toMatchObject({ id: 'stock:matcha', severity: 'act' });
  });

  it('spots orders stuck in the kitchen', () => {
    const late = { ...order([['mushroom-toast', 1]], new Date(now.getTime() - 60 * 60000)), id: 'TRS-9999' };
    const r = generateInsights({ ...base, orders: [late] });
    expect(r.result.find((i) => i.id === 'kitchen:TRS-9999')?.severity).toBe('act');
  });

  it('surfaces repeated failed searches', () => {
    const events = [1, 2, 3].map((i) => ev('search_completed', { query: 'eggless cake', resultCount: 0, zeroResult: true }, `s${i}`));
    const r = generateInsights({ ...base, events });
    expect(r.result.find((i) => i.kind === 'search')?.title).toMatch(/eggless cake/);
  });

  it('names today’s best seller', () => {
    const r = generateInsights(base);
    expect(r.result.find((i) => i.id.startsWith('product:best'))?.title).toMatch(/best seller/);
  });

  it('only checks for sales anomalies with enough history, and says so', () => {
    expect(generateInsights(base).warnings.join(' ')).toMatch(/fewer than 3 days/);
    const history = [1, 2, 3, 4, 5].map((d) => order([['tresor-latte', 5]], new Date(now.getTime() - d * 86400000)));
    // Five steady days, nothing yet today → quiet, compared at the same time of day.
    const quiet = generateInsights({ ...base, orders: history });
    expect(quiet.result.find((i) => i.kind === 'sales')).toMatchObject({ severity: 'watch', title: 'Today is unusually quiet' });
    // A normal day → no anomaly.
    const normal = generateInsights({ ...base, orders: [...history, order([['tresor-latte', 5]], new Date(now.getTime() - 60000))] });
    expect(normal.result.some((i) => i.kind === 'sales')).toBe(false);
  });

  it('orders insights by severity', () => {
    const r = generateInsights({ ...base, inventory: applyMovement(initialInventory, 'matcha', -1) });
    const ranks = r.result.map((i) => ({ act: 0, watch: 1, info: 2 })[i.severity]);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });
});
