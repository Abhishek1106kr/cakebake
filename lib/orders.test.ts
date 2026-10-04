import { describe, expect, it } from 'vitest';
import { products, type Product } from './data';
import {
  DELIVERY_FEE, FREE_DELIVERY_FROM, LARGE_SURCHARGE, MAX_QTY_PER_LINE,
  advanceOrder, calcTotals, canCancel, cancelOrder, cancelRestoresStock, createOrder, filterOrders,
  makeLine, nextOrderId, nextStatus, normalizeCart, normalizeOrder, normalizePhone, orderStats,
  ordersToCsv, prepTarget, seedOrders, sizesFor, unitPrice, unitsSoldToday, validateCheckout,
  leadHours, makeCustomLine, markRefunded,
  type CheckoutDetails, type Order,
} from './orders';
import { needsFor } from './inventory';
import { defaultConfig as defaultCake, price as cakePrice } from './cake/engine';

const byId = (id: string): Product => {
  const p = products.find((x) => x.id === id);
  if (!p) throw new Error(`missing product ${id}`);
  return p;
};

const latte = byId('tresor-latte');       // ₹210, Coffee
const croissant = byId('almond-croissant'); // ₹190, Pastry
const roseCake = byId('rose-chocolate-truffle'); // ₹2450, Cake

const details: CheckoutDetails = {
  customer: { name: 'Test Customer', phone: '9845012345', email: '' },
  address: '12 Test Road, Indiranagar',
  city: 'Bengaluru',
  pin: '560038',
  slot: 'As soon as possible',
  paymentMethod: 'UPI',
};

const at = new Date('2026-10-04T10:00:00+05:30');

describe('pricing', () => {
  it('offers two sizes only for drinks', () => {
    expect(sizesFor(latte)).toEqual(['Regular', 'Large']);
    expect(sizesFor(croissant)).toEqual(['Regular']);
    expect(sizesFor(roseCake)).toEqual(['Regular']);
  });

  it('adds the large surcharge', () => {
    expect(unitPrice(latte, 'Regular')).toBe(210);
    expect(unitPrice(latte, 'Large')).toBe(210 + LARGE_SURCHARGE);
  });

  it('charges delivery below the free threshold', () => {
    const t = calcTotals([makeLine(latte, 'Regular', 2)]);
    expect(t).toMatchObject({ subtotal: 420, delivery: DELIVERY_FEE, total: 420 + DELIVERY_FEE, itemCount: 2, toFreeDelivery: FREE_DELIVERY_FROM - 420 });
  });

  it('delivers free from the threshold exactly', () => {
    const product = { ...latte, price: FREE_DELIVERY_FROM };
    const t = calcTotals([makeLine(product, 'Regular', 1)]);
    expect(t.delivery).toBe(0);
    expect(t.toFreeDelivery).toBe(0);
  });

  it('charges nothing for an empty bag', () => {
    expect(calcTotals([])).toEqual({ subtotal: 0, delivery: 0, total: 0, itemCount: 0, toFreeDelivery: 0 });
  });
});

describe('normalizeCart', () => {
  it('re-prices from the live menu and drops unknown products', () => {
    const cart = normalizeCart([
      { product: { id: 'tresor-latte', price: 1 }, size: 'Large', qty: 2 },
      { product: { id: 'no-such-thing' }, qty: 1 },
    ]);
    expect(cart).toHaveLength(1);
    expect(cart[0].unitPrice).toBe(210 + LARGE_SURCHARGE);
  });

  it('caps quantity, rejects zero, and ignores sizes a product does not have', () => {
    const cart = normalizeCart([
      { product: { id: 'almond-croissant' }, size: 'Large', qty: 99 },
      { product: { id: 'tresor-latte' }, qty: 0 },
    ]);
    expect(cart).toHaveLength(1);
    expect(cart[0]).toMatchObject({ size: 'Regular', qty: MAX_QTY_PER_LINE });
  });

  it('returns an empty bag for garbage', () => {
    expect(normalizeCart('nope')).toEqual([]);
    expect(normalizeCart(null)).toEqual([]);
  });
});

describe('order lifecycle', () => {
  const lines = [makeLine(latte, 'Regular', 1), makeLine(croissant, 'Regular', 2)];

  it('creates a confirmed order with totals and history', () => {
    const order = createOrder(details, lines, [], at);
    expect(order.id).toBe('TRS-1042');
    expect(order.status).toBe('CONFIRMED');
    expect(order.history.map((h) => h.status)).toEqual(['NEW', 'CONFIRMED']);
    expect(order.subtotal).toBe(210 + 380);
    expect(order.total).toBe(order.subtotal + DELIVERY_FEE);
    expect(order.paymentStatus).toBe('PAID');
    expect(order.source).toBe('online');
  });

  it('marks cash on delivery as due until delivered', () => {
    let order = createOrder({ ...details, paymentMethod: 'COD' }, lines, [], at);
    expect(order.paymentStatus).toBe('DUE');
    while (nextStatus(order.status)) order = advanceOrder(order, at);
    expect(order.status).toBe('DELIVERED');
    expect(order.paymentStatus).toBe('PAID');
  });

  it('never advances past delivered', () => {
    let order = createOrder(details, lines, [], at);
    for (let i = 0; i < 10; i += 1) order = advanceOrder(order, at);
    expect(order.status).toBe('DELIVERED');
    expect(order.history.filter((h) => h.status === 'DELIVERED')).toHaveLength(1);
  });

  it('allows cancelling until the rider leaves, restoring stock only before preparation', () => {
    const order = createOrder(details, lines, [], at);
    expect(canCancel(order)).toBe(true);
    expect(cancelRestoresStock(order)).toBe(true);
    const preparing = advanceOrder(order, at);
    expect(preparing.status).toBe('PREPARING');
    expect(canCancel(preparing)).toBe(true);
    expect(cancelRestoresStock(preparing)).toBe(false);
    const out = advanceOrder(advanceOrder(preparing, at), at);
    expect(out.status).toBe('OUT_FOR_DELIVERY');
    expect(canCancel(out)).toBe(false);
    expect(cancelOrder(out, at)).toBe(out);
  });

  it('marks a paid cancellation refund-pending until a person completes it, and voids unpaid ones', () => {
    const cancelled = cancelOrder(createOrder(details, lines, [], at), at);
    expect(cancelled.paymentStatus).toBe('REFUND_PENDING');
    expect(markRefunded(cancelled).paymentStatus).toBe('REFUNDED');
    expect(cancelOrder(createOrder({ ...details, paymentMethod: 'COD' }, lines, [], at), at).paymentStatus).toBe('VOID');
    const paid = createOrder(details, lines, [], at);
    expect(markRefunded(paid)).toBe(paid); // nothing to refund on an active paid order
  });

  it('auto-confirms by default and can leave orders NEW for staff to confirm', () => {
    expect(createOrder(details, lines, [], at).status).toBe('CONFIRMED');
    const pending = createOrder(details, lines, [], at, { autoConfirm: false });
    expect(pending.status).toBe('NEW');
    expect(pending.history.map((h) => h.status)).toEqual(['NEW']);
  });

  it('keeps the payment reference and instructions it was given', () => {
    const o = createOrder({ ...details, paymentReference: 'SIM-1', instructions: '  Ring twice  ' }, lines, [], at);
    expect(o).toMatchObject({ paymentReference: 'SIM-1', instructions: 'Ring twice' });
    expect(normalizeOrder(JSON.parse(JSON.stringify(o)))).toMatchObject({ paymentReference: 'SIM-1', instructions: 'Ring twice' });
  });

  it('issues sequential ids that never collide', () => {
    const a = createOrder(details, lines, [], at);
    const b = createOrder(details, lines, [a], at);
    expect(nextOrderId([a, b])).toBe('TRS-1044');
  });

  it('targets the slowest item for prep time', () => {
    const order = createOrder(details, lines, [], at);
    expect(prepTarget(order)).toBe(8);
  });
});

describe('checkout validation', () => {
  const lines = [makeLine(latte, 'Regular', 1)];
  const good = { name: 'Asha', phone: '+91 98450 12345', email: '', address: '12 Test Road, Indiranagar', pin: '560038' };

  it('accepts a valid Bengaluru order', () => {
    expect(validateCheckout(good, lines)).toEqual({});
  });

  it('normalises Indian phone formats', () => {
    expect(normalizePhone('+91 98450 12345')).toBe('9845012345');
    expect(normalizePhone('09845012345')).toBe('9845012345');
  });

  it('flags every invalid field', () => {
    const errors = validateCheckout({ name: 'A', phone: '12345', email: 'bad@', address: 'short', pin: '12' }, []);
    expect(Object.keys(errors).sort()).toEqual(['address', 'cart', 'email', 'name', 'phone', 'pin']);
  });

  it('only delivers within Bengaluru', () => {
    expect(validateCheckout({ ...good, pin: '400001' }, lines).pin).toMatch(/Bengaluru/);
  });
});

describe('reporting', () => {
  const now = new Date();
  const seeded = seedOrders(now);

  it('seeds sample orders across the status flow', () => {
    expect(seeded).toHaveLength(6);
    expect(seeded.every((o) => o.source === 'sample')).toBe(true);
    expect(new Set(seeded.map((o) => o.status)).size).toBeGreaterThan(3);
  });

  it('excludes cancelled orders from revenue', () => {
    const cancelled = cancelOrder(seeded[5], now);
    const stats = orderStats([...seeded.slice(0, 5), cancelled], now);
    expect(stats.count).toBe(5);
    expect(stats.cancelledToday).toBe(1);
    expect(stats.revenue).toBe(seeded.slice(0, 5).reduce((s, o) => s + o.total, 0));
  });

  it('counts units sold today', () => {
    const sold = unitsSoldToday(seeded, now);
    expect(sold['tresor-latte']).toBe(3);
  });

  it('filters and searches orders', () => {
    expect(filterOrders(seeded, 'ACTIVE', '').every((o) => o.status !== 'DELIVERED')).toBe(true);
    expect(filterOrders(seeded, 'ALL', seeded[0].id)).toHaveLength(1);
  });

  it('escapes quotes in CSV', () => {
    const order: Order = { ...seeded[0], customer: { ...seeded[0].customer, name: 'Asha "AJ"' } };
    expect(ordersToCsv([order])).toContain('"Asha ""AJ"""');
  });

  it('migrates orders saved by the earlier version', () => {
    const legacy = normalizeOrder({ id: 'TRS-1', createdAt: at.toISOString(), items: [{ product: { id: 'tresor-latte' }, qty: 1 }], paymentMethod: 'COD' });
    expect(legacy).toMatchObject({ status: 'CONFIRMED', paymentStatus: 'DUE', source: 'online', total: 210 + DELIVERY_FEE });
    expect(normalizeOrder({ nope: true })).toBeNull();
  });

  it('restores stored lines as sold, never re-priced from the current menu', () => {
    const sold = createOrder(details, [makeLine(latte, 'Regular', 2)], [], at);
    const stored = JSON.parse(JSON.stringify(sold));
    // The menu changes after the sale: new price, new name.
    stored.items[0].product.price = 999;
    const restored = normalizeOrder({ ...stored, items: [{ ...stored.items[0], product: { ...stored.items[0].product, name: 'Old Latte name' } }] })!;
    expect(restored.items[0].unitPrice).toBe(210);
    expect(restored.items[0].product.name).toBe('Old Latte name');
    expect(restored.total).toBe(sold.total);
  });

  it('keeps a custom cake line exactly as ordered, including its option names', () => {
    const line = makeCustomLine({ ...defaultCake(), size: '8in', sponge: 'chocolate' });
    const o = createOrder(details, [line], [], at);
    const restored = normalizeOrder(JSON.parse(JSON.stringify(o)))!;
    expect(restored.items[0].unitPrice).toBe(line.unitPrice);
    expect(restored.items[0].custom?.snapshot?.options.sponge).toBe('Dark chocolate');
    expect(restored.items[0].custom?.snapshot?.price.reduce((s, l) => s + l.amount, 0)).toBe(line.unitPrice);
  });
});

describe('custom cake lines', () => {
  const cake = { ...defaultCake(), size: '8in', sponge: 'chocolate', filling: 'hazelnut' };

  it('prices and summarises from the configuration', () => {
    const line = makeCustomLine(cake);
    expect(line.unitPrice).toBe(cakePrice(cake).total);
    expect(line.lineId).toMatch(/^custom:TC-/);
    expect(line.custom?.title).toBe('Custom dark chocolate cake');
    expect(line.custom?.productionHours).toBe(24);
  });

  it('re-prices on load, so a tampered price never survives', () => {
    const tampered = { ...makeCustomLine(cake), unitPrice: 1, product: { ...makeCustomLine(cake).product, price: 1 } };
    const [restored] = normalizeCart([tampered]);
    expect(restored.unitPrice).toBe(cakePrice(cake).total);
    expect(restored.custom?.config.sponge).toBe('chocolate');
  });

  it('caps custom cakes per line and reports the lead time', () => {
    expect(makeCustomLine(cake, 9).qty).toBe(3);
    const slow = makeCustomLine({ ...cake, finish: 'ruffled' });
    expect(leadHours([makeLine(latte, 'Regular', 1), slow])).toBe(30);
    expect(leadHours([makeLine(latte, 'Regular', 1)])).toBe(0);
  });

  it('draws on real ingredient stock', () => {
    const needs = needsFor([makeCustomLine(cake)]);
    expect(needs.chocolate).toBeGreaterThan(0);
    expect(needs.eggs).toBeCloseTo(4 * (8 / 6) ** 2, 2);
  });

  it('keeps the full specification on the order', () => {
    const order = createOrder(details, [makeCustomLine({ ...cake, message: { ...defaultCake().message, text: 'Happy Birthday Aanya' } })], [], at);
    expect(order.items[0].custom?.config.message.text).toBe('Happy Birthday Aanya');
    expect(prepTarget(order)).toBe(24 * 60);
    expect(normalizeOrder(JSON.parse(JSON.stringify(order)))?.items[0].custom?.designId).toBe(order.items[0].custom?.designId);
  });
});
