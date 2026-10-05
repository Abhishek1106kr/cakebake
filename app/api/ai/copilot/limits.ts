// In-memory limits for the copilot route: per visitor and per day, per server instance.

const PER_CLIENT = { max: 10, windowMs: 10 * 60_000 };
const DAILY_MAX = 300;

const clients = new Map<string, number[]>();
let day = '';
let dayCount = 0;

export type LimitResult = { ok: true } | { ok: false; retryAfter: number };

export function checkLimits(client: string, now = Date.now()): LimitResult {
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== day) { day = today; dayCount = 0; }
  if (dayCount >= DAILY_MAX) {
    const midnight = Date.parse(`${today}T00:00:00.000Z`) + 86_400_000;
    return { ok: false, retryAfter: Math.max(1, Math.ceil((midnight - now) / 1000)) };
  }
  const recent = (clients.get(client) ?? []).filter((t) => now - t < PER_CLIENT.windowMs);
  if (recent.length >= PER_CLIENT.max) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((recent[0] + PER_CLIENT.windowMs - now) / 1000)) };
  }
  recent.push(now);
  clients.set(client, recent);
  dayCount += 1;
  // Keep the map small.
  if (clients.size > 5000) for (const [k, v] of clients) if (!v.some((t) => now - t < PER_CLIENT.windowMs)) clients.delete(k);
  return { ok: true };
}

/** Test hook. */
export function resetLimits() { clients.clear(); day = ''; dayCount = 0; }
