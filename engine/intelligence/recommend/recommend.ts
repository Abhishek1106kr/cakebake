// Recommendations (Phase 4): similar items, what goes with something, cart
// add-ons (including the free-delivery nudge) and a time-of-day "for you" row.
// Rules plus co-purchase statistics from real orders; every pick has reasons.

import type { Product } from '@/lib/data';
import { runOperation, type Evidence, type IntelligenceResult } from '../core/contract';
import { productIndex } from '../product/index';
import { cosine } from '../providers/local-embedding';
import type { Moment } from '../product/signals';
import type { TimeOfDay } from '../context/context';
import { reasonLine } from '../explanations/explain';

export const RECO_VERSION = 'reco-v1';

/** Structural order shape, so the engine doesn't depend on the store's full Order type. */
export type OrderLike = { status: string; createdAt: string; items: { product: { id: string }; qty: number }[] };

export type RecoOptions = {
  products: Product[];
  availability?: (p: Product) => number;
  orders?: OrderLike[];
  limit?: number;
};

export type Recommendation = {
  product: Product;
  score: number;
  kind: 'similar' | 'pairs' | 'free-delivery' | 'reorder' | 'moment' | 'popular';
  reasons: string[];
  reason: string | null;
};

/** What a category goes with, strongest first. */
const COMPLEMENTS: Record<string, string[]> = {
  Coffee: ['Pastry', 'Dessert', 'Cake'],
  Drinks: ['Pastry', 'Savoury', 'Dessert'],
  Pastry: ['Coffee', 'Drinks'],
  Savoury: ['Drinks', 'Coffee'],
  Bread: ['Coffee', 'Savoury', 'Pastry'],
  Dessert: ['Coffee', 'Drinks'],
  Cake: ['Coffee', 'Drinks'],
};

const live = (orders: OrderLike[] = []) => orders.filter((o) => o.status !== 'CANCELLED');

/** How many orders contained both a and b, for every pair. */
export function coPurchases(orders: OrderLike[] = []): Map<string, Map<string, number>> {
  const pairs = new Map<string, Map<string, number>>();
  for (const o of live(orders)) {
    const ids = [...new Set(o.items.map((l) => l.product.id))];
    for (const a of ids) for (const b of ids) {
      if (a === b) continue;
      const row = pairs.get(a) ?? new Map<string, number>();
      row.set(b, (row.get(b) ?? 0) + 1);
      pairs.set(a, row);
    }
  }
  return pairs;
}

export function unitsSold(orders: OrderLike[] = []): Record<string, number> {
  const sold: Record<string, number> = {};
  for (const o of live(orders)) for (const l of o.items) sold[l.product.id] = (sold[l.product.id] ?? 0) + l.qty;
  return sold;
}

function finish(list: Recommendation[], limit: number): Recommendation[] {
  const seen = new Set<string>();
  return list
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
    .filter((r) => (seen.has(r.product.id) ? false : (seen.add(r.product.id), true)))
    .slice(0, limit)
    .map((r) => ({ ...r, score: Math.round(r.score * 1000) / 1000, reason: reasonLine(r.reasons, 2) }));
}

function result(list: Recommendation[], evidence: Evidence[], fallbackUsed: boolean, warnings: string[] = []) {
  return {
    result: list,
    confidence: list.length ? Math.min(1, 0.4 + 0.6 * (list[0]?.score ?? 0)) : 0,
    evidence,
    provider: 'rules+copurchase',
    providerKind: 'statistical' as const,
    modelVersion: null,
    rankingVersion: RECO_VERSION,
    fallbackUsed,
    warnings,
  };
}

/** Items like this one: shared flavours and category, plus vector similarity. */
export function similarTo(productId: string, opts: RecoOptions): IntelligenceResult<Recommendation[]> {
  return runOperation('recommend.similar', () => {
    const index = productIndex(opts.products);
    const self = index.byId.get(productId);
    if (!self) return result([], [{ kind: 'data', label: 'Unknown product', value: productId }], true, ['unknown product']);
    const available = opts.availability ?? (() => 99);
    const list: Recommendation[] = [];
    for (const e of index.entries) {
      if (e.product.id === productId || available(e.product) <= 0) continue;
      const shared = e.signals.flavours.filter((f) => self.signals.flavours.includes(f) && f !== 'creamy');
      const sameCategory = e.product.category === self.product.category;
      const vector = self.vector && e.vector ? Math.max(0, cosine(self.vector, e.vector)) : 0;
      const score = 0.45 * Math.min(1, shared.length / 2) + 0.25 * (sameCategory ? 1 : 0) + 0.3 * vector;
      if (score < 0.3) continue;
      list.push({ product: e.product, score, kind: 'similar', reasons: [...shared.map((f) => `also ${f === 'chocolate' ? 'chocolatey' : f}`), sameCategory ? `another ${self.product.category.toLowerCase()}` : ''], reason: null });
    }
    return result(finish(list, opts.limit ?? 4), [{ kind: 'rule', label: 'Similarity', value: 'shared flavours, category, vector' }], false);
  });
}

/** What goes with a set of products: category complements and co-purchase history. */
export function pairsWith(productIds: string[], opts: RecoOptions): IntelligenceResult<Recommendation[]> {
  return runOperation('recommend.pairs', () => {
    const index = productIndex(opts.products);
    const anchors = productIds.map((id) => index.byId.get(id)).filter((e): e is NonNullable<typeof e> => Boolean(e));
    const available = opts.availability ?? (() => 99);
    const co = coPurchases(opts.orders);
    const sold = unitsSold(opts.orders);
    const maxSold = Math.max(1, ...Object.values(sold));
    const list: Recommendation[] = [];
    const evidence: Evidence[] = [];
    for (const e of index.entries) {
      if (productIds.includes(e.product.id) || available(e.product) <= 0 || e.signals.wholeCake) continue;
      let complement = 0;
      let together = 0;
      let partner: string | null = null;
      for (const a of anchors) {
        const rankIdx = (COMPLEMENTS[a.product.category] ?? []).indexOf(e.product.category);
        const c = rankIdx === -1 ? 0 : 1 - rankIdx * 0.25;
        if (c > complement) { complement = c; partner = a.product.name; }
        together = Math.max(together, co.get(a.product.id)?.get(e.product.id) ?? 0);
      }
      if (!complement && !together) continue;
      const score = 0.5 * complement + 0.35 * Math.min(1, together / 3) + 0.15 * ((sold[e.product.id] ?? 0) / maxSold);
      const reasons = [together >= 2 ? `often ordered together` : '', partner && complement ? `goes with your ${partner}` : ''];
      if (together) evidence.push({ kind: 'metric', label: `Ordered with ${anchors.map((a) => a.product.id).join('+')}`, value: `${e.product.id} × ${together}` });
      list.push({ product: e.product, score, kind: 'pairs', reasons, reason: null });
    }
    const fallback = list.length === 0;
    return result(finish(fallback ? popularList(opts) : list, opts.limit ?? 4), [{ kind: 'rule', label: 'Complements', value: anchors.map((a) => a.product.category).join(', ') }, ...evidence.slice(0, 5)], fallback);
  });
}

function popularList(opts: RecoOptions): Recommendation[] {
  const sold = unitsSold(opts.orders);
  const maxSold = Math.max(1, ...Object.values(sold));
  const available = opts.availability ?? (() => 99);
  return opts.products
    .filter((p) => available(p) > 0 && !p.cake)
    .map((p) => ({ product: p, score: 0.5 * ((sold[p.id] ?? 0) / maxSold) + (p.featured ? 0.3 : 0), kind: 'popular' as const, reasons: [sold[p.id] ? 'popular today' : 'a house favourite'], reason: null }));
}

/** Add-ons for the bag. If free delivery is close, favour something that gets them there. */
export function cartSuggestions(cart: { productId: string }[], toFreeDelivery: number, opts: RecoOptions): IntelligenceResult<Recommendation[]> {
  return runOperation('recommend.cart', () => {
    const ids = cart.map((c) => c.productId);
    const base = ids.length ? pairsWith(ids, { ...opts, limit: 12 }).result : popularList(opts);
    const list = base.map((r) => {
      if (toFreeDelivery > 0 && r.product.price >= toFreeDelivery && r.product.price <= toFreeDelivery + 150) {
        return { ...r, kind: 'free-delivery' as const, score: r.score + 0.3, reasons: ['gets you free delivery', ...r.reasons] };
      }
      return r;
    });
    const evidence: Evidence[] = [{ kind: 'business', label: 'To free delivery', value: toFreeDelivery }];
    return result(finish(list, opts.limit ?? 3), evidence, ids.length === 0);
  });
}

const MOMENT_FOR: Record<TimeOfDay, Moment[]> = {
  morning: ['breakfast', 'pick-me-up'],
  afternoon: ['pick-me-up', 'snack'],
  evening: ['dessert', 'snack'],
  night: ['dessert'],
};

/** A "for you" row: what this browser has ordered before, then what suits the time of day. */
export function forYou(input: { timeOfDay: TimeOfDay; history: OrderLike[] }, opts: RecoOptions): IntelligenceResult<Recommendation[]> {
  return runOperation('recommend.for-you', () => {
    const index = productIndex(opts.products);
    const available = opts.availability ?? (() => 99);
    const mine = unitsSold(input.history);
    const moments = MOMENT_FOR[input.timeOfDay];
    const list: Recommendation[] = [];
    for (const e of index.entries) {
      if (available(e.product) <= 0) continue;
      const again = mine[e.product.id] ?? 0;
      const fits = moments.some((m) => e.signals.moments.includes(m));
      if (!again && !fits) continue;
      list.push({
        product: e.product,
        score: 0.6 * Math.min(1, again / 2) + 0.3 * (fits ? 1 : 0) + (e.product.featured ? 0.1 : 0),
        kind: again ? 'reorder' : 'moment',
        reasons: [again ? 'you’ve had this before' : '', fits ? `nice this ${input.timeOfDay === 'night' ? 'late' : input.timeOfDay}` : ''],
        reason: null,
      });
    }
    return result(finish(list, opts.limit ?? 4), [{ kind: 'data', label: 'Time of day', value: input.timeOfDay }, { kind: 'data', label: 'Past orders', value: input.history.length }], false);
  });
}
