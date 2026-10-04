// The intelligence contract: every operation returns a result together with
// the evidence, confidence and provenance needed to trust (or reject) it.

import { recordOperation } from './observability';

export type EvidenceKind = 'rule' | 'match' | 'metric' | 'data' | 'model' | 'business';

export type Evidence = {
  kind: EvidenceKind;
  label: string;
  value?: string | number;
  weight?: number;
  source?: string;
};

export type ProviderKind = 'deterministic' | 'statistical' | 'local-model' | 'remote-model';

export type IntelligenceResult<T> = {
  operation: string;
  result: T;
  confidence: number; // 0–1
  evidence: Evidence[];
  provider: string;
  providerKind: ProviderKind;
  modelVersion: string | null;
  rankingVersion: string | null;
  latencyMs: number;
  fallbackUsed: boolean;
  cacheHit: boolean;
  warnings: string[];
};

export type OperationOutput<T> = Omit<IntelligenceResult<T>, 'operation' | 'latencyMs' | 'cacheHit'> & { cacheHit?: boolean };

export const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function resultCount(value: unknown): number | null {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object' && Array.isArray((value as { hits?: unknown[] }).hits)) return (value as { hits: unknown[] }).hits.length;
  return null;
}

/**
 * Runs one intelligence operation: measures latency, stamps the contract fields
 * and records the call in the observability log, including failures.
 */
export function runOperation<T>(operation: string, fn: () => OperationOutput<T>): IntelligenceResult<T> {
  const start = now();
  try {
    const out = fn();
    const full: IntelligenceResult<T> = { ...out, operation, latencyMs: Math.round((now() - start) * 100) / 100, cacheHit: out.cacheHit ?? false, confidence: clamp01(out.confidence) };
    recordOperation({
      operation, latencyMs: full.latencyMs, provider: full.provider, providerKind: full.providerKind,
      modelVersion: full.modelVersion, rankingVersion: full.rankingVersion, cacheHit: full.cacheHit,
      fallbackUsed: full.fallbackUsed, resultCount: resultCount(full.result), confidence: full.confidence, error: null,
    });
    return full;
  } catch (error) {
    recordOperation({
      operation, latencyMs: Math.round((now() - start) * 100) / 100, provider: 'unknown', providerKind: 'deterministic',
      modelVersion: null, rankingVersion: null, cacheHit: false, fallbackUsed: false, resultCount: null, confidence: 0,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
