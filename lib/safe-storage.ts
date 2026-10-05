// Stored browser data can be anything: an older version's shape, a half-written value,
// or something typed into devtools. Readers keep only well-formed records so one bad
// value can never take a whole page down.

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The well-formed records of a stored list; anything else becomes an empty list. */
export function recordsOnly<T>(raw: unknown, valid: (v: Record<string, unknown>) => boolean = () => true): T[] {
  return Array.isArray(raw) ? (raw.filter((v) => isRecord(v) && valid(v)) as T[]) : [];
}

/** Parses a stored JSON string, or null when it is missing or not JSON. */
export function parseStored(raw: string | null): unknown {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
