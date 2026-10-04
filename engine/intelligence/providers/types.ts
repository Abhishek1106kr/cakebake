// Provider abstraction. The engine never calls a specific vendor directly:
// it asks the registry for providers of a kind, in priority order, and falls
// back to the next one (and finally to the caller's deterministic path) on failure.

import type { ProviderKind } from '../core/contract';

export type ProviderBase = {
  id: string;
  kind: ProviderKind;
  version: string;
  available(): boolean;
};

export type EmbeddingProvider = ProviderBase & { dimensions: number; embed(texts: string[]): number[][] };
export type RerankingProvider = ProviderBase & { rerank(query: string, candidates: { id: string; text: string }[]): { id: string; score: number }[] };
export type ForecastProvider = ProviderBase & { forecast(series: number[], horizon: number): { point: number[]; lower?: number[]; upper?: number[] } };
export type GenerationProvider = ProviderBase & { generate(prompt: string, options?: { maxTokens?: number }): Promise<string> };

type Registry = {
  embedding: EmbeddingProvider[];
  reranking: RerankingProvider[];
  forecast: ForecastProvider[];
  generation: GenerationProvider[];
};

export type ProviderSlot = keyof Registry;

const registry: Registry = { embedding: [], reranking: [], forecast: [], generation: [] };

export function registerProvider<S extends ProviderSlot>(slot: S, provider: Registry[S][number], priority: 'first' | 'last' = 'last') {
  const list = registry[slot] as Registry[S][number][];
  const without = list.filter((p) => p.id !== provider.id);
  (registry[slot] as Registry[S][number][]) = priority === 'first' ? [provider, ...without] : [...without, provider];
}

export function providers<S extends ProviderSlot>(slot: S): Registry[S] {
  return registry[slot];
}

export function clearProviders(slot?: ProviderSlot) {
  for (const key of Object.keys(registry) as ProviderSlot[]) if (!slot || slot === key) (registry[key] as unknown[]) = [];
}

export type FallbackOutcome<T> =
  | { ok: true; value: T; provider: ProviderBase; fallbackUsed: boolean; errors: string[] }
  | { ok: false; errors: string[] };

/** Tries each available provider in order; reports which one answered and whether a fallback was needed. */
export function withFallback<S extends ProviderSlot, T>(slot: S, call: (p: Registry[S][number]) => T): FallbackOutcome<T> {
  const errors: string[] = [];
  let attempted = 0;
  for (const p of registry[slot] as Registry[S][number][]) {
    if (!p.available()) { errors.push(`${p.id}: unavailable`); continue; }
    attempted += 1;
    try {
      return { ok: true, value: call(p), provider: p, fallbackUsed: attempted > 1 || errors.length > 0, errors };
    } catch (e) {
      errors.push(`${p.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { ok: false, errors: errors.length ? errors : [`no ${slot} provider registered`] };
}
