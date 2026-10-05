// Observability for intelligence operations. Every call is recorded with
// latency, provider, versions, cache/fallback use, result count, confidence and
// error. Kept in a bounded in-memory ring and persisted (debounced) in the browser.

import type { ProviderKind } from './contract';
import { parseStored, recordsOnly } from '@/lib/safe-storage';

export type OperationRecord = {
  id: string;
  at: string;
  operation: string;
  latencyMs: number;
  provider: string;
  providerKind: ProviderKind;
  modelVersion: string | null;
  rankingVersion: string | null;
  cacheHit: boolean;
  fallbackUsed: boolean;
  resultCount: number | null;
  confidence: number;
  error: string | null;
};

const KEY = 'tresor-intel-ops';
const LIMIT = 300;
let records: OperationRecord[] | null = null;
const listeners = new Set<(r: OperationRecord) => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const hasStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

function load(): OperationRecord[] {
  if (records) return records;
  records = [];
  if (hasStorage()) {
    records = recordsOnly<OperationRecord>(parseStored(window.localStorage.getItem(KEY)));
  }
  return records!;
}

function scheduleSave() {
  if (!hasStorage() || saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try { window.localStorage.setItem(KEY, JSON.stringify(load())); } catch {}
  }, 500);
}

let seq = 0;
export function recordOperation(input: Omit<OperationRecord, 'id' | 'at'>): OperationRecord {
  const record: OperationRecord = { ...input, id: `op-${Date.now().toString(36)}-${(seq += 1)}`, at: new Date().toISOString() };
  const all = load();
  all.push(record);
  if (all.length > LIMIT) all.splice(0, all.length - LIMIT);
  scheduleSave();
  listeners.forEach((l) => l(record));
  return record;
}

export function recentOperations(limit = 50, operation?: string): OperationRecord[] {
  const all = load().filter((r) => !operation || r.operation === operation);
  return all.slice(-limit).reverse();
}

export function onOperation(listener: (r: OperationRecord) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Summary per operation: calls, p50/p95 latency, error and fallback rates. */
export function operationStats(): Record<string, { calls: number; p50: number; p95: number; errorRate: number; fallbackRate: number; avgConfidence: number }> {
  const groups = new Map<string, OperationRecord[]>();
  for (const r of load()) groups.set(r.operation, [...(groups.get(r.operation) ?? []), r]);
  const out: ReturnType<typeof operationStats> = {};
  for (const [op, rs] of groups) {
    const lat = rs.map((r) => r.latencyMs).sort((a, b) => a - b);
    const pick = (q: number) => lat[Math.min(lat.length - 1, Math.floor(q * lat.length))];
    out[op] = {
      calls: rs.length,
      p50: pick(0.5),
      p95: pick(0.95),
      errorRate: rs.filter((r) => r.error).length / rs.length,
      fallbackRate: rs.filter((r) => r.fallbackUsed).length / rs.length,
      avgConfidence: rs.reduce((s, r) => s + r.confidence, 0) / rs.length,
    };
  }
  return out;
}

/** Test helper. */
export function resetObservability() {
  records = [];
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
}
