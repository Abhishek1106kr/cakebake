// Hybrid search pipeline:
// normalise → correct typos → intent → hard filters (availability, exclusions,
// budget, category…) → text match → vector similarity → attribute match →
// popularity/availability → ranking → explanation, with a relaxed fallback.
// Search can never surface something that can't be made right now.

import type { Product } from '@/lib/data';
import { runOperation, type Evidence, type IntelligenceResult } from '../core/contract';
import { LEXICON, parseIntent, type SearchIntent } from '../intent/intent';
import { productIndex, type IndexEntry, type ProductIndex } from '../product/index';
import { cosine, tokenize } from '../providers/local-embedding';
import { withFallback, type EmbeddingProvider } from '../providers/types';
import { rank, RANKING_VERSION, scoreOf, type Ranked, type RankingComponents } from '../ranking/ranking';
import { reasonLine } from '../explanations/explain';
import { correct, type Correction } from './fuzzy';

export type SearchOptions = {
  products: Product[];
  /** Units that can be made now (from inventory). Defaults to "plenty". */
  availability?: (p: Product) => number;
  /** Recent units sold per product id. */
  popularity?: Record<string, number>;
  limit?: number;
};

export type SearchHit = {
  product: Product;
  score: number;
  components: RankingComponents;
  /** Short customer-facing reasons, e.g. ["nutty", "warm from the oven"]. */
  reasons: string[];
  reason: string | null;
};

export type SearchResult = {
  query: string;
  intent: SearchIntent;
  corrections: Correction[];
  hits: SearchHit[];
  /** Constraints dropped to find anything, in plain words. */
  relaxed: string[];
  excludedUnavailable: number;
  interpretation: string | null;
};

const STOP = new Set('a an the i me my something anything some any want need like for and or with of to in on is it that this please looking show give get just really very bit little too not no without free less'.split(' '));

type Wish = { label: string; score: (e: IndexEntry) => number; reason: (e: IndexEntry) => string };

function wishesFor(intent: SearchIntent): Wish[] {
  const wishes: Wish[] = [];
  for (const ing of intent.ingredients) wishes.push({ label: ing, score: (e) => (e.fields.body.has(ing) || e.fields.body.has(`${ing}s`) ? 1 : 0), reason: () => `made with ${ing}` });
  for (const f of intent.flavours) wishes.push({ label: f, score: (e) => (e.signals.flavours.includes(f) ? 1 : 0), reason: () => (f === 'chocolate' ? 'chocolatey' : f) });
  if (intent.temperature === 'warm') wishes.push({ label: 'warm', score: (e) => ({ hot: 1, warm: 1, ambient: 0.3, chilled: 0, cold: 0 })[e.signals.temperature], reason: (e) => e.signals.sources.temperature ?? 'warm' });
  if (intent.temperature === 'cold') wishes.push({ label: 'cold', score: (e) => ({ cold: 1, chilled: 0.8, ambient: 0.2, warm: 0, hot: 0 })[e.signals.temperature], reason: (e) => e.signals.sources.temperature ?? 'cold' });
  const { max, min } = intent.sweetness ?? {};
  if (max) wishes.push({ label: 'not too sweet', score: (e) => (e.signals.sweetness <= max ? 1 : e.signals.sweetness === max + 1 ? 0.4 : 0), reason: (e) => (e.signals.sweetness <= 1 ? 'not sweet at all' : 'not too sweet') });
  if (min) wishes.push({ label: 'sweet', score: (e) => (e.signals.sweetness >= min ? 1 : e.signals.sweetness === min - 1 ? 0.4 : 0), reason: () => 'properly sweet' });
  if (intent.richness) { const r = intent.richness; wishes.push({ label: r, score: (e) => (e.signals.richness === r ? 1 : e.signals.richness === 'medium' ? 0.4 : 0), reason: () => r }); }
  if (intent.caffeine === true) wishes.push({ label: 'caffeine', score: (e) => (e.signals.caffeine ? 1 : 0), reason: () => 'a proper pick-me-up' });
  if (intent.moments.length) wishes.push({ label: intent.moments.join('/'), score: (e) => (intent.moments.some((m) => e.signals.moments.includes(m)) ? 1 : 0), reason: () => `good for ${intent.moments[0] === 'pick-me-up' ? 'a pick-me-up' : intent.moments[0]}` });
  if (intent.occasions.length) wishes.push({ label: intent.occasions.join('/'), score: (e) => (intent.occasions.some((o) => e.signals.occasions.includes(o)) ? 1 : e.signals.wholeCake ? 0.5 : 0), reason: () => `made for ${intent.occasions[0] === 'birthday' ? 'birthdays' : intent.occasions[0] === 'anniversary' ? 'anniversaries' : `a ${intent.occasions[0]}`}` });
  return wishes;
}

type Gate = { key: string; label: string; relaxable: boolean; pass: (e: IndexEntry) => boolean };

function gatesFor(intent: SearchIntent): Gate[] {
  const gates: Gate[] = [];
  if (intent.excludeNuts) gates.push({ key: 'nuts', label: 'no nuts', relaxable: false, pass: (e) => !e.signals.containsNuts });
  for (const f of intent.excludeFlavours) gates.push({ key: `no-${f}`, label: `no ${f}`, relaxable: false, pass: (e) => !e.signals.flavours.includes(f) });
  if (intent.caffeine === false) gates.push({ key: 'decaf', label: 'no caffeine', relaxable: false, pass: (e) => !e.signals.caffeine });
  if (intent.priceMax) { const max = intent.priceMax; gates.push({ key: 'price', label: `under ₹${max}`, relaxable: true, pass: (e) => e.product.price <= max }); }
  if (intent.serves && intent.serves >= 4) { const n = intent.serves; gates.push({ key: 'serves', label: `serves ${n}`, relaxable: true, pass: (e) => e.signals.wholeCake && e.signals.serves >= n }); }
  if (intent.needToday) gates.push({ key: 'today', label: 'ready today', relaxable: true, pass: (e) => e.signals.leadTime === 'today' });
  if (intent.categories.length) gates.push({ key: 'category', label: intent.categories.join(' or ').toLowerCase(), relaxable: true, pass: (e) => intent.categories.includes(e.product.category) });
  return gates;
}

function textScore(tokens: string[], e: IndexEntry): { score: number; matched: string[] } {
  if (!tokens.length) return { score: 0, matched: [] };
  let total = 0;
  const matched: string[] = [];
  for (const t of tokens) {
    let s = 0;
    if (e.fields.name.has(t)) s = 1;
    else if (e.fields.terms.has(t)) s = 0.7;
    else if (e.fields.body.has(t)) s = 0.4;
    else if (t.length >= 4 && [...e.fields.name, ...e.fields.terms].some((w) => w.startsWith(t))) s = 0.5;
    if (s > 0) matched.push(t);
    total += s;
  }
  return { score: total / tokens.length, matched };
}

function queryVector(index: ProductIndex, text: string): number[] | null {
  if (!index.embedding || !text) return null;
  const out = withFallback('embedding', (p: EmbeddingProvider) => (p.id === index.embedding!.provider ? p.embed([text])[0] : null));
  return out.ok ? out.value : null;
}

function evaluate(index: ProductIndex, intent: SearchIntent, contentTokens: string[], qVec: number[] | null, gates: Gate[], opts: Required<Pick<SearchOptions, 'availability' | 'popularity'>>) {
  const wishes = wishesFor(intent);
  const maxSold = Math.max(1, ...Object.values(opts.popularity));
  const ranked: Ranked<SearchHit>[] = [];
  let excludedUnavailable = 0;
  for (const e of index.entries) {
    const units = opts.availability(e.product);
    if (units <= 0) { excludedUnavailable += 1; continue; }
    if (!gates.every((g) => g.pass(e))) continue;
    const text = textScore(contentTokens, e);
    const semantic = qVec && e.vector ? Math.max(0, cosine(qVec, e.vector)) : 0;
    const wishScores = wishes.map((w) => w.score(e));
    const attributes = wishes.length ? wishScores.reduce((a, b) => a + b, 0) / wishes.length : 0;
    // Relevance gate: it must actually answer the query.
    const relevant = wishes.length ? attributes >= 0.5 || text.score >= 0.6 : text.score > 0 || semantic >= 0.45 || (intent.categories.length > 0 && contentTokens.length === 0);
    if (!relevant) continue;
    const popularity = (e.product.featured ? 0.5 : 0) + 0.5 * ((opts.popularity[e.product.id] ?? 0) / maxSold);
    const availability = e.signals.leadTime === '24h' ? 0.5 : units >= 5 ? 1 : 0.7;
    const components: RankingComponents = { text: text.score, semantic, attributes, popularity, availability };
    const reasons = [
      ...wishes.flatMap((w, i) => (wishScores[i] >= 0.8 ? [w.reason(e)] : [])),
      ...(text.matched.length && !wishes.length ? [`matches “${text.matched.slice(0, 2).join(' ')}”`] : []),
      ...(e.signals.leadTime === '24h' ? ['order 24 h ahead'] : []),
    ];
    const hit: SearchHit = { product: e.product, score: scoreOf(components), components, reasons, reason: reasonLine(reasons) };
    ranked.push({ item: hit, id: e.product.id, name: e.product.name, score: hit.score, components });
  }
  return { hits: rank(ranked).map((r) => r.item), excludedUnavailable };
}

/** Popular, available products: the empty-query view and the last-resort fallback. */
function popular(index: ProductIndex, opts: Required<Pick<SearchOptions, 'availability' | 'popularity'>>): SearchHit[] {
  const maxSold = Math.max(1, ...Object.values(opts.popularity));
  return index.entries.filter((e) => opts.availability(e.product) > 0).map((e) => {
    const components: RankingComponents = { text: 0, semantic: 0, attributes: 0, popularity: (e.product.featured ? 0.5 : 0) + 0.5 * ((opts.popularity[e.product.id] ?? 0) / maxSold), availability: e.signals.leadTime === '24h' ? 0.5 : 1 };
    return { product: e.product, score: scoreOf(components), components, reasons: [], reason: null };
  }).sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name));
}

export function search(query: string, options: SearchOptions): IntelligenceResult<SearchResult> {
  return runOperation('search', () => {
    const opts = { availability: options.availability ?? (() => 99), popularity: options.popularity ?? {} };
    const index = productIndex(options.products);
    const categories = new Set(options.products.map((p) => p.category));
    const warnings = [...index.warnings];
    const evidence: Evidence[] = [];
    const base = { provider: index.embedding?.provider ?? 'rules', providerKind: index.embedding ? 'statistical' as const : 'deterministic' as const, modelVersion: index.embedding?.version ?? null, rankingVersion: RANKING_VERSION };

    let intent = parseIntent(query, { categories, vocabulary: index.vocabulary });

    // Typo correction against the menu vocabulary and the intent lexicon, then re-parse.
    const corrections: Correction[] = [];
    if (intent.unknownTerms.length) {
      const dictionary = new Set([...index.vocabulary, ...LEXICON]);
      let corrected = intent.normalized;
      for (const term of intent.unknownTerms) {
        const c = correct(term, dictionary);
        if (c) { corrections.push(c); corrected = corrected.replace(new RegExp(`\\b${term}\\b`), c.to); }
      }
      if (corrections.length) {
        intent = { ...parseIntent(corrected, { categories, vocabulary: index.vocabulary }), raw: query };
        for (const c of corrections) evidence.push({ kind: 'match', label: 'Read as', value: `${c.from} → ${c.to}`, source: 'fuzzy' });
      }
    }
    evidence.push(...intent.evidence);

    if (!intent.normalized) {
      const hits = popular(index, opts).slice(0, options.limit ?? Infinity);
      return { ...base, result: { query, intent, corrections, hits, relaxed: [], excludedUnavailable: options.products.length - hits.length, interpretation: null }, confidence: 1, evidence: [{ kind: 'rule', label: 'No query', value: 'showing popular items' }], fallbackUsed: false, warnings };
    }

    // Words to look for in product copy: what the menu knows plus anything the intent couldn't place.
    // Pure instruction words ("quick", "under", "today") are left to the intent rules.
    const contentTokens = tokenize(intent.normalized).filter((t) => !STOP.has(t) && !/^\d+$/.test(t) && (index.vocabulary.has(t) || intent.freeTerms.includes(t)));
    const qVec = queryVector(index, intent.normalized);
    if (!qVec && index.embedding) warnings.push('query embedding unavailable; ranked without vectors');

    let gates = gatesFor(intent);
    let { hits, excludedUnavailable } = evaluate(index, intent, contentTokens, qVec, gates, opts);
    const relaxed: string[] = [];

    // Relax one constraint at a time (never exclusions or availability) until something fits.
    let relaxIntent = intent;
    const steps: { key: string; apply: (i: SearchIntent) => SearchIntent }[] = [
      { key: 'price', apply: (i) => ({ ...i, priceMax: null }) },
      { key: 'serves', apply: (i) => ({ ...i, serves: null }) },
      { key: 'today', apply: (i) => ({ ...i, needToday: false }) },
      { key: 'category', apply: (i) => ({ ...i, categories: [] }) },
      { key: 'sweetness', apply: (i) => ({ ...i, sweetness: null }) },
      { key: 'temperature', apply: (i) => ({ ...i, temperature: null }) },
      { key: 'richness', apply: (i) => ({ ...i, richness: null }) },
    ];
    for (const step of steps) {
      if (hits.length) break;
      const gate = gates.find((g) => g.key === step.key);
      const softLabel = step.key === 'sweetness' && relaxIntent.sweetness ? (relaxIntent.sweetness.max ? 'not too sweet' : 'sweet') : step.key === 'temperature' ? relaxIntent.temperature : step.key === 'richness' ? relaxIntent.richness : null;
      if (!gate && !softLabel) continue;
      relaxIntent = step.apply(relaxIntent);
      relaxed.push(gate?.label ?? softLabel!);
      gates = gatesFor(relaxIntent);
      ({ hits, excludedUnavailable } = evaluate(index, relaxIntent, contentTokens, qVec, gates, opts));
    }

    let fallbackUsed = relaxed.length > 0;
    if (!hits.length) {
      // Nothing answers the query: show what's popular rather than an empty page, and say so.
      hits = popular(index, opts).filter((h) => gatesFor(intent).filter((g) => !g.relaxable).every((g) => g.pass(index.byId.get(h.product.id)!)));
      fallbackUsed = true;
      relaxed.push('everything');
      warnings.push(`no match for “${query}”`);
    }
    for (const r of relaxed) evidence.push({ kind: 'rule', label: 'Relaxed', value: r });
    if (excludedUnavailable) evidence.push({ kind: 'business', label: 'Hidden (unavailable)', value: excludedUnavailable });
    if (intent.unknownTerms.length) warnings.push(`not understood: ${intent.unknownTerms.join(', ')}`);

    const top = hits[0];
    const strength = top ? Math.max(top.components.attributes, top.components.text) : 0;
    const confidence = relaxed.includes('everything') ? 0.1 : (0.5 * intent.confidence + 0.5 * strength) * (relaxed.length ? 0.6 : 1);

    return {
      ...base,
      result: { query, intent, corrections, hits: hits.slice(0, options.limit ?? Infinity), relaxed, excludedUnavailable, interpretation: intent.interpretation },
      confidence,
      evidence,
      fallbackUsed,
      warnings,
    };
  });
}
