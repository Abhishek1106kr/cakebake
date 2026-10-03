// Every price, fee and total in the app comes from this file.

import { getProduct, LARGE_SURCHARGE, type Product, type Size } from '@/data/products';

export const DELIVERY_FEE = 70;
export const FREE_DELIVERY_FROM = 999;
export const MAX_QTY_PER_LINE = 10;
export const BOX_NOTE_LIMIT = 60;

export type Fulfilment = 'delivery' | 'pickup';

/** What is stored: only references, so prices always come from the live menu. */
export type CartLine = { key: string; slug: string; size: Size; qty: number };

export type PricedLine = CartLine & { product: Product; unitPrice: number; lineTotal: number };

export type Totals = {
  itemCount: number;
  subtotal: number;
  delivery: number;
  total: number;
  /** How much more unlocks free delivery; 0 when already free or not applicable. */
  toFreeDelivery: number;
};

export function lineKey(slug: string, size: Size): string {
  return `${slug}:${size}`;
}

export function unitPrice(product: Product, size: Size): number {
  return product.price + (size === 'large' ? LARGE_SURCHARGE : 0);
}

export function priceLines(lines: CartLine[]): PricedLine[] {
  return lines.flatMap((line) => {
    const product = getProduct(line.slug);
    if (!product) return []; // product removed from the menu
    const price = unitPrice(product, line.size);
    return [{ ...line, product, unitPrice: price, lineTotal: price * line.qty }];
  });
}

export function calculateTotals(lines: PricedLine[], fulfilment: Fulfilment = 'delivery'): Totals {
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);
  const deliveryApplies = fulfilment === 'delivery' && subtotal > 0;
  const free = subtotal >= FREE_DELIVERY_FROM;
  const delivery = deliveryApplies && !free ? DELIVERY_FEE : 0;
  return {
    itemCount,
    subtotal,
    delivery,
    total: subtotal + delivery,
    toFreeDelivery: deliveryApplies && !free ? FREE_DELIVERY_FROM - subtotal : 0,
  };
}

export function clampQty(qty: number): number {
  return Math.max(0, Math.min(MAX_QTY_PER_LINE, Math.round(qty)));
}

/** Longest prep time in the cart; drives slot cut-offs and tracking. */
export function cartPrepMinutes(lines: PricedLine[]): number {
  return lines.reduce((max, line) => Math.max(max, line.product.prepMinutes), 0);
}
