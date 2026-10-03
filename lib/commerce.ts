// Commerce logic for the v3 variation. Pure functions; runs in the browser.
// Same business rules as the v2 storefront on main.

import { products, type Product } from './products';

// ---------- Pricing (the only place totals are computed) ----------

export const DELIVERY_FEE = 70;
export const FREE_DELIVERY_FROM = 999;
export const MAX_QTY = 10;

export type CartLine = { slug: string; quantity: number };
export type PricedLine = CartLine & { product: Product; lineTotal: number };

export function priceLines(lines: CartLine[]): PricedLine[] {
  return lines.flatMap((line) => {
    const product = products.find((p) => p.slug === line.slug);
    return product ? [{ ...line, product, lineTotal: product.price * line.quantity }] : [];
  });
}

export function totals(lines: PricedLine[]) {
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const delivery = subtotal === 0 || subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_FEE;
  return { subtotal, itemCount, delivery, total: subtotal + delivery, toFreeDelivery: subtotal > 0 && subtotal < FREE_DELIVERY_FROM ? FREE_DELIVERY_FROM - subtotal : 0 };
}

/** Reads carts saved by the original v3 (whole product objects) or this version (slug + quantity). */
export function normalizeCart(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const slug = typeof entry?.slug === 'string' ? entry.slug : undefined;
    const quantity = Math.min(MAX_QTY, Math.max(0, Math.round(Number(entry?.quantity) || 0)));
    return slug && quantity > 0 && products.some((p) => p.slug === slug) ? [{ slug, quantity }] : [];
  });
}

// ---------- Orders and tracking ----------

export type OrderStatus = 'NEW' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'OUT FOR DELIVERY' | 'DELIVERED';
export type PaymentMethod = 'UPI' | 'CARD' | 'PAY AT DOOR';

export const STEPS: { status: OrderStatus; copy: string; atSeconds: number }[] = [
  { status: 'NEW', copy: 'Order received', atSeconds: 0 },
  { status: 'CONFIRMED', copy: 'Order confirmed', atSeconds: 4 },
  { status: 'PREPARING', copy: 'The bakery is working on it', atSeconds: 18 },
  { status: 'READY', copy: 'Ready to leave the bakery', atSeconds: 50 },
  { status: 'OUT FOR DELIVERY', copy: 'On the way to you', atSeconds: 70 },
  { status: 'DELIVERED', copy: 'Enjoy your order', atSeconds: 130 },
];

export type Order = {
  id: string;
  createdAt: string;
  customer: { name: string; phone: string };
  address: string;
  pin: string;
  slot: string;
  instructions: string;
  payment: { method: PaymentMethod; status: 'PAID' | 'DUE'; reference: string; simulated: true };
  items: { slug: string; name: string; price: number; quantity: number }[];
  subtotal: number;
  delivery: number;
  total: number;
};

/**
 * Prototype tracking: status advances on a compressed demo clock (about two
 * minutes end to end) measured from when the order was placed.
 */
export function statusIndexAt(order: Order, now: number): number {
  const elapsed = (now - new Date(order.createdAt).getTime()) / 1000;
  let index = 0;
  STEPS.forEach((step, i) => { if (elapsed >= step.atSeconds) index = i; });
  return index;
}

export function stepTime(order: Order, index: number): string {
  const at = new Date(new Date(order.createdAt).getTime() + STEPS[index].atSeconds * 1000);
  return at.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function minutesLeft(order: Order, now: number): number {
  const deliveredAt = new Date(order.createdAt).getTime() + STEPS[STEPS.length - 1].atSeconds * 1000;
  return Math.max(0, Math.ceil((deliveredAt - now) / 60000));
}

export function nextOrderId(existing: Order[]): string {
  const taken = new Set(existing.map((o) => o.id));
  for (let i = 0; i < 50; i += 1) {
    const id = `TRS-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!taken.has(id)) return id;
  }
  return `TRS-${Date.now().toString().slice(-6)}`;
}

// ---------- Validation ----------

export type CheckoutForm = { name: string; phone: string; address: string; pin: string; instructions: string; upiId: string; cardNumber: string };
export type CheckoutErrors = Partial<Record<keyof CheckoutForm, string>>;

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export function validate(form: CheckoutForm, method: PaymentMethod): CheckoutErrors {
  const errors: CheckoutErrors = {};
  if (form.name.trim().length < 2) errors.name = 'Tell us who the order is for.';
  if (!/^[6-9]\d{9}$/.test(normalizePhone(form.phone))) errors.phone = 'Enter a 10-digit mobile number.';
  if (form.address.trim().length < 10) errors.address = 'Add your flat, building and street.';
  if (!/^\d{6}$/.test(form.pin)) errors.pin = 'Enter a 6-digit PIN code.';
  else if (!form.pin.startsWith('560')) errors.pin = 'We deliver within Bengaluru (PIN codes starting 560).';
  if (method === 'UPI' && !/^[\w.-]{2,}@[a-z]{2,}$/i.test(form.upiId.trim())) errors.upiId = 'Enter a UPI ID like name@bank.';
  if (method === 'CARD' && !/^\d{13,19}$/.test(form.cardNumber.replace(/\s/g, ''))) errors.cardNumber = 'Check the card number.';
  return errors;
}

// ---------- Payment: SIMULATED, no money moves ----------
// Replace with a real gateway behind this function. Failure triggers for
// testing: a UPI ID containing "fail", or a card number ending in 0002.

export async function simulatePayment(method: PaymentMethod, upiId: string, cardNumber: string): Promise<{ ok: true; status: 'PAID' | 'DUE'; reference: string } | { ok: false; reason: string }> {
  await new Promise((resolve) => setTimeout(resolve, 1100));
  if (method === 'PAY AT DOOR') return { ok: true, status: 'DUE', reference: ref() };
  if (method === 'UPI' && upiId.toLowerCase().includes('fail')) return { ok: false, reason: 'Your UPI app declined the request.' };
  if (method === 'CARD' && cardNumber.replace(/\D/g, '').endsWith('0002')) return { ok: false, reason: 'Your bank declined the card.' };
  return { ok: true, status: 'PAID', reference: ref() };
}

function ref() {
  return `SIM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
