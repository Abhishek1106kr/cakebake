// Order status events: one stream that the admin produces and the tracking page
// and automations consume. The mock source below behaves like a future
// WebSocket / Server-Sent Events source; swapping it changes no UI code.

import type { Order } from '@/lib/orders';
import { canTransition, estimate, type TrackingStatus } from './status';

export type OrderStatusEvent = {
  eventId: string;
  orderId: string;
  previousStatus: TrackingStatus | null;
  currentStatus: TrackingStatus;
  timestamp: string;
  estimatedReadyAt: string | null;
  estimatedDeliveryAt: string | null;
  /** 'admin' (a person moved it), 'system', 'reconcile' (resynced after a gap), 'dev' (test controls). */
  source: 'admin' | 'system' | 'reconcile' | 'dev';
};

export type ConnectionState = 'CONNECTED' | 'RECONNECTING' | 'OFFLINE' | 'STALE';

/** The contract any real-time source implements (mock today; WebSocket/SSE later). */
export interface OrderEventSource {
  connect(orderId: string): void;
  disconnect(): void;
  subscribe(cb: (e: OrderStatusEvent) => void): () => void;
  onConnection(cb: (s: ConnectionState) => void): () => void;
  /** Latest authoritative state, used on connect and after a reconnect. */
  snapshot(orderId: string): Promise<Order | null>;
}

const CHANNEL = 'tresor-order-status';
const LOG_KEY = 'tresor-order-events';
const ORDERS_KEY = 'tresor-orders';

let seq = 0;
export function makeStatusEvent(order: Order, previous: TrackingStatus | null, current: TrackingStatus, source: OrderStatusEvent['source'], now = new Date()): OrderStatusEvent {
  const eta = estimate(order, current, now);
  return {
    eventId: `ose-${now.getTime().toString(36)}-${(seq += 1)}`, orderId: order.id, previousStatus: previous, currentStatus: current,
    timestamp: now.toISOString(), estimatedReadyAt: eta.readyAt, estimatedDeliveryAt: eta.deliveryAt, source,
  };
}

/** Publish a status change to every open tab (the "server push" of the mock). */
export function publishStatus(event: OrderStatusEvent) {
  if (typeof window === 'undefined') return;
  try {
    const log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]') as OrderStatusEvent[];
    localStorage.setItem(LOG_KEY, JSON.stringify([...log, event].slice(-500)));
  } catch { /* storage full */ }
  window.dispatchEvent(new CustomEvent(CHANNEL, { detail: event }));
  try { const bc = new BroadcastChannel(CHANNEL); bc.postMessage(event); bc.close(); } catch { /* no BroadcastChannel */ }
}

export function readStatusLog(orderId?: string): OrderStatusEvent[] {
  try {
    const log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]') as OrderStatusEvent[];
    return orderId ? log.filter((e) => e.orderId === orderId) : log;
  } catch { return []; }
}

/**
 * Mock real-time source. Listens to the in-tab event and the cross-tab channel,
 * reads snapshots from the browser's order store, and can simulate a dropped
 * connection (events during the gap are missed and reconciled on reconnect).
 */
export class MockOrderEventSource implements OrderEventSource {
  private orderId: string | null = null;
  private subs = new Set<(e: OrderStatusEvent) => void>();
  private conn = new Set<(s: ConnectionState) => void>();
  private state: ConnectionState = 'OFFLINE';
  private bc: BroadcastChannel | null = null;
  private dropped = false;
  private onWindow = (e: Event) => this.receive((e as CustomEvent<OrderStatusEvent>).detail);
  private onOffline = () => { this.dropped = true; this.setState('OFFLINE'); };
  private onOnline = () => void this.reconnect();

  connect(orderId: string) {
    this.orderId = orderId;
    window.addEventListener(CHANNEL, this.onWindow);
    window.addEventListener('offline', this.onOffline);
    window.addEventListener('online', this.onOnline);
    try { this.bc = new BroadcastChannel(CHANNEL); this.bc.onmessage = (m) => this.receive(m.data as OrderStatusEvent); } catch { this.bc = null; }
    this.setState(navigator.onLine === false ? 'OFFLINE' : 'CONNECTED');
  }

  disconnect() {
    window.removeEventListener(CHANNEL, this.onWindow);
    window.removeEventListener('offline', this.onOffline);
    window.removeEventListener('online', this.onOnline);
    this.bc?.close(); this.bc = null;
    this.orderId = null;
  }

  subscribe(cb: (e: OrderStatusEvent) => void) { this.subs.add(cb); return () => { this.subs.delete(cb); }; }
  onConnection(cb: (s: ConnectionState) => void) { this.conn.add(cb); cb(this.state); return () => { this.conn.delete(cb); }; }

  async snapshot(orderId: string): Promise<Order | null> {
    await new Promise((r) => setTimeout(r, 60)); // a network round trip, roughly
    try {
      const orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]') as Order[];
      const order = orders.find((o) => o.id === orderId) ?? null;
      return order;
    } catch { return null; }
  }

  /** Test hook: drop the connection for `ms`, missing any events meanwhile. */
  simulateDrop(ms = 4000) {
    this.dropped = true;
    this.setState('RECONNECTING');
    setTimeout(() => void this.reconnect(), ms);
  }

  private async reconnect() {
    if (!this.orderId) return;
    this.setState('RECONNECTING');
    const order = await this.snapshot(this.orderId);
    this.dropped = false;
    this.setState('CONNECTED');
    // Reconcile: one event for the net change, never a replay of each missed step.
    if (order && this.lastKnown && order.status !== this.lastKnown) {
      this.emit(makeStatusEvent(order, this.lastKnown, order.status, 'reconcile'));
    }
  }

  private lastKnown: TrackingStatus | null = null;
  /** The tracking provider tells the source what it last showed, for reconciliation. */
  setLastKnown(s: TrackingStatus) { this.lastKnown = s; }

  private receive(e: OrderStatusEvent) {
    if (!e || e.orderId !== this.orderId || this.dropped) return;
    this.emit(e);
  }

  private emit(e: OrderStatusEvent) {
    this.lastKnown = e.currentStatus;
    this.subs.forEach((cb) => cb(e));
  }

  private setState(s: ConnectionState) { this.state = s; this.conn.forEach((cb) => cb(s)); }
}

/** Accept an incoming event? Reconcile and dev events come from the authoritative store; others must be valid steps. */
export function acceptEvent(current: TrackingStatus | null, e: OrderStatusEvent): boolean {
  if (current === e.currentStatus) return false;
  if (e.source === 'reconcile' || e.source === 'dev') return true;
  return current === null || canTransition(current, e.currentStatus);
}
