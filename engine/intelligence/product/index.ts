// Product index: signals, searchable tokens and a vector per product, built
// once per menu + embedding provider and reused by search and recommendations.

import type { Product } from '@/lib/data';
import { tokenize } from '../providers/local-embedding';
import { withFallback, type EmbeddingProvider } from '../providers/types';
import { conceptText, signalsFor, type ProductSignals } from './signals';

export type IndexEntry = {
  product: Product;
  signals: ProductSignals;
  /** Tokens by field, for weighted text matching. */
  fields: { name: Set<string>; terms: Set<string>; body: Set<string> };
  vector: number[] | null;
};

export type ProductIndex = {
  entries: IndexEntry[];
  byId: Map<string, IndexEntry>;
  /** Every word a product is known by, for typo correction. */
  vocabulary: Set<string>;
  embedding: { provider: string; version: string } | null;
  warnings: string[];
};

let cache: { products: Product[]; providerKey: string; index: ProductIndex } | null = null;

export function buildProductIndex(products: Product[]): ProductIndex {
  const signals = products.map(signalsFor);
  const texts = products.map((p, i) => conceptText(p, signals[i]));
  const embedded = withFallback('embedding', (p: EmbeddingProvider) => ({ vectors: p.embed(texts), provider: p }));
  const warnings = embedded.ok ? (embedded.fallbackUsed ? [`embedding fell back: ${embedded.errors.join('; ')}`] : []) : [`no vectors: ${embedded.errors.join('; ')}`];
  const vocabulary = new Set<string>();
  const entries = products.map((product, i) => {
    const name = new Set(tokenize(product.name));
    const terms = new Set(product.searchTerms.flatMap(tokenize));
    const body = new Set(tokenize(texts[i]));
    for (const t of body) if (t.length > 2) vocabulary.add(t);
    return { product, signals: signals[i], fields: { name, terms, body }, vector: embedded.ok ? embedded.value.vectors[i] : null };
  });
  return {
    entries,
    byId: new Map(entries.map((e) => [e.product.id, e])),
    vocabulary,
    embedding: embedded.ok ? { provider: embedded.value.provider.id, version: embedded.value.provider.version } : null,
    warnings,
  };
}

/** Cached index: rebuilt only when the menu or the active embedding provider changes. */
export function productIndex(products: Product[]): ProductIndex {
  const first = withFallback('embedding', (p: EmbeddingProvider) => `${p.id}@${p.version}`);
  const providerKey = first.ok ? first.value : 'none';
  if (cache && cache.products === products && cache.providerKey === providerKey) return cache.index;
  const index = buildProductIndex(products);
  cache = { products, providerKey, index };
  return index;
}
