import { describe, expect, it } from 'vitest';
import { applyMovement, initialInventory } from '@/lib/inventory';
import { defaultConfig, find, hasErrors, price, validate, violations } from '@/lib/cake/engine';
import type { CakeConfiguration } from '@/lib/cake/types';
import { applyPatches, applyStyle, comboCounts, STYLES, suggest, surprise } from '../cake/designer';

const base = (patch: Partial<CakeConfiguration> = {}): CakeConfiguration => ({ ...defaultConfig(), ...patch });

describe('pairing suggestions', () => {
  it('suggests a dark chocolate finish for chocolate and hazelnut', () => {
    const r = suggest(base({ sponge: 'chocolate', filling: 'hazelnut' }));
    expect(r.result[0]).toMatchObject({ id: 'choc-hazelnut-ganache', line: 'These pair well with a dark chocolate finish.' });
    expect(r.result.map((s) => s.id)).toContain('hazelnut-topping');
  });

  it('never suggests something the cake cannot take', () => {
    const noPistachio = applyMovement(initialInventory, 'pistachio', -10);
    const r = suggest(base({ sponge: 'pistachio' }), { ctx: { inventory: noPistachio } });
    expect(r.result.map((s) => s.id)).not.toContain('pistachio-topping');
    // Ganache frosting rules out the drip, so a suggestion that adds one would be filtered too.
    for (const s of suggest(base({ sponge: 'chocolate', filling: 'hazelnut' }), { limit: 10 }).result) {
      expect(violations(applyPatches(base({ sponge: 'chocolate', filling: 'hazelnut' }), s.patches))).toEqual([]);
    }
  });

  it('respects dismissals and the limit', () => {
    const c = base({ sponge: 'chocolate', filling: 'hazelnut' });
    expect(suggest(c, { dismissed: ['choc-hazelnut-ganache'] }).result[0].id).toBe('hazelnut-topping');
    expect(suggest(c, { limit: 1 }).result).toHaveLength(1);
  });

  it('learns pairings from real custom cake orders', () => {
    const order = (filling: string) => ({ status: 'DELIVERED', items: [{ custom: { config: base({ sponge: 'coffee', filling }) } }] });
    const orders = [order('ganache'), order('ganache'), order('berry')];
    expect(comboCounts(orders).get('coffee+ganache')).toBe(2);
    const r = suggest(base({ sponge: 'coffee', filling: 'salted-caramel' }), { orders, limit: 5 });
    const popular = r.result.find((s) => s.id === 'popular-filling');
    expect(popular?.line).toMatch(/chocolate ganache/);
    expect(popular?.evidence[0]).toMatchObject({ kind: 'metric', value: 2 });
  });

  it('reacts to the message', () => {
    expect(suggest(base({ message: { ...defaultConfig().message, text: 'Happy Birthday Aanya' } })).result.map((s) => s.id)).toContain('birthday-candles');
  });
});

describe('style presets', () => {
  it('every preset uses only real options', () => {
    for (const s of STYLES) {
      for (const p of s.patches) {
        if (p.op === 'set') expect(find(p.group as 'color', p.id), `${s.id}:${p.id}`).toBeDefined();
        if (p.op === 'add-topping') expect(find('toppings', p.id), `${s.id}:${p.id}`).toBeDefined();
        if (p.op === 'add-decoration') expect(find('decorations', p.id), `${s.id}:${p.id}`).toBeDefined();
      }
    }
  });

  it('applies a style and leaves a valid cake', () => {
    const { config } = applyStyle(base({ size: '8in' }), 'elegant');
    expect(config.color).toBe('cream');
    expect(config.decorations).toContain('piped-border');
    expect(config.message.font).toBe('serif');
    expect(violations(config)).toEqual([]);
  });

  it('skips what the cake cannot take, and says why', () => {
    const { config, skipped } = applyStyle(base({ frosting: 'whipped' }), 'anniversary');
    expect(config.finish).not.toBe('ruffled');
    expect(skipped).toContain('Whipped cream is too soft to hold ruffles.');
  });
});

describe('surprise me', () => {
  it('builds an elegant cake under a budget, from plain words', () => {
    const r = surprise(base({ size: '8in' }), { text: 'something elegant under ₹3000', seed: 42 });
    expect(r.result).not.toBeNull();
    expect(r.result!.total).toBeLessThanOrEqual(3000);
    expect(r.result!.style).toBe('elegant');
    expect(hasErrors(validate(r.result!.config).filter((i) => i.field !== 'topper'))).toBe(false);
  });

  it('keeps nuts out when asked', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const r = surprise(base(), { text: 'birthday cake without nuts', seed });
      const c = r.result!.config;
      const allergens = [find('sponge', c.sponge), find('filling', c.filling), ...c.toppings.map((t) => find('toppings', t.id))].flatMap((o) => o?.allergens ?? []);
      expect(allergens, `seed ${seed}`).not.toContain('nuts');
    }
  });

  it('is reproducible by seed and varies between seeds', () => {
    const a = surprise(base(), { style: 'festive', seed: 7 }).result!.config;
    const b = surprise(base(), { style: 'festive', seed: 7 }).result!.config;
    expect(a).toEqual(b);
    const many = new Set([1, 2, 3, 4, 5, 6].map((seed) => JSON.stringify(surprise(base(), { style: 'festive', seed }).result!.config)));
    expect(many.size).toBeGreaterThan(1);
  });

  it('keeps the customer’s message', () => {
    const r = surprise(base({ message: { ...defaultConfig().message, text: 'Happy 30th' } }), { style: 'birthday', seed: 3 });
    expect(r.result!.config.message.text).toBe('Happy 30th');
  });

  it('refuses an impossible budget honestly instead of inventing a cake', () => {
    const r = surprise(base(), { budget: 500, seed: 1 });
    expect(r.result).toBeNull();
    expect(r.warnings[0]).toMatch(/smallest cake starts at ₹950/);
    expect(price(base({ size: '4in' })).total).toBe(950);
  });
});

describe('cake analytics', () => {
  it('builds the playground funnel and popular choices from events', async () => {
    const { createEvent } = await import('../events/schema');
    const { cakeAnalytics } = await import('../analytics/metrics');
    const ev = (type: Parameters<typeof createEvent>[0], payload: Record<string, unknown>, s: string) => createEvent(type, payload, { sessionId: s });
    const stats = cakeAnalytics([
      ev('customizer_opened', {}, 'a'), ev('customizer_opened', {}, 'b'),
      ev('cake_started', {}, 'a'), ev('option_selected', { group: 'sponge', optionId: 'chocolate' }, 'a'), ev('option_selected', { group: 'sponge', optionId: 'chocolate' }, 'b'),
      ev('custom_cake_added_to_cart', { designId: 'TC-1', total: 2000, size: '8in', sponge: 'chocolate', messageLength: 14, hasPrint: false }, 'a'),
      ev('custom_cake_abandoned', { lastGroup: 'print' }, 'b'),
    ]);
    expect(stats).toMatchObject({ opened: 2, started: 1, added: 1, conversion: 0.5, withMessage: 1, withPrint: 0 });
    expect(stats.popular[0]).toEqual({ group: 'sponge', optionId: 'chocolate', count: 2 });
    expect(stats.abandonedAt).toEqual([{ group: 'print', count: 1 }]);
  });
});
