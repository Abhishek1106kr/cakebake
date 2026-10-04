import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserStore, createEventBus } from '../events/bus';

// A minimal browser: shared localStorage (like two tabs of one site), window/document events.
type Listener = (e: unknown) => void;
function fakeBrowser() {
  const data = new Map<string, string>();
  const listeners: Record<string, Listener[]> = {};
  const on = (t: string, l: Listener) => { (listeners[t] ??= []).push(l); };
  const fire = (t: string, e: unknown = {}) => (listeners[t] ?? []).forEach((l) => l(e));
  const g = globalThis as Record<string, unknown>;
  g.window = { localStorage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) }, addEventListener: on };
  g.document = { visibilityState: 'visible', addEventListener: on };
  return { data, fire };
}

describe('browser event store', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); delete (globalThis as Record<string, unknown>).window; delete (globalThis as Record<string, unknown>).document; });

  it('flushes pending events when the page hides (nothing lost on the way out)', () => {
    const b = fakeBrowser();
    const bus = createEventBus(browserStore('k'));
    bus.emit('custom_cake_abandoned', { lastGroup: 'print' });
    expect(b.data.get('k')).toBeUndefined(); // still debounced
    b.fire('pagehide');
    expect(JSON.parse(b.data.get('k')!).map((e: { type: string }) => e.type)).toEqual(['custom_cake_abandoned']);
  });

  it('merges with events another tab stored instead of overwriting them', () => {
    const b = fakeBrowser();
    const tabA = createEventBus(browserStore('k'));
    const tabB = createEventBus(browserStore('k'));
    tabA.emit('page_view', { path: '/a' });
    tabB.emit('page_view', { path: '/b' });
    vi.advanceTimersByTime(500);
    const stored = JSON.parse(b.data.get('k')!).map((e: { payload: { path: string } }) => e.payload.path).sort();
    expect(stored).toEqual(['/a', '/b']);
  });

  it('picks up another tab’s events as they are written', () => {
    const b = fakeBrowser();
    const tabA = createEventBus(browserStore('k'));
    tabA.query(); // load
    const tabB = createEventBus(browserStore('k'));
    tabB.emit('order_created', { orderId: 'TRS-1', total: 1, items: [] });
    vi.advanceTimersByTime(500);
    b.fire('storage', { key: 'k' });
    expect(tabA.query().map((e) => e.type)).toContain('order_created');
  });

  it('a deliberate clear stays cleared', () => {
    const b = fakeBrowser();
    const bus = createEventBus(browserStore('k'));
    bus.emit('page_view', { path: '/' });
    vi.advanceTimersByTime(500);
    bus.clear();
    vi.advanceTimersByTime(500);
    expect(JSON.parse(b.data.get('k')!)).toEqual([]);
  });
});
