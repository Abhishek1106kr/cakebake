// Event bus: validate → store (bounded) → notify. Invalid events are dropped and
// reported, never stored. Storage is pluggable so tests run in memory.

import { createEvent, validateEvent, type Actor, type EventType, type TresorEvent } from './schema';

export type EventStore = { load(): TresorEvent[]; save(events: TresorEvent[]): void };

export function memoryStore(initial: TresorEvent[] = []): EventStore {
  let events = [...initial];
  return { load: () => events, save: (next) => { events = next; } };
}

export function browserStore(key = 'tresor-events'): EventStore {
  let cache: TresorEvent[] | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    load() {
      if (cache) return cache;
      try { cache = JSON.parse(window.localStorage.getItem(key) || '[]'); } catch { cache = []; }
      return cache!;
    },
    save(next) {
      cache = next;
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        try { window.localStorage.setItem(key, JSON.stringify(cache)); } catch {}
      }, 400);
    },
  };
}

export type EmitResult = { ok: true; event: TresorEvent } | { ok: false; errors: string[] };

export function createEventBus(store: EventStore, limit = 1000) {
  const listeners = new Set<(e: TresorEvent) => void>();
  const rejected: { at: string; type: string; errors: string[] }[] = [];

  function emit(type: EventType, payload: Record<string, unknown>, opts: { actor?: Actor; sessionId?: string | null; customerId?: string | null; source?: string; at?: Date } = {}): EmitResult {
    const event = createEvent(type, payload, opts);
    return ingest(event);
  }

  /** Accepts an already-built event (e.g. from another tab or a future server). */
  function ingest(event: unknown): EmitResult {
    const check = validateEvent(event);
    if (!check.ok) {
      rejected.push({ at: new Date().toISOString(), type: String((event as { type?: string })?.type), errors: check.errors });
      if (rejected.length > 50) rejected.shift();
      return { ok: false, errors: check.errors };
    }
    const e = event as TresorEvent;
    const all = [...store.load(), e];
    store.save(all.length > limit ? all.slice(all.length - limit) : all);
    listeners.forEach((l) => l(e));
    return { ok: true, event: e };
  }

  function query(filter: { type?: EventType | EventType[]; since?: string; until?: string; sessionId?: string } = {}): TresorEvent[] {
    const types = filter.type ? (Array.isArray(filter.type) ? filter.type : [filter.type]) : null;
    return store.load().filter((e) =>
      (!types || types.includes(e.type)) &&
      (!filter.since || e.timestamp >= filter.since) &&
      (!filter.until || e.timestamp <= filter.until) &&
      (!filter.sessionId || e.sessionId === filter.sessionId));
  }

  return {
    emit,
    ingest,
    query,
    subscribe(listener: (e: TresorEvent) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    rejected: () => [...rejected],
    clear: () => store.save([]),
  };
}

export type EventBus = ReturnType<typeof createEventBus>;

let shared: EventBus | null = null;
/** App-wide bus: browser storage in the browser, memory elsewhere. */
export function eventBus(): EventBus {
  if (!shared) shared = createEventBus(typeof window !== 'undefined' ? browserStore() : memoryStore());
  return shared;
}
