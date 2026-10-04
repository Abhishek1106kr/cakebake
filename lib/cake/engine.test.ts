import { describe, expect, it } from 'vitest';
import { applyMovement, initialInventory } from '@/lib/inventory';
import { printRules, rules, sizes } from './config';
import {
  decodeDesign, defaultConfig, designIdFor, encodeDesign, fitPlacement, hasErrors, messageFit, optionState, price, printCheck, productionHours,
  sanitize, slotsAfter, summary, validate, violations,
} from './engine';
import type { CakeConfiguration } from './types';

const base = (patch: Partial<CakeConfiguration> = {}): CakeConfiguration => ({ ...defaultConfig(), ...patch });

describe('defaults', () => {
  it('start valid and priced', () => {
    const c = defaultConfig();
    expect(validate(c)).toEqual([]);
    expect(price(c).total).toBe(sizes.find((s) => s.id === '6in')!.price);
    expect(productionHours(c)).toBe(24);
  });
});

describe('availability', () => {
  it('follows the season', () => {
    expect(optionState(base(), 'filling', 'mango', { month: 10 })).toEqual({ disabled: true, reason: 'In season March to June' });
    expect(optionState(base(), 'filling', 'mango', { month: 4 }).disabled).toBe(false);
  });

  it('follows real ingredient stock', () => {
    const empty = applyMovement(initialInventory, 'pistachio', -10);
    expect(optionState(base(), 'sponge', 'pistachio', { inventory: empty })).toEqual({ disabled: true, reason: 'Sold out for today' });
    expect(optionState(base(), 'sponge', 'pistachio', { inventory: initialInventory }).disabled).toBe(false);
  });

  it('turns unavailable choices into readable errors', () => {
    const issues = validate(base({ filling: 'mango' }), { month: 10 });
    expect(issues[0]).toMatchObject({ field: 'filling', level: 'error' });
    expect(issues[0].message).toMatch(/Alphonso mango: in season march to june/i);
  });
});

describe('compatibility rules (as data)', () => {
  it('blocks ruffles on whipped cream, in both directions', () => {
    expect(optionState(base({ frosting: 'whipped' }), 'finish', 'ruffled')).toEqual({ disabled: true, reason: 'Whipped cream is too soft to hold ruffles.' });
    expect(optionState(base({ finish: 'ruffled' }), 'frosting', 'whipped').disabled).toBe(true);
  });

  it('limits shapes by size', () => {
    expect(optionState(base({ size: '4in' }), 'shape', 'heart').reason).toMatch(/6 to 10 inch/);
    expect(optionState(base({ shape: 'rectangle' }), 'size', '6in').disabled).toBe(true);
    expect(optionState(base({ shape: 'rectangle', size: '8in' }), 'size', '10in').disabled).toBe(false);
  });

  it('needs a 6-inch, fully frosted top for photo prints', () => {
    expect(optionState(base({ size: '4in' }), 'print', 'print').reason).toMatch(/6-inch/);
    expect(optionState(base({ finish: 'semi-naked' }), 'print', 'print').reason).toMatch(/fully frosted/);
  });

  it('reports every violation in a configuration', () => {
    const bad = base({ size: '4in', shape: 'heart', topper: { id: 'name', text: 'Aanya' } });
    expect(violations(bad).map((r) => r.id).sort()).toEqual(['heart-sizes', 'small-no-topper']);
    expect(hasErrors(validate(bad))).toBe(true);
  });

  it('every rule refers to real options', () => {
    expect(rules.length).toBeGreaterThan(5);
    for (const r of rules) expect(r.reason.length).toBeGreaterThan(10);
  });
});

describe('pricing and production', () => {
  it('adds every choice to the total, line by line', () => {
    const c = base({ size: '8in', shape: 'heart', sponge: 'pistachio', frosting: 'ganache', toppings: [{ id: 'berries', qty: 3 }], decorations: ['gold-leaf'], print: { ...defaultConfig().print, enabled: true, assetId: 'a' } });
    const p = price(c);
    expect(p.total).toBe(2150 + 250 + 300 + 200 + 3 * 60 + 350 + printRules.price);
    expect(p.lines.find((l) => l.label === 'Fresh berries × 3')?.amount).toBe(180);
    expect(p.lines.reduce((s, l) => s + l.amount, 0)).toBe(p.total);
  });

  it('adds production time for slow choices', () => {
    const c = base({ size: '10in', sponge: 'pistachio', finish: 'ruffled', print: { ...defaultConfig().print, enabled: true, assetId: 'a' }, topper: { id: 'name', text: 'Aanya' } });
    expect(productionHours(c)).toBe(24 + 12 + 12 + 6 + 12 + 24);
  });

  it('never offers a slot before the cake can be ready', () => {
    const now = new Date('2026-10-04T09:30:00');
    const slots = slotsAfter(now, 24, 4);
    expect(slots).toHaveLength(4);
    expect(slots[0].start.getTime()).toBeGreaterThanOrEqual(now.getTime() + 24 * 3600000);
    expect(slots[0].label).toMatch(/10:00–12:00/); // ready 09:30 next day → first slot that morning
  });
});

describe('message', () => {
  it('enforces character and line limits per size', () => {
    const long = base({ size: '4in', message: { ...defaultConfig().message, text: 'Happy Birthday Aanyaaa!' } });
    expect(messageFit(long).overLength).toBe(true);
    expect(validate(long)[0].message).toBe('Your message is too long for a 4 inch cake. Try shortening it to 16 characters.');
    const lines = base({ size: '6in', message: { ...defaultConfig().message, text: 'a\nb\nc' } });
    expect(validate(lines)[0].message).toMatch(/fits 2 lines/);
  });

  it('warns when large text would run past the printable edge', () => {
    const wide = base({ size: '8in', message: { ...defaultConfig().message, text: 'Congratulations Aanya!', size: 0.16 } });
    expect(messageFit(wide).overflow).toBe(true);
    expect(validate(wide).find((i) => i.field === 'message')?.level).toBe('warning');
    const fine = base({ size: '8in', message: { ...defaultConfig().message, text: 'Happy Birthday', size: 0.09 } });
    expect(messageFit(fine).overflow).toBe(false);
  });
});

describe('edible print', () => {
  const withPrint = (p: Partial<CakeConfiguration['print']>, size = '8in') => base({ size, print: { ...defaultConfig().print, enabled: true, assetId: 'up-1', sourceWidth: 2000, sourceHeight: 2000, ...p } });

  it('requires a photo once enabled', () => {
    expect(validate(base({ print: { ...defaultConfig().print, enabled: true } }))[0].message).toMatch(/Upload a photo/);
  });

  it('knows when the photo leaves the printable area', () => {
    expect(printCheck(withPrint({ scale: 0.6 })).inside).toBe(true);
    expect(printCheck(withPrint({ scale: 0.6, x: 0.85 })).inside).toBe(false);
    expect(printCheck(withPrint({ scale: 0.6, rotation: 45 })).inside).toBe(true);
    expect(validate(withPrint({ scale: 1.2 })).some((i) => /outside the printable area/.test(i.message))).toBe(true);
  });

  it('warns about low-resolution photos', () => {
    expect(validate(withPrint({ sourceWidth: 400, sourceHeight: 400, scale: 0.7 }, '12in')).some((i) => /print soft/.test(i.message))).toBe(true);
  });
});

describe('identity, sharing, sanitising', () => {
  it('round-trips a design through a share code without the customer photo', () => {
    const c = base({ sponge: 'chocolate', message: { ...defaultConfig().message, text: 'Happy Birthday Aanya' }, print: { ...defaultConfig().print, enabled: true, assetId: 'private-upload' } });
    const decoded = decodeDesign(encodeDesign(c))!;
    expect(decoded.sponge).toBe('chocolate');
    expect(decoded.message.text).toBe('Happy Birthday Aanya');
    expect(decoded.print.assetId).toBeNull();
    expect(decoded.print.enabled).toBe(false);
  });

  it('gives the same design the same id', () => {
    expect(designIdFor(base())).toBe(designIdFor(base()));
    expect(designIdFor(base())).not.toBe(designIdFor(base({ sponge: 'coffee' })));
  });

  it('repairs anything it is handed', () => {
    const s = sanitize({ size: 'huge', sponge: 'chocolate', toppings: [{ id: 'berries', qty: 99 }, { id: 'nope', qty: 1 }], message: { size: 9, text: 'x'.repeat(200) } });
    expect(s.size).toBe('6in');
    expect(s.sponge).toBe('chocolate');
    expect(s.toppings).toEqual([{ id: 'berries', qty: 12 }]);
    expect(s.message.size).toBe(0.16);
    expect(s.message.text).toHaveLength(80);
    expect(decodeDesign('%%%garbage')).toBeNull();
  });

  it('summarises a design for the bag and the bakery', () => {
    const s = summary(base({ sponge: 'pistachio', message: { ...defaultConfig().message, text: 'Happy Birthday Aanya' } }));
    expect(s.title).toBe('Custom pistachio cake');
    expect(s.lines.join(' ')).toMatch(/Message: “Happy Birthday Aanya”/);
  });
});

describe('fit', () => {
  it('fits a photo wholly inside every printable outline', () => {
    for (const shape of ['round', 'square', 'heart', 'rectangle']) {
      for (const [w, h] of [[1600, 1200], [1200, 1600], [1000, 1000]]) {
        const c = base({ size: '8in', shape, print: { ...defaultConfig().print, enabled: true, assetId: 'a', sourceWidth: w, sourceHeight: h } });
        const fitted = { ...c, print: { ...c.print, ...fitPlacement(c) } };
        expect(fitPlacement(c).scale).toBeGreaterThan(0.3);
        expect(printCheck(fitted).inside, `${shape} ${w}×${h}`).toBe(true);
      }
    }
  });
});
