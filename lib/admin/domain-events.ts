// Domain events the admin consumes. Today the source is the browser (same-tab
// CustomEvent + BroadcastChannel across tabs, with a short persisted log); later a
// WebSocket or Server-Sent Events source implements the same interface and no
// admin screen changes.
//
// Events carry ids, statuses and amounts, never customer details.

export const DOMAIN_EVENT_TYPES = [
  'order.created', 'order.status.changed', 'order.refunded',
  'inventory.changed',
  'invoice.generated', 'invoice.failed', 'invoice.regenerated',
  'notification.sent', 'notification.failed',
  'customCake.created', 'customCake.updated',
  'campaign.published',
  'catalog.changed', 'settings.changed',
] as const;
export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

export type DomainEvent = {
  id: string;
  type: DomainEventType;
  at: string;
  entityId: string;
  data: Record<string, string | number | boolean | null>;
};

export interface AdminEventSource {
  connect(): void;
  disconnect(): void;
  subscribe(listener: (e: DomainEvent) => void): () => void;
  /** Events since a time (for catching up after a reconnect or on page load). */
  since(iso: string): DomainEvent[];
}

const CHANNEL = 'tresor-domain-events';
const LOG_KEY = 'tresor-domain-log';
const LOG_LIMIT = 300;

let seq = 0;
export function makeDomainEvent(type: DomainEventType, entityId: string, data: DomainEvent['data'] = {}, now = new Date()): DomainEvent {
  return { id: `de-${now.getTime().toString(36)}-${(seq += 1).toString(36)}-${Math.random().toString(36).slice(2, 5)}`, type, at: now.toISOString(), entityId, data };
}

const readLog = (): DomainEvent[] => { try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch { return []; } };

/** Publish to this tab and every other open tab (the mock "server push"). Safe to call during SSR (no-op). */
export function publishDomain(event: DomainEvent) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(LOG_KEY, JSON.stringify([...readLog(), event].slice(-LOG_LIMIT))); } catch { /* storage full */ }
  window.dispatchEvent(new CustomEvent(CHANNEL, { detail: event }));
  try { const bc = new BroadcastChannel(CHANNEL); bc.postMessage(event); bc.close(); } catch { /* no BroadcastChannel */ }
}

export const emitDomain = (type: DomainEventType, entityId: string, data: DomainEvent['data'] = {}) => publishDomain(makeDomainEvent(type, entityId, data));

/** Browser implementation of the admin event source. De-duplicates by event id. */
export class BrowserAdminEventSource implements AdminEventSource {
  private listeners = new Set<(e: DomainEvent) => void>();
  private bc: BroadcastChannel | null = null;
  private seen = new Set<string>();
  private onWindow = (e: Event) => this.emit((e as CustomEvent<DomainEvent>).detail);

  connect() {
    window.addEventListener(CHANNEL, this.onWindow);
    try { this.bc = new BroadcastChannel(CHANNEL); this.bc.onmessage = (m) => this.emit(m.data as DomainEvent); } catch { this.bc = null; }
  }

  disconnect() {
    window.removeEventListener(CHANNEL, this.onWindow);
    this.bc?.close(); this.bc = null;
  }

  subscribe(listener: (e: DomainEvent) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }

  since(iso: string) { return readLog().filter((e) => e.at > iso); }

  private emit(e: DomainEvent) {
    if (!e?.id || this.seen.has(e.id)) return;
    this.seen.add(e.id);
    if (this.seen.size > 1000) this.seen = new Set([...this.seen].slice(-500));
    this.listeners.forEach((l) => l(e));
  }
}
