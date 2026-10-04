import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { products } from '@/lib/data';
import { ensureDefaultProviders, search } from '../index';
import { parseIntent, interpret, normalizeQuery } from '../intent/intent';
import { signalsFor } from '../product/signals';
import { allowedEdits, correct, levenshtein } from '../search/fuzzy';
import { dominantComponent, rank, scoreOf, WEIGHTS } from '../ranking/ranking';
import { reasonLine } from '../explanations/explain';
import { recentOperations, resetObservability } from '../core/observability';
import { clearProviders } from '../providers/types';

const byId = (id: string) => products.find((p) => p.id === id)!;
const names = (q: string, opts = {}) => search(q, { products, ...opts }).result.hits.map((h) => h.product.id);

describe('product signals', () => {
  it('derives warmth, flavour and sweetness for a croissant', () => {
    const s = signalsFor(byId('almond-croissant'));
    expect(s).toMatchObject({ temperature: 'warm', sweetness: 2, containsNuts: true, wholeCake: false, leadTime: 'today', priceBand: 'budget' });
    expect(s.flavours).toContain('nutty');
    expect(s.moments).toContain('breakfast');
  });

  it('knows cold brew is cold and caffeinated', () => {
    const s = signalsFor(byId('cold-brew'));
    expect(s).toMatchObject({ temperature: 'cold', caffeine: true });
    expect(s.moments).toContain('pick-me-up');
  });

  it('reads whole-cake details from the bakery data', () => {
    const s = signalsFor(byId('rose-chocolate-truffle'));
    expect(s).toMatchObject({ wholeCake: true, serves: 10, leadTime: '24h', sweetness: 3, priceBand: 'premium', containsNuts: true });
    expect(s.occasions).toEqual(['anniversary', 'celebration']);
    expect(s.sources.sweetness).toMatch(/3\/5/);
  });

  it('treats savoury food as not sweet', () => {
    expect(signalsFor(byId('truffle-fries'))).toMatchObject({ sweetness: 1, temperature: 'warm' });
    expect(signalsFor(byId('truffle-fries')).flavours).toContain('savoury');
  });
});

describe('fuzzy matching', () => {
  it('measures edits, counting a swap as one', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('chcoolate', 'chocolate')).toBe(1);
    expect(levenshtein('abc', 'abcdefgh', 2)).toBe(3);
  });

  it('never corrects short words', () => {
    expect(allowedEdits(3)).toBe(0);
    expect(correct('tea', ['ten', 'tee'])).toBeNull();
  });

  it('corrects to the closest known word', () => {
    expect(correct('pistachoi', ['pistachio', 'pastry'])?.to).toBe('pistachio');
    expect(correct('croissant', ['croissant'])).toBeNull();
    expect(correct('zzzzzz', ['pistachio'])).toBeNull();
  });
});

describe('intent', () => {
  it('understands the signature query', () => {
    const i = parseIntent('Something warm, nutty and NOT too sweet');
    expect(i).toMatchObject({ temperature: 'warm', flavours: ['nutty'], sweetness: { max: 2 }, unknownTerms: [], confidence: 1 });
    expect(i.interpretation).toBe('Looking for something warm, nutty and not too sweet');
    expect(i.evidence.map((e) => e.label)).toEqual(expect.arrayContaining(['Not too sweet', 'Warm', 'Flavour']));
  });

  it('handles negation without confusing it for a wish', () => {
    const i = parseIntent('chocolate cake without nuts, no caffeine');
    expect(i.excludeNuts).toBe(true);
    expect(i.caffeine).toBe(false);
    expect(i.flavours).toEqual(['chocolate']);
    expect(i.categories).toEqual(['Cake']);
    expect(parseIntent('no chocolate please').excludeFlavours).toEqual(['chocolate']);
  });

  it('reads budget, group size and urgency', () => {
    const i = parseIntent('birthday cake for 8 under ₹2000 today');
    expect(i).toMatchObject({ priceMax: 2000, serves: 8, needToday: true, occasions: ['birthday'] });
    expect(i.interpretation).toBe('Looking for a cake for a birthday, to serve 8, under ₹2000, ready today');
  });

  it('keeps specific ingredients specific', () => {
    const i = parseIntent('mango');
    expect(i.ingredients).toEqual(['mango']);
    expect(i.flavours).toEqual([]);
    expect(i.interpretation).toBe('Looking for something with mango');
  });

  it('treats "drink" as coffee or other drinks', () => {
    expect(parseIntent('a cold drink').categories).toEqual(['Drinks', 'Coffee']);
    expect(parseIntent('a cold drink').interpretation).toBe('Looking for a cold drink');
  });

  it('reports words it could not place', () => {
    const i = parseIntent('eggless gluten free', { categories: new Set(), vocabulary: new Set(['cake']) });
    expect(i.unknownTerms).toEqual(['eggless', 'gluten']);
    expect(i.interpretation).toBeNull();
    expect(i.confidence).toBeLessThan(0.5);
  });

  it('normalises spelling and punctuation', () => {
    expect(normalizeQuery('Savory, choco-cakes!!')).toBe('savoury chocolate cake');
    expect(interpret(parseIntent(''))).toBeNull();
  });
});

describe('ranking', () => {
  it('weights sum to one', () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('is reproducible from its components', () => {
    const c = { text: 1, semantic: 0, attributes: 1, popularity: 0, availability: 1 };
    expect(scoreOf(c)).toBeCloseTo(WEIGHTS.text + WEIGHTS.attributes + WEIGHTS.availability);
    expect(dominantComponent(c)).toBe('attributes');
  });

  it('breaks ties by popularity, then name', () => {
    const zero = { text: 0, semantic: 0, attributes: 0, availability: 0 };
    const out = rank([
      { item: 1, id: 'b', name: 'B', score: 0.5, components: { ...zero, popularity: 0 } },
      { item: 2, id: 'a', name: 'A', score: 0.5, components: { ...zero, popularity: 0 } },
      { item: 3, id: 'c', name: 'C', score: 0.5, components: { ...zero, popularity: 1 } },
    ]);
    expect(out.map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });

  it('builds short reason lines', () => {
    expect(reasonLine(['nutty', 'served warm', 'nutty', 'x', 'y'])).toBe('Nutty · served warm · x');
    expect(reasonLine([])).toBeNull();
  });
});

describe('search pipeline', () => {
  beforeEach(() => resetObservability());

  it('answers the signature query with the almond croissant first', () => {
    const r = search('something warm, nutty and not too sweet', { products });
    expect(r.result.hits[0].product.id).toBe('almond-croissant');
    expect(r.result.hits[0].reason).toMatch(/Nutty/);
    expect(r.result.interpretation).toBe('Looking for something warm, nutty and not too sweet');
    expect(r.rankingVersion).toBe('rank-v1');
    expect(r.fallbackUsed).toBe(false);
  });

  it('finds the obvious answers', () => {
    expect(names('a cold coffee')[0]).toBe('cold-brew');
    expect(names('nutty pastry')).toEqual(['almond-croissant']);
    expect(names('chocolate brownie')[0]).toBe('chocolate-brownie');
    expect(names('light and refreshing')[0]).toBe('citrus-tea');
    expect(names('mango')).toEqual(['mango-passion']);
  });

  it('corrects typos and says what it read', () => {
    const r = search('pistachoi', { products });
    expect(r.result.corrections).toEqual([{ from: 'pistachoi', to: 'pistachio', distance: 1 }]);
    expect(r.result.hits.map((h) => h.product.id).slice(0, 2).sort()).toEqual(['pistachio-cake', 'pistachio-tart']);
    expect(r.evidence.some((e) => e.label === 'Read as')).toBe(true);
  });

  it('never returns anything that breaks an exclusion', () => {
    for (const id of names('chocolate cake without nuts')) expect(signalsFor(byId(id)).containsNuts).toBe(false);
    for (const id of names('no caffeine')) expect(signalsFor(byId(id)).caffeine).toBe(false);
  });

  it('never surfaces what the kitchen cannot make', () => {
    const r = search('something chocolatey', { products, availability: (p) => (p.id === 'chocolate-brownie' ? 0 : 10) });
    expect(r.result.hits.map((h) => h.product.id)).not.toContain('chocolate-brownie');
    expect(r.result.excludedUnavailable).toBe(1);
  });

  it('respects budget, group size and urgency', () => {
    expect(names('cake under 300')).toEqual(['pistachio-tart']);
    for (const id of names('birthday cake for 8')) expect(signalsFor(byId(id)).serves).toBeGreaterThanOrEqual(8);
    for (const id of names('cake today')) expect(signalsFor(byId(id)).leadTime).toBe('today');
  });

  it('relaxes a constraint rather than returning nothing, and says which', () => {
    const r = search('pastry under 100', { products });
    expect(r.result.relaxed).toEqual(['under ₹100']);
    expect(r.result.hits.every((h) => h.product.category === 'Pastry')).toBe(true);
    expect(r.fallbackUsed).toBe(true);
    expect(r.confidence).toBeLessThan(0.7);
  });

  it('falls back to popular items for queries it cannot answer, keeping exclusions', () => {
    const r = search('eggless gluten free', { products });
    expect(r.result.relaxed).toContain('everything');
    expect(r.result.hits.length).toBeGreaterThan(0);
    expect(r.confidence).toBeLessThanOrEqual(0.1);
    expect(r.warnings.join(' ')).toMatch(/eggless/);
    const decaf = search('decaf drink', { products });
    expect(decaf.result.hits.every((h) => !signalsFor(h.product).caffeine)).toBe(true);
  });

  it('returns popular items for an empty query', () => {
    const r = search('   ', { products, popularity: { 'citrus-tea': 50 } });
    expect(r.result.hits).toHaveLength(products.length);
    expect(r.result.interpretation).toBeNull();
    expect(r.confidence).toBe(1);
  });

  it('lets popularity break ties between equally good answers', () => {
    const plain = names('something for brunch');
    const boosted = names('something for brunch', { popularity: { 'pain-au-chocolat': 40 } });
    expect(boosted.indexOf('pain-au-chocolat')).toBeLessThan(plain.indexOf('pain-au-chocolat'));
  });

  it('is recorded in the observability log', () => {
    search('a cold coffee', { products });
    const [rec] = recentOperations(1, 'search');
    expect(rec).toMatchObject({ operation: 'search', rankingVersion: 'rank-v1', provider: 'local-hash', error: null });
    expect(rec.resultCount).toBeGreaterThan(0);
  });

  describe('without any embedding provider', () => {
    beforeEach(() => clearProviders('embedding'));
    afterEach(() => ensureDefaultProviders());

    it('still works on rules alone and says so', () => {
      const r = search('something warm, nutty and not too sweet', { products: [...products] });
      expect(r.result.hits[0].product.id).toBe('almond-croissant');
      expect(r.provider).toBe('rules');
      expect(r.warnings.join(' ')).toMatch(/no vectors/);
    });
  });
});
