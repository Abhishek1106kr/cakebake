// Order domain: pricing, validation, status flow and reporting.
// Pure functions only. State lives in components/store-provider.tsx.

import { products, type Product } from './data';
import { designIdFor, optionNames, price as cakePrice, productionHours as cakeHours, sanitize as sanitizeCake, summary as cakeSummary } from './cake/engine';
import { MAX_CUSTOM_CAKES_PER_ORDER } from './cake/config';
import type { CakeConfiguration } from './cake/types';
import { businessRules, DEFAULT_RULES } from './config/business';

// ---------- Pricing (the only place fees and totals are computed) ----------

export type Size = 'Regular' | 'Large';

/** Defaults. Live values come from businessRules(), which admin Settings can change. */
export const DELIVERY_FEE = DEFAULT_RULES.deliveryFee;
export const FREE_DELIVERY_FROM = DEFAULT_RULES.freeDeliveryFrom;
export const LARGE_SURCHARGE = 40;
export const MAX_QTY_PER_LINE = 10;

/** A custom cake's production specification, carried on its cart line and into the order. */
export type CustomCakeSpec = {
  designId: string;
  config: CakeConfiguration;
  title: string;
  lines: string[];
  productionHours: number;
  priceVersion: string;
  /** Browser-storage references: the customer's photo and the rendered print artwork. */
  printAssetId: string | null;
  artworkAssetId: string | null;
  /**
   * What the customer chose and paid, frozen when the line was made: option names and the
   * price breakdown. Production sheets and invoices read this, so renaming or re-pricing
   * an option later never rewrites an order.
   */
  snapshot?: { options: Record<string, string>; price: { label: string; amount: number }[] };
};

export type CartLine = { lineId: string; product: Product; size: Size; unitPrice: number; qty: number; custom?: CustomCakeSpec };

/**
 * A cart line for a custom cake. Price, summary and production time are always derived
 * from the configuration here, never taken from the caller.
 */
export function makeCustomLine(raw: CakeConfiguration, qty = 1, assets: { artworkAssetId?: string | null } = {}): CartLine {
  const config = sanitizeCake(raw);
  const breakdown = cakePrice(config);
  const s = cakeSummary(config);
  const designId = designIdFor(config);
  const product: Product = { id: 'custom-cake', name: s.title, category: 'Cake', description: s.lines[0], price: breakdown.total, image: 'custom-cake', searchTerms: [], prepMinutes: cakeHours(config) * 60 };
  return {
    lineId: `custom:${designId}`, product, size: 'Regular', unitPrice: breakdown.total, qty: Math.min(MAX_CUSTOM_CAKES_PER_ORDER, Math.max(1, qty)),
    custom: {
      designId, config, title: s.title, lines: s.lines, productionHours: cakeHours(config), priceVersion: breakdown.version,
      printAssetId: config.print.enabled ? config.print.assetId : null, artworkAssetId: assets.artworkAssetId ?? null,
      snapshot: { options: optionNames(config), price: breakdown.lines },
    },
  };
}

export const isCustomLine = (line: Pick<CartLine, 'custom'>) => Boolean(line.custom);

/** Hours until everything in the bag can be ready (custom cakes are made to order). */
export function leadHours(lines: CartLine[]): number {
  return lines.reduce((max, l) => Math.max(max, l.custom?.productionHours ?? 0), 0);
}

/** Only drinks come in two sizes. */
export function sizesFor(product: Product): Size[] {
  return product.category === 'Coffee' || product.category === 'Drinks' ? ['Regular', 'Large'] : ['Regular'];
}

export function unitPrice(product: Product, size: Size): number {
  return product.price + (size === 'Large' ? LARGE_SURCHARGE : 0);
}

export function lineIdFor(productId: string, size: Size): string {
  return `${productId}:${size}`;
}

export function makeLine(product: Product, size: Size, qty: number): CartLine {
  return { lineId: lineIdFor(product.id, size), product, size, unitPrice: unitPrice(product, size), qty };
}

export function calcTotals(lines: CartLine[]) {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);
  const { deliveryFee, freeDeliveryFrom } = businessRules();
  const delivery = subtotal === 0 || subtotal >= freeDeliveryFrom ? 0 : deliveryFee;
  return { subtotal, delivery, total: subtotal + delivery, itemCount, toFreeDelivery: subtotal > 0 && subtotal < freeDeliveryFrom ? freeDeliveryFrom - subtotal : 0 };
}

/** Restores cart lines saved by an older version or another tab, re-pricing from the live menu. */
export function normalizeCart(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    // Custom cakes: rebuild from the configuration so price and summary can't be tampered with.
    if (entry?.custom?.config) return [makeCustomLine(entry.custom.config, Number(entry.qty) || 1, { artworkAssetId: entry.custom.artworkAssetId ?? null })];
    const id = entry?.product?.id;
    const product = products.find((p) => p.id === id);
    const qty = Math.min(MAX_QTY_PER_LINE, Math.max(0, Math.round(Number(entry?.qty) || 0)));
    if (!product || qty <= 0) return [];
    const size: Size = entry?.size === 'Large' && sizesFor(product).includes('Large') ? 'Large' : 'Regular';
    return [makeLine(product, size, qty)];
  });
}

// ---------- Orders ----------

export type OrderStatus = 'NEW' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
export type PaymentMethod = 'UPI' | 'Card' | 'COD';
/** REFUND_PENDING: a paid order was cancelled; a person still has to complete the refund. */
export type PaymentStatus = 'PAID' | 'DUE' | 'REFUND_PENDING' | 'REFUNDED' | 'VOID' | 'FAILED';
export type StatusEvent = { status: OrderStatus; at: string };

export type Order = {
  id: string;
  createdAt: string;
  customer: { name: string; phone: string; email: string };
  address: string;
  city: string;
  pin: string;
  slot: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  subtotal: number;
  delivery: number;
  total: number;
  status: OrderStatus;
  history: StatusEvent[];
  items: CartLine[];
  source: 'online' | 'sample';
  /** The payment gateway's reference (simulated today), when there is one. */
  paymentReference?: string;
  /** Delivery instructions from the customer, if any. */
  instructions?: string;
};

export type CheckoutDetails = Pick<Order, 'customer' | 'address' | 'city' | 'pin' | 'slot' | 'paymentMethod'> & Partial<Pick<Order, 'paymentReference' | 'instructions'>>;

export const STATUS_FLOW: OrderStatus[] = ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: 'New',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  READY: 'Ready',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

/** Label for the button that moves an order to its next status. */
export const NEXT_ACTION: Partial<Record<OrderStatus, string>> = {
  NEW: 'Confirm',
  CONFIRMED: 'Start preparing',
  PREPARING: 'Mark ready',
  READY: 'Hand to rider',
  OUT_FOR_DELIVERY: 'Mark delivered',
};

export function nextStatus(status: OrderStatus): OrderStatus | null {
  const index = STATUS_FLOW.indexOf(status);
  return index === -1 || index === STATUS_FLOW.length - 1 ? null : STATUS_FLOW[index + 1];
}

export function isActive(order: Order): boolean {
  return order.status !== 'DELIVERED' && order.status !== 'CANCELLED';
}

/** Orders can be cancelled until they leave with the rider. */
export function canCancel(order: Order): boolean {
  return ['NEW', 'CONFIRMED', 'PREPARING', 'READY'].includes(order.status);
}

/** Ingredients go back on the shelf only if the kitchen hadn't started. */
export function cancelRestoresStock(order: Order): boolean {
  return order.status === 'NEW' || order.status === 'CONFIRMED';
}

export function advanceOrder(order: Order, at: Date): Order {
  const next = nextStatus(order.status);
  if (!next) return order;
  return {
    ...order,
    status: next,
    history: [...order.history, { status: next, at: at.toISOString() }],
    paymentStatus: next === 'DELIVERED' && order.paymentStatus === 'DUE' ? 'PAID' : order.paymentStatus,
  };
}

export function cancelOrder(order: Order, at: Date): Order {
  if (!canCancel(order)) return order;
  return {
    ...order,
    status: 'CANCELLED',
    history: [...order.history, { status: 'CANCELLED', at: at.toISOString() }],
    paymentStatus: order.paymentStatus === 'PAID' ? 'REFUND_PENDING' : 'VOID',
  };
}

/** A person confirms that the refund of a cancelled, paid order was completed. */
export function markRefunded(order: Order): Order {
  return order.paymentStatus === 'REFUND_PENDING' ? { ...order, paymentStatus: 'REFUNDED' } : order;
}

/** The last order number in the shipped demo dataset (TRS-09141); new orders continue after it. */
export const ORDER_NUMBER_FLOOR = 9141;

/** Sequential TRS-##### ids; never collides with a shipped order or one already on this device. */
export function nextOrderId(orders: Order[], floor = ORDER_NUMBER_FLOOR): string {
  const highest = orders.reduce((max, order) => Math.max(max, Number(order.id.replace(/\D/g, '')) || 0), floor);
  return `TRS-${String(highest + 1).padStart(5, '0')}`;
}

export function createOrder(details: CheckoutDetails, lines: CartLine[], existing: Order[], at: Date, opts: { autoConfirm?: boolean } = {}): Order {
  const totals = calcTotals(lines);
  const iso = at.toISOString();
  const autoConfirm = opts.autoConfirm ?? businessRules().autoConfirm;
  const { paymentReference, instructions, ...rest } = details;
  return {
    ...rest,
    ...(paymentReference ? { paymentReference } : {}),
    ...(instructions?.trim() ? { instructions: instructions.trim().slice(0, 300) } : {}),
    id: nextOrderId(existing),
    createdAt: iso,
    subtotal: totals.subtotal,
    delivery: totals.delivery,
    total: totals.total,
    items: lines,
    status: autoConfirm ? 'CONFIRMED' : 'NEW',
    history: autoConfirm ? [{ status: 'NEW', at: iso }, { status: 'CONFIRMED', at: iso }] : [{ status: 'NEW', at: iso }],
    paymentStatus: details.paymentMethod === 'COD' ? 'DUE' : 'PAID',
    source: 'online',
  };
}

export function statusTime(order: Order, status: OrderStatus): string | undefined {
  return order.history.find((event) => event.status === status)?.at;
}

// ---------- Checkout validation ----------

export type CheckoutField = 'name' | 'phone' | 'email' | 'address' | 'pin' | 'cart';
export type CheckoutErrors = Partial<Record<CheckoutField, string>>;

/** Keeps the 10-digit Indian mobile number, dropping +91 / 0 prefixes and spaces. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export function validateCheckout(details: { name: string; phone: string; email: string; address: string; pin: string }, lines: CartLine[]): CheckoutErrors {
  const errors: CheckoutErrors = {};
  if (lines.length === 0) errors.cart = 'Your bag is empty.';
  if (details.name.trim().length < 2) errors.name = 'Tell us who the order is for.';
  if (!/^[6-9]\d{9}$/.test(normalizePhone(details.phone))) errors.phone = 'Enter a 10-digit mobile number.';
  if (details.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(details.email.trim())) errors.email = 'This email looks incomplete.';
  if (details.address.trim().length < 10) errors.address = 'Add your flat, building and street.';
  if (!/^\d{6}$/.test(details.pin)) errors.pin = 'Enter a 6-digit PIN code.';
  else if (!details.pin.startsWith('560')) errors.pin = 'We deliver within Bengaluru (PIN codes starting 560).';
  return errors;
}

// ---------- Reporting ----------

export function isSameDay(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export function orderStats(orders: Order[], now: Date) {
  const today = orders.filter((order) => isSameDay(order.createdAt, now) && order.status !== 'CANCELLED');
  const revenue = today.reduce((sum, order) => sum + order.total, 0);
  return {
    revenue,
    count: today.length,
    averageValue: today.length ? Math.round(revenue / today.length) : 0,
    inKitchen: orders.filter((o) => o.status === 'NEW' || o.status === 'CONFIRMED' || o.status === 'PREPARING').length,
    ready: orders.filter((o) => o.status === 'READY').length,
    onTheWay: orders.filter((o) => o.status === 'OUT_FOR_DELIVERY').length,
    cancelledToday: orders.filter((o) => o.status === 'CANCELLED' && isSameDay(o.createdAt, now)).length,
  };
}

export function unitsSoldToday(orders: Order[], now: Date): Record<string, number> {
  const sold: Record<string, number> = {};
  for (const order of orders) {
    if (order.status === 'CANCELLED' || !isSameDay(order.createdAt, now)) continue;
    for (const line of order.items) sold[line.product.id] = (sold[line.product.id] ?? 0) + line.qty;
  }
  return sold;
}

export type OrderFilter = 'ALL' | 'ACTIVE' | OrderStatus;

export function filterOrders(orders: Order[], filter: OrderFilter, query: string): Order[] {
  const q = query.trim().toLowerCase();
  return orders
    .filter((order) => filter === 'ALL' || (filter === 'ACTIVE' ? isActive(order) : filter === 'CONFIRMED' ? order.status === 'CONFIRMED' || order.status === 'NEW' : order.status === filter))
    .filter((order) => !q || order.id.toLowerCase().includes(q) || order.customer.name.toLowerCase().includes(q) || order.customer.phone.includes(q))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function minutesSince(iso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60000));
}

/** The kitchen's target: the slowest item in the order. */
export function prepTarget(order: Order): number {
  return order.items.reduce((max, line) => Math.max(max, line.custom ? line.custom.productionHours * 60 : line.product.prepMinutes ?? 5), 0);
}

export function itemsSummary(order: Order): string {
  return order.items.map((line) => `${line.qty} × ${line.product.name}${line.size === 'Large' ? ' (L)' : ''}`).join(', ');
}

export function ordersToCsv(orders: Order[]): string {
  const header = ['Order', 'Placed', 'Customer', 'Phone', 'Status', 'Payment', 'Payment status', 'Items', 'Subtotal', 'Delivery', 'Total'];
  const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const rows = orders.map((o) => [o.id, o.createdAt, o.customer.name, o.customer.phone, STATUS_LABEL[o.status], o.paymentMethod, o.paymentStatus, itemsSummary(o), o.subtotal, o.delivery, o.total].map(escape).join(','));
  return [header.map(escape).join(','), ...rows].join('\n');
}

// ---------- Migration and demo data ----------

/**
 * Restores an order's lines exactly as they were sold: name, price and custom cake spec are
 * the order's own snapshot, never re-read from today's menu or cake prices. Lines saved
 * before snapshots existed (no unit price) fall back to the menu.
 */
export function restoreOrderLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): CartLine[] => {
    const p = entry?.product;
    const qty = Math.max(0, Math.round(Number(entry?.qty) || 0));
    const unit = Number(entry?.unitPrice);
    if (!p || typeof p.id !== 'string' || qty <= 0) return [];
    if (entry.unitPrice === undefined || !Number.isFinite(unit) || unit < 0) return normalizeCart([entry]);
    const size: Size = entry.size === 'Large' ? 'Large' : 'Regular';
    const product: Product = {
      ...p, name: String(p.name ?? p.id), category: String(p.category ?? ''), description: String(p.description ?? ''),
      price: Number.isFinite(Number(p.price)) ? Number(p.price) : unit, image: String(p.image ?? ''), searchTerms: Array.isArray(p.searchTerms) ? p.searchTerms : [],
    };
    const custom = entry.custom?.config ? ({ ...entry.custom, config: sanitizeCake(entry.custom.config) } as CustomCakeSpec) : undefined;
    return [{ lineId: String(entry.lineId ?? lineIdFor(p.id, size)), product, size, unitPrice: unit, qty, ...(custom ? { custom } : {}) }];
  });
}

/** Accepts orders saved by the earlier version of the site (no history/source fields). */
export function normalizeOrder(raw: unknown): Order | null {
  const o = raw as Partial<Order> | null;
  if (!o || typeof o.id !== 'string' || !o.createdAt) return null;
  const items = restoreOrderLines(o.items);
  const status = (o.status && o.status in STATUS_LABEL ? o.status : 'CONFIRMED') as OrderStatus;
  return {
    id: o.id,
    createdAt: o.createdAt,
    customer: { name: o.customer?.name ?? '', phone: o.customer?.phone ?? '', email: o.customer?.email ?? '' },
    address: o.address ?? '',
    city: o.city ?? 'Bengaluru',
    pin: o.pin ?? '',
    slot: o.slot ?? '',
    paymentMethod: (['UPI', 'Card', 'COD'].includes(o.paymentMethod as string) ? o.paymentMethod : 'UPI') as PaymentMethod,
    ...(typeof o.paymentReference === 'string' ? { paymentReference: o.paymentReference } : {}),
    ...(typeof o.instructions === 'string' ? { instructions: o.instructions } : {}),
    paymentStatus: o.paymentStatus ?? (o.paymentMethod === 'COD' ? 'DUE' : 'PAID'),
    subtotal: o.subtotal ?? calcTotals(items).subtotal,
    delivery: o.delivery ?? calcTotals(items).delivery,
    total: o.total ?? calcTotals(items).total,
    status,
    history: Array.isArray(o.history) && o.history.length ? o.history : [{ status, at: o.createdAt }],
    items,
    source: o.source ?? 'online',
  };
}

const SAMPLE_NAMES = ['Riya Sharma', 'Arjun Mehta', 'Meera Nair', 'Kabir Rao', 'Ananya Das', 'Vikram Iyer'];

/** Demo orders so the admin isn't empty on first load. Marked source: 'sample'. */
export function seedOrders(now: Date): Order[] {
  const plan: { minutesAgo: number; status: OrderStatus; items: [string, number, Size?][]; pay: PaymentMethod }[] = [
    { minutesAgo: 95, status: 'DELIVERED', items: [['basque-cheesecake', 2], ['tresor-latte', 2]], pay: 'UPI' },
    { minutesAgo: 42, status: 'OUT_FOR_DELIVERY', items: [['mushroom-toast', 1], ['cold-brew', 1, 'Large'], ['chocolate-brownie', 2]], pay: 'Card' },
    { minutesAgo: 26, status: 'READY', items: [['almond-croissant', 2], ['tresor-latte', 1]], pay: 'COD' },
    { minutesAgo: 15, status: 'PREPARING', items: [['truffle-fries', 1], ['citrus-tea', 2]], pay: 'UPI' },
    { minutesAgo: 9, status: 'PREPARING', items: [['pain-au-chocolat', 3], ['matcha-cloud', 1]], pay: 'UPI' },
    { minutesAgo: 3, status: 'CONFIRMED', items: [['pistachio-tart', 1], ['berry-parfait', 1]], pay: 'Card' },
  ];
  return plan.map((entry, i) => {
    const createdAt = new Date(now.getTime() - entry.minutesAgo * 60000);
    const lines = entry.items.flatMap(([id, qty, size]) => {
      const product = products.find((p) => p.id === id);
      return product ? [makeLine(product, size ?? 'Regular', qty)] : [];
    });
    const totals = calcTotals(lines);
    const steps = STATUS_FLOW.slice(0, STATUS_FLOW.indexOf(entry.status) + 1);
    const span = entry.minutesAgo / Math.max(1, steps.length);
    return {
      id: `TRS-${1036 + i}`,
      createdAt: createdAt.toISOString(),
      customer: { name: SAMPLE_NAMES[i], phone: `98450${String(10000 + i * 1371).slice(-5)}`, email: '' },
      address: 'Sample address',
      city: 'Bengaluru',
      pin: '560038',
      slot: 'As soon as possible',
      paymentMethod: entry.pay,
      paymentStatus: entry.pay === 'COD' && entry.status !== 'DELIVERED' ? 'DUE' : 'PAID',
      subtotal: totals.subtotal,
      delivery: totals.delivery,
      total: totals.total,
      status: entry.status,
      history: steps.map((status, s) => ({ status, at: new Date(createdAt.getTime() + s * span * 60000).toISOString() })),
      items: lines,
      source: 'sample' as const,
    };
  });
}
