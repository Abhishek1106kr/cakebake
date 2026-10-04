import { describe, expect, it } from 'vitest';
import { products, type Product } from './data';
import {
  DELIVERY_FEE, FREE_DELIVERY_FROM, LARGE_SURCHARGE, MAX_QTY_PER_LINE,
  advanceOrder, calcTotals, canCancel, cancelOrder, cancelRestoresStock, createOrder, filterOrders,
  makeLine, nextOrderId, nextStatus, normalizeCart, normalizeOrder, normalizePhone, orderStats,
  ordersToCsv, prepTarget, seedOrders, sizesFor, unitPrice, unitsSoldToday, validateCheckout,
  type CheckoutDetails, type Order,
} from './orders';

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

  it('refunds paid orders and voids unpaid ones on cancel', () => {
    expect(cancelOrder(createOrder(details, lines, [], at), at).paymentStatus).toBe('REFUNDED');
    expect(cancelOrder(createOrder({ ...details, paymentMethod: 'COD' }, lines, [], at), at).paymentStatus).toBe('VOID');
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
});
