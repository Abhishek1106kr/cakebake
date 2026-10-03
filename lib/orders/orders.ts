// Orders live in this browser only (frontend-only business logic).

import type { Size } from '@/data/products';
import type { Fulfilment, PricedLine, Totals } from '@/lib/cart/pricing';
import type { Slot } from '@/lib/delivery/slots';
import { leadMinutes } from '@/lib/delivery/slots';
import type { PaymentMethod } from './payment';

export type OrderStatus = 'NEW' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED';

export type OrderItem = { slug: string; name: string; size: Size; unitPrice: number; qty: number };

export type Order = {
  id: string;
  createdAt: number;
  fulfilment: Fulfilment;
  slot: { id: string; label: string; kind: Slot['kind']; startsAt: number };
  customer: { name: string; phone: string; email?: string };
  address?: { line: string; pin: string; area: string };
  instructions?: string;
  boxNote?: string;
  items: OrderItem[];
  totals: Pick<Totals, 'subtotal' | 'delivery' | 'total' | 'itemCount'>;
  payment: { method: PaymentMethod; status: 'PAID' | 'DUE'; reference: string; simulated: true };
  prepMinutes: number;
  /** When each status begins. Tracking derives the current status from this. */
  schedule: { status: OrderStatus; at: number }[];
  demoTimeline: boolean;
};

/** Generates TRS-XXXX, retrying until it doesn't clash with an existing order. */
export function generateOrderId(existing: { id: string }[]): string {
  const taken = new Set(existing.map((order) => order.id));
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const id = `TRS-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!taken.has(id)) return id;
  }
  return `TRS-${Date.now().toString().slice(-6)}`;
}

export function statusSteps(fulfilment: Fulfilment): OrderStatus[] {
  return fulfilment === 'delivery'
    ? ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED']
    : ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED'];
}

export function statusCopy(status: OrderStatus, fulfilment: Fulfilment): { label: string; line: string } {
  const pickup = fulfilment === 'pickup';
  switch (status) {
    case 'NEW': return { label: 'Order received', line: 'Your order reached the café.' };
    case 'CONFIRMED': return { label: 'Confirmed', line: 'The kitchen has your ticket.' };
    case 'PREPARING': return { label: 'Preparing', line: 'Being made, not reheated.' };
    case 'READY': return pickup ? { label: 'Ready', line: 'Waiting at the counter for you.' } : { label: 'Ready', line: 'Packed and leaving the café.' };
    case 'OUT_FOR_DELIVERY': return { label: 'Out for delivery', line: 'On the way to you.' };
    case 'DELIVERED': return pickup ? { label: 'Collected', line: 'Enjoy every bite.' } : { label: 'Delivered', line: 'Enjoy every bite.' };
  }
}

/**
 * Prototype timeline. ASAP orders move on a compressed demo clock, so the whole
 * journey plays out in about two minutes. Scheduled orders follow real clock
 * times worked back from the chosen window.
 */
export function buildSchedule(createdAt: number, fulfilment: Fulfilment, slot: Order['slot'], prepMinutes: number): { schedule: Order['schedule']; demoTimeline: boolean } {
  const steps = statusSteps(fulfilment);
  if (slot.kind === 'asap') {
    const demoOffsets: Record<OrderStatus, number> = { NEW: 0, CONFIRMED: 3, PREPARING: 15, READY: 45, OUT_FOR_DELIVERY: 60, DELIVERED: 120 };
    if (fulfilment === 'pickup') demoOffsets.DELIVERED = 75;
    return { schedule: steps.map((status) => ({ status, at: createdAt + demoOffsets[status] * 1000 })), demoTimeline: true };
  }
  const minute = 60_000;
  const readyAt = slot.startsAt - (fulfilment === 'delivery' ? 30 : 0) * minute;
  const preparingAt = readyAt - (prepMinutes + 10) * minute;
  const real: Record<OrderStatus, number> = {
    NEW: createdAt,
    CONFIRMED: createdAt + 2 * minute,
    PREPARING: preparingAt,
    READY: readyAt,
    OUT_FOR_DELIVERY: readyAt + 3 * minute,
    DELIVERED: slot.startsAt + 30 * minute,
  };
  return { schedule: steps.map((status) => ({ status, at: Math.max(createdAt, real[status]) })), demoTimeline: false };
}

export function currentStatus(order: Order, now: number): OrderStatus {
  let status: OrderStatus = order.schedule[0].status;
  for (const step of order.schedule) if (step.at <= now) status = step.status;
  return status;
}

/** Development helper: makes the next step happen now. */
export function advanceOrder(order: Order, now: number): Order {
  const index = order.schedule.findIndex((step) => step.at > now);
  if (index === -1) return order;
  const shift = order.schedule[index].at - now;
  return { ...order, schedule: order.schedule.map((step, i) => (i >= index ? { ...step, at: step.at - shift } : step)) };
}

export function etaLabel(order: Order, now: number): string {
  const status = currentStatus(order, now);
  if (status === 'DELIVERED') return order.fulfilment === 'pickup' ? 'Collected' : 'Delivered';
  if (order.slot.kind === 'window') return order.slot.label.replace('Today · ', '').replace('Tomorrow · ', 'Tomorrow ');
  const lead = leadMinutes(order.prepMinutes, order.fulfilment);
  return `${lead - 5}–${lead + 5} min`;
}

export function toOrderItems(lines: PricedLine[]): OrderItem[] {
  return lines.map((line) => ({ slug: line.slug, name: line.product.name, size: line.size, unitPrice: line.unitPrice, qty: line.qty }));
}
