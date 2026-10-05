// Append-only audit log. Every admin mutation is recorded as
// actor · action · entity · before · after · time · reason · source.
// There is no update or delete: `appendAudit` is the only writer, and storage keeps
// the newest records when it has to trim (the trim itself is recorded).

import type { Role } from './permissions';

export type EntityType =
  | 'order' | 'inventory' | 'product' | 'cakeOption' | 'cakeRule' | 'printRules' | 'customer' | 'invoice' | 'automation'
  | 'campaign' | 'content' | 'media' | 'staff' | 'settings' | 'customCake' | 'notification' | 'decision' | 'session' | 'issue' | 'payment';

export type AuditActor = { id: string; name: string; role: Role | 'SYSTEM' };
export type AuditSource = 'admin-ui' | 'bulk' | 'copilot' | 'intelligence' | 'system' | 'import';

export type AuditRecord = {
  id: string;
  at: string;
  actor: AuditActor;
  action: string; // e.g. 'order.status.changed', 'product.price.changed'
  entity: { type: EntityType; id: string; label?: string };
  before: unknown;
  after: unknown;
  reason: string | null;
  source: AuditSource;
};

export const SYSTEM_ACTOR: AuditActor = { id: 'system', name: 'System', role: 'SYSTEM' };
export const AUDIT_LIMIT = 5000;

let seq = 0;
export function makeAudit(input: Omit<AuditRecord, 'id' | 'at'> & { at?: Date }): AuditRecord {
  const at = input.at ?? new Date();
  const { at: _ignored, ...rest } = input;
  return { ...rest, id: `aud-${at.getTime().toString(36)}-${(seq += 1).toString(36)}-${Math.random().toString(36).slice(2, 6)}`, at: at.toISOString(), before: clone(rest.before), after: clone(rest.after) };
}

/** Appends without touching existing records. Over the limit, the oldest are dropped (newest kept). */
export function appendAudit(log: readonly AuditRecord[], record: AuditRecord, limit = AUDIT_LIMIT): AuditRecord[] {
  const next = [...log, record];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

const clone = (v: unknown) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));

export type Change = { field: string; before: unknown; after: unknown };

/** Field-level differences between two plain values (one level deep; nested objects compared as JSON). */
export function diff(before: unknown, after: unknown): Change[] {
  const a = (before && typeof before === 'object' ? before : { value: before }) as Record<string, unknown>;
  const b = (after && typeof after === 'object' ? after : { value: after }) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  return keys.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).map((k) => ({ field: k, before: a[k], after: b[k] }));
}

export type AuditFilter = { query?: string; entityType?: EntityType | 'ALL'; actorId?: string | 'ALL'; action?: string };

export function filterAudit(log: readonly AuditRecord[], f: AuditFilter): AuditRecord[] {
  const q = f.query?.trim().toLowerCase() ?? '';
  return log
    .filter((r) => !f.entityType || f.entityType === 'ALL' || r.entity.type === f.entityType)
    .filter((r) => !f.actorId || f.actorId === 'ALL' || r.actor.id === f.actorId)
    .filter((r) => !f.action || r.action.startsWith(f.action))
    .filter((r) => !q || [r.action, r.entity.id, r.entity.label ?? '', r.actor.name, r.reason ?? ''].some((s) => s.toLowerCase().includes(q)))
    .slice()
    .reverse();
}

/** Records touching one entity (or mentioning it, e.g. an order id inside an invoice change). */
export function auditFor(log: readonly AuditRecord[], entityId: string): AuditRecord[] {
  return log.filter((r) => r.entity.id === entityId || r.entity.id.startsWith(`${entityId}:`)).slice().reverse();
}

const short = (v: unknown) => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') { const s = JSON.stringify(v); return s.length > 60 ? `${s.slice(0, 57)}…` : s; }
  return String(v);
};

/** One readable line, e.g. "price: ₹290 → ₹310". */
export function describeChange(r: AuditRecord): string {
  const changes = diff(r.before, r.after);
  if (!changes.length) return r.action;
  return changes.slice(0, 3).map((c) => `${c.field}: ${short(c.before)} → ${short(c.after)}`).join(' · ') + (changes.length > 3 ? ` · +${changes.length - 3} more` : '');
}
