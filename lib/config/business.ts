// Business rules the shop reads at runtime. Defaults are the values the site has
// always used; admin Settings can override them (persisted in this browser now,
// served by the backend later). Pure getter/setter with a subscription, so
// pricing code stays free of UI and storage concerns.

export type BusinessRules = {
  /** Delivery fee below the free-delivery threshold (₹). */
  deliveryFee: number;
  /** Orders at or above this subtotal deliver free (₹). */
  freeDeliveryFrom: number;
  /** New orders skip NEW and arrive CONFIRMED (the original behaviour). */
  autoConfirm: boolean;
  /** Tax shown on invoices (snapshotted onto each invoice when it is issued). */
  taxRate: number;
  taxInclusive: boolean;
  gstin: string;
};

export const DEFAULT_RULES: BusinessRules = { deliveryFee: 70, freeDeliveryFrom: 999, autoConfirm: true, taxRate: 0, taxInclusive: true, gstin: '' };

let current: BusinessRules = DEFAULT_RULES;
const listeners = new Set<() => void>();

export const businessRules = (): BusinessRules => current;

/** Replaces the rules (invalid numbers fall back to the defaults). */
export function setBusinessRules(next: Partial<BusinessRules>) {
  const num = (v: unknown, fallback: number, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : fallback);
  const merged: BusinessRules = {
    deliveryFee: num(next.deliveryFee, DEFAULT_RULES.deliveryFee, 0, 1000),
    freeDeliveryFrom: num(next.freeDeliveryFrom, DEFAULT_RULES.freeDeliveryFrom, 0, 100000),
    autoConfirm: typeof next.autoConfirm === 'boolean' ? next.autoConfirm : DEFAULT_RULES.autoConfirm,
    taxRate: typeof next.taxRate === 'number' && next.taxRate >= 0 && next.taxRate <= 28 ? next.taxRate : DEFAULT_RULES.taxRate,
    taxInclusive: typeof next.taxInclusive === 'boolean' ? next.taxInclusive : DEFAULT_RULES.taxInclusive,
    gstin: typeof next.gstin === 'string' ? next.gstin.slice(0, 15) : DEFAULT_RULES.gstin,
  };
  if (JSON.stringify(merged) === JSON.stringify(current)) return;
  current = merged;
  listeners.forEach((l) => l());
}

export function onBusinessRules(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
