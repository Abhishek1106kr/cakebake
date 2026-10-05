// Event bus: validate → store (bounded) → notify. Invalid events are dropped and
// reported, never stored. Storage is pluggable so tests run in memory.

import { createEvent, validateEvent, type Actor, type EventType, type TresorEvent } from './schema';
import { isRecord, parseStored, recordsOnly } from '@/lib/safe-storage';

export type EventStore = { load(): TresorEvent[]; save(events: TresorEvent[]): void };

export function memoryStore(initial: TresorEvent[] = []): EventStore {
  let events = [...initial];
  return { load: () => events, save: (next) => { events = next; } };
}

/**
 * localStorage-backed store. Writes are debounced, but:
 * - pending writes are flushed when the page hides or unloads (events fired on the way
 *   out, like custom_cake_abandoned, used to be lost);
 * - saving merges with what other tabs stored (by event id) instead of overwriting it;
 * - another tab's writes are merged into this tab's view as they happen.
 */
export function browserStore(key = 'tresor-events', limit = 1000): EventStore {
  let cache: TresorEvent[] | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const readStored = (): TresorEvent[] => {
    try {
      return recordsOnly<TresorEvent>(parseStored(window.localStorage.getItem(key)),
        (e) => typeof e.id === 'string' && typeof e.type === 'string' && typeof e.timestamp === 'string' && isRecord(e.payload));
    } catch { return []; }
  };
  const merge = (a: TresorEvent[], b: TresorEvent[]) => {
    const byId = new Map<string, TresorEvent>();
    for (const e of [...a, ...b]) byId.set(e.id, e);
    return [...byId.values()].sort((x, y) => x.timestamp.localeCompare(y.timestamp)).slice(-limit);
  };
  const flush = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!cache) return;
    cache = merge(readStored(), cache);
    try { window.localStorage.setItem(key, JSON.stringify(cache)); } catch { /* storage full or blocked */ }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    window.addEventListener('storage', (e) => { if (e.key === key && cache) cache = merge(cache, readStored()); });
  }
  return {
    load() {
      if (!cache) cache = readStored();
      return cache;
    },
    save(next) {
      if (next.length === 0) {
        // An explicit clear: write it through instead of merging the old events back.
        cache = [];
        if (timer) { clearTimeout(timer); timer = null; }
        try { window.localStorage.setItem(key, '[]'); } catch { /* ignore */ }
        return;
      }
      cache = next;
      if (timer) return;
      timer = setTimeout(flush, 400);
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
