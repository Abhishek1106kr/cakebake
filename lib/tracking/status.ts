// Order status for customers: the state machine, the words, and honest ETAs.
// The internal enum (lib/orders.ts) is unchanged; this maps it for people.
// Admin, tracking and the WhatsApp automation all read this one module.

import { prepTarget, statusTime, type Order, type OrderStatus } from '@/lib/orders';

/** Customer-facing states. PAYMENT_FAILED is display-only: a failed payment never creates an order here. */
export type TrackingStatus = OrderStatus | 'PAYMENT_FAILED';

export const JOURNEY: OrderStatus[] = ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'];

/** Valid transitions, explicitly. Anything else is rejected. */
export const TRANSITIONS: Record<TrackingStatus, TrackingStatus[]> = {
  NEW: ['CONFIRMED', 'CANCELLED', 'PAYMENT_FAILED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
  PAYMENT_FAILED: [],
};

export const canTransition = (from: TrackingStatus, to: TrackingStatus) => TRANSITIONS[from]?.includes(to) ?? false;
export const isTerminal = (s: TrackingStatus) => TRANSITIONS[s].length === 0;

export type StatusCopy = { headline: string; line: string; label: string; doing: string; whatsapp: string };

/** One good line per state. `cake` variants when the order holds a custom cake. */
export function statusCopy(status: TrackingStatus, opts: { cake?: boolean; delivery?: boolean } = {}): StatusCopy {
  const thing = opts.cake ? 'cake' : 'order';
  switch (status) {
    case 'NEW': return { headline: 'We’ve got your order.', line: 'It’s on the counter, waiting for a baker.', label: 'Order placed', doing: 'Your order has reached us.', whatsapp: 'We’ve received your Tresor order.' };
    case 'CONFIRMED': return { headline: `Your ${thing} is confirmed.`, line: 'Good things are about to be baked.', label: 'Confirmed', doing: 'A baker has picked it up.', whatsapp: 'Your Tresor order is confirmed.' };
    case 'PREPARING': return { headline: opts.cake ? 'Your cake is being made.' : 'We’re baking it.', line: opts.cake ? 'Layer by layer, by hand.' : 'We’re putting the finishing touches on it.', label: 'Preparing', doing: opts.cake ? 'Your cake is being made.' : 'Your order is being prepared.', whatsapp: 'We’re preparing your Tresor order.' };
    case 'READY': return { headline: `Your ${thing} is ready.`, line: opts.delivery === false ? 'Boxed and waiting for you at the counter.' : 'Boxed, ribboned and waiting for the rider.', label: 'Ready', doing: 'Boxed and ready to go.', whatsapp: 'Your Tresor order is ready.' };
    case 'OUT_FOR_DELIVERY': return { headline: 'It’s on the way.', line: 'Almost there.', label: 'Out for delivery', doing: 'With our rider, heading to you.', whatsapp: 'Your Tresor order is on the way.' };
    case 'DELIVERED': return { headline: 'It’s here.', line: 'Enjoy something sweet.', label: 'Delivered', doing: 'Delivered. Enjoy.', whatsapp: 'Your Tresor order has been delivered. Enjoy!' };
    case 'CANCELLED': return { headline: 'This order was cancelled.', line: 'If that’s unexpected, we’re here to help.', label: 'Cancelled', doing: 'This order was cancelled.', whatsapp: 'Your Tresor order has been cancelled.' };
    case 'PAYMENT_FAILED': return { headline: 'Your payment didn’t go through.', line: 'No money was taken. You can try again.', label: 'Payment failed', doing: 'The payment didn’t complete.', whatsapp: 'Your payment for the Tresor order didn’t go through.' };
  }
}

export const hasCustomCake = (o: Order) => o.items.some((l) => l.custom);
export const customLeadHours = (o: Order) => o.items.reduce((m, l) => Math.max(m, l.custom?.productionHours ?? 0), 0);

const clock = (d: Date) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
const dayWord = (d: Date, now: Date) => {
  const a = new Date(d); a.setHours(0, 0, 0, 0);
  const b = new Date(now); b.setHours(0, 0, 0, 0);
  const diff = Math.round((a.getTime() - b.getTime()) / 86400000);
  return diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

export type Estimate = { title: string; value: string; detail: string | null; approximate: boolean; readyAt: string | null; deliveryAt: string | null };

/** Delivery takes this long once the rider leaves (a range, never a promise). */
export const DELIVERY_MINUTES: [number, number] = [20, 35];

/**
 * The best honest estimate for the current state. Ranges and "around" wording,
 * because these are approximations, never countdowns.
 */
export function estimate(order: Order, status: TrackingStatus, now = new Date()): Estimate {
  const at = (s: OrderStatus) => { const t = statusTime(order, s); return t ? new Date(t) : null; };
  const add = (d: Date, min: number) => new Date(d.getTime() + min * 60000);
  if (hasCustomCake(order)) {
    const hours = customLeadHours(order);
    const placed = new Date(order.createdAt);
    const earliest = add(placed, hours * 60);
    if (status === 'DELIVERED') { const d = at('DELIVERED') ?? now; return { title: 'Delivered', value: `${dayWord(d, now)} · ${clock(d)}`, detail: null, approximate: false, readyAt: null, deliveryAt: d.toISOString() }; }
    if (status === 'OUT_FOR_DELIVERY') { const out = at('OUT_FOR_DELIVERY') ?? now; return { title: 'Arriving', value: `around ${clock(add(out, DELIVERY_MINUTES[0]))}–${clock(add(out, DELIVERY_MINUTES[1]))}`, detail: null, approximate: true, readyAt: null, deliveryAt: add(out, DELIVERY_MINUTES[1]).toISOString() }; }
    return { title: status === 'READY' ? 'Delivery slot' : 'Earliest ready', value: status === 'READY' ? order.slot : `${dayWord(earliest, now)} · around ${clock(earliest)}`, detail: `Your cake needs about ${hours} hours to bake and finish. Delivery slot: ${order.slot}.`, approximate: true, readyAt: earliest.toISOString(), deliveryAt: null };
  }
  const prep = prepTarget(order) + 5;
  const start = at('CONFIRMED') ?? new Date(order.createdAt);
  const readyAt = at('READY') ?? add(start, prep);
  switch (status) {
    case 'NEW': case 'CONFIRMED': return { title: 'Ready around', value: clock(readyAt), detail: `Delivery slot: ${order.slot}`, approximate: true, readyAt: readyAt.toISOString(), deliveryAt: null };
    case 'PREPARING': {
      const left = Math.round((readyAt.getTime() - now.getTime()) / 60000);
      return { title: 'Ready around', value: clock(readyAt), detail: left > 2 ? `About ${Math.max(5, Math.round(left / 5) * 5)} min to go` : 'Any minute now', approximate: true, readyAt: readyAt.toISOString(), deliveryAt: null };
    }
    case 'READY': return { title: 'Estimated delivery', value: `${clock(add(readyAt, 10))}–${clock(add(readyAt, 10 + DELIVERY_MINUTES[1]))}`, detail: 'As soon as the rider collects it', approximate: true, readyAt: readyAt.toISOString(), deliveryAt: add(readyAt, 10 + DELIVERY_MINUTES[1]).toISOString() };
    case 'OUT_FOR_DELIVERY': { const out = at('OUT_FOR_DELIVERY') ?? now; return { title: 'Arriving', value: `around ${clock(add(out, DELIVERY_MINUTES[0]))}–${clock(add(out, DELIVERY_MINUTES[1]))}`, detail: `${DELIVERY_MINUTES[0]}–${DELIVERY_MINUTES[1]} min from the bakery`, approximate: true, readyAt: null, deliveryAt: add(out, DELIVERY_MINUTES[1]).toISOString() }; }
    case 'DELIVERED': { const d = at('DELIVERED') ?? now; return { title: 'Delivered', value: clock(d), detail: null, approximate: false, readyAt: null, deliveryAt: d.toISOString() }; }
    default: return { title: '', value: '', detail: null, approximate: false, readyAt: null, deliveryAt: null };
  }
}

/** How far along the delivery leg is, 0–1, for the conceptual journey line (no fake map). */
export function deliveryProgress(order: Order, now = new Date()): number {
  const out = statusTime(order, 'OUT_FOR_DELIVERY');
  if (!out) return 0;
  const elapsed = (now.getTime() - new Date(out).getTime()) / 60000;
  return Math.max(0.04, Math.min(0.92, elapsed / ((DELIVERY_MINUTES[0] + DELIVERY_MINUTES[1]) / 2)));
}
