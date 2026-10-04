// Local embedding provider: a hashed bag of words plus character trigrams,
// L2-normalised. Deterministic and instant, so it runs in the browser with no
// network. It captures lexical and sub-word similarity ("pistachio" ~ "pistachios");
// the concept layer in product signals supplies the meaning. A remote model can
// replace it by registering a higher-priority EmbeddingProvider.

import type { EmbeddingProvider } from './types';

export const LOCAL_EMBEDDING_VERSION = 'hash-256-v1';
const DIMS = 256;

function hash(s: string): number {
  // FNV-1a, 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]+/g) ?? [];
}

export function embedText(text: string): number[] {
  const v = new Array<number>(DIMS).fill(0);
  for (const token of tokenize(text)) {
    const h = hash(`w:${token}`);
    v[h % DIMS] += h & 1 ? 1 : -1; // signed hashing reduces collision bias
    const padded = `^${token}$`;
    for (let i = 0; i + 3 <= padded.length; i += 1) {
      const g = hash(`g:${padded.slice(i, i + 3)}`);
      v[g % DIMS] += (g & 1 ? 1 : -1) * 0.35;
    }
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm ? v.map((x) => x / norm) : v;
}

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += a[i] * b[i];
  return dot;
}

export const localEmbedding: EmbeddingProvider = {
  id: 'local-hash',
  kind: 'statistical',
  version: LOCAL_EMBEDDING_VERSION,
  dimensions: DIMS,
  available: () => true,
  embed: (texts) => texts.map(embedText),
};
