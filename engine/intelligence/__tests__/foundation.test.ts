import { beforeEach, describe, expect, it } from 'vitest';
import { clamp01, runOperation } from '../core/contract';
import { operationStats, recentOperations, resetObservability } from '../core/observability';
import { buildContext, deviceFor, networkFor, seasonFor, timeOfDayFor } from '../context/context';
import { createEvent, validateEvent } from '../events/schema';
import { createEventBus, memoryStore } from '../events/bus';
import { clearProviders, registerProvider, withFallback, type EmbeddingProvider } from '../providers/types';
import { cosine, embedText, localEmbedding } from '../providers/local-embedding';

const base = { provider: 'test', providerKind: 'deterministic' as const, modelVersion: null, rankingVersion: null, evidence: [], fallbackUsed: false, warnings: [] };

describe('contract and observability', () => {
  beforeEach(() => resetObservability());

  it('stamps latency and clamps confidence', () => {
    const r = runOperation('demo', () => ({ ...base, result: [1, 2, 3], confidence: 1.7 }));
    expect(r.operation).toBe('demo');
    expect(r.confidence).toBe(1);
    expect(r.latencyMs).toBeGreaterThanOrEqual(0);
    expect(r.cacheHit).toBe(false);
  });

  it('records every call, including the result count', () => {
    runOperation('demo', () => ({ ...base, result: [1, 2], confidence: 0.5 }));
    const [rec] = recentOperations(1, 'demo');
    expect(rec).toMatchObject({ operation: 'demo', resultCount: 2, confidence: 0.5, error: null, provider: 'test' });
  });

  it('records failures and rethrows', () => {
    expect(() => runOperation('boom', () => { throw new Error('nope'); })).toThrow('nope');
    expect(recentOperations(1, 'boom')[0].error).toBe('nope');
    expect(operationStats().boom.errorRate).toBe(1);
  });

  it('summarises latency percentiles and fallback rate', () => {
    for (let i = 0; i < 10; i += 1) runOperation('s', () => ({ ...base, result: null, confidence: 1, fallbackUsed: i % 2 === 0 }));
    const stats = operationStats().s;
    expect(stats.calls).toBe(10);
    expect(stats.fallbackRate).toBe(0.5);
    expect(stats.p95).toBeGreaterThanOrEqual(stats.p50);
  });

  it('clamps nonsense to 0–1', () => {
    expect(clamp01(NaN)).toBe(0);
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
  });
});

describe('context', () => {
  it('uses Bengaluru time for time of day and season', () => {
    expect(timeOfDayFor(new Date('2026-10-04T03:30:00Z'))).toBe('morning');   // 09:00 IST
    expect(timeOfDayFor(new Date('2026-10-04T13:30:00Z'))).toBe('evening');   // 19:00 IST
    expect(timeOfDayFor(new Date('2026-10-04T18:30:00Z'))).toBe('night');     // 00:00 IST
    expect(seasonFor(new Date('2026-04-15T06:00:00Z'))).toBe('summer');
    expect(seasonFor(new Date('2026-07-15T06:00:00Z'))).toBe('monsoon');
    expect(seasonFor(new Date('2026-10-15T06:00:00Z'))).toBe('post-monsoon');
    expect(seasonFor(new Date('2026-12-15T06:00:00Z'))).toBe('winter');
  });

  it('classifies device and network', () => {
    expect(deviceFor(390)).toBe('mobile');
    expect(deviceFor(900)).toBe('tablet');
    expect(deviceFor(1440)).toBe('desktop');
    expect(networkFor('2g')).toBe('slow');
    expect(networkFor('4g', true)).toBe('slow');
    expect(networkFor(undefined)).toBe('unknown');
  });

  it('fills a complete context from partial input', () => {
    const c = buildContext({ page: '/shop', at: new Date('2026-10-04T03:30:00Z') });
    expect(c).toMatchObject({ page: '/shop', sessionId: 'anonymous', timeOfDay: 'morning', device: 'desktop', cart: [], intent: null });
  });
});

describe('events', () => {
  it('accepts a valid event', () => {
    expect(validateEvent(createEvent('product_view', { productId: 'tresor-latte' }))).toEqual({ ok: true });
  });

  it('infers the actor from the event family', () => {
    expect(createEvent('product_view', { productId: 'x' }).actor).toBe('customer');
    expect(createEvent('inventory_updated', { ingredientId: 'milk', delta: 1, reason: 'Restock' }).actor).toBe('system');
    expect(createEvent('action_approved', { actionId: 'a' }).actor).toBe('admin');
  });

  it('rejects missing required payload and unknown types', () => {
    const missing = validateEvent(createEvent('order_created', { orderId: 'TRS-1' }));
    expect(missing.ok).toBe(false);
    expect(validateEvent({ ...createEvent('page_view', { path: '/' }), type: 'made_up' }).ok).toBe(false);
  });

  it('refuses personal data anywhere in the payload', () => {
    const v = validateEvent(createEvent('order_created', { orderId: 'TRS-1', total: 1, items: [], customer: { phone: '98450' } }));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors.join(' ')).toMatch(/payload\.customer\.phone/);
  });

  it('stores valid events, drops invalid ones, and keeps a bounded log', () => {
    const bus = createEventBus(memoryStore(), 3);
    const seen: string[] = [];
    bus.subscribe((e) => seen.push(e.type));
    for (let i = 0; i < 5; i += 1) bus.emit('page_view', { path: `/${i}` });
    expect(bus.emit('page_view', { email: 'x@y.z', path: '/' }).ok).toBe(false);
    expect(bus.query()).toHaveLength(3);
    expect(bus.query()[0].payload.path).toBe('/2');
    expect(seen).toHaveLength(5);
    expect(bus.rejected()).toHaveLength(1);
  });

  it('filters by type and time', () => {
    const bus = createEventBus(memoryStore());
    bus.emit('page_view', { path: '/' }, { at: new Date('2026-10-01T00:00:00Z') });
    bus.emit('product_view', { productId: 'x' }, { at: new Date('2026-10-03T00:00:00Z') });
    expect(bus.query({ type: 'product_view' })).toHaveLength(1);
    expect(bus.query({ since: '2026-10-02T00:00:00Z' })).toHaveLength(1);
  });
});

describe('providers', () => {
  const failing: EmbeddingProvider = { id: 'remote', kind: 'remote-model', version: '1', dimensions: 2, available: () => true, embed: () => { throw new Error('timeout'); } };
  const offline: EmbeddingProvider = { ...failing, id: 'offline', available: () => false };

  beforeEach(() => clearProviders('embedding'));

  it('falls back to the next provider and says so', () => {
    registerProvider('embedding', failing);
    registerProvider('embedding', localEmbedding);
    const out = withFallback('embedding', (p: EmbeddingProvider) => p.embed(['x']));
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.provider.id).toBe('local-hash');
      expect(out.fallbackUsed).toBe(true);
      expect(out.errors[0]).toMatch(/remote: timeout/);
    }
  });

  it('skips unavailable providers and respects priority', () => {
    registerProvider('embedding', localEmbedding);
    registerProvider('embedding', offline, 'first');
    const out = withFallback('embedding', (p: EmbeddingProvider) => p.id);
    expect(out.ok && out.value).toBe('local-hash');
  });

  it('reports failure when nothing is registered', () => {
    const out = withFallback('embedding', (p: EmbeddingProvider) => p.id);
    expect(out.ok).toBe(false);
  });
});

describe('local embedding', () => {
  it('is deterministic and unit length', () => {
    const a = embedText('pistachio praline');
    expect(a).toEqual(embedText('pistachio praline'));
    expect(Math.sqrt(a.reduce((s, x) => s + x * x, 0))).toBeCloseTo(1);
  });

  it('places related text closer than unrelated text', () => {
    const q = embedText('pistachios');
    expect(cosine(q, embedText('pistachio tart'))).toBeGreaterThan(cosine(q, embedText('truffle fries')));
  });

  it('returns a zero vector for empty text', () => {
    expect(embedText('').every((x) => x === 0)).toBe(true);
  });
});
