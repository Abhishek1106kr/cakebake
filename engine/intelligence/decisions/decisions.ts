// Decision engine (Phase 9): turns insights into proposed actions, each with a
// level from the policy table:
//   OBSERVE            noted, nothing to do
//   RECOMMEND          a person should look; no button changes data
//   DRAFT              the engine prepares the change; a person edits and applies it
//   APPROVAL_REQUIRED  ready to apply, but only after explicit approval
//   EXECUTE            safe to apply automatically (nothing qualifies today)
// Nothing that changes stock, money or orders is ever executed without approval.
// Every verdict is written to an append-only, local audit log.

import type { Evidence } from '../core/contract';
import type { Insight } from '../insights/insights';
import type { StockOutlook } from '../forecast/forecast';

export const DECISIONS_VERSION = 'decisions-v1';

export type DecisionLevel = 'OBSERVE' | 'RECOMMEND' | 'DRAFT' | 'APPROVAL_REQUIRED' | 'EXECUTE';
export type ActionKind = 'restock' | 'check_order' | 'review_search_gap' | 'review_product' | 'note';

export const POLICY: Record<ActionKind, { level: DecisionLevel; why: string }> = {
  restock: { level: 'APPROVAL_REQUIRED', why: 'Changes stock records, so a person approves the amount first.' },
  check_order: { level: 'RECOMMEND', why: 'Needs someone to check the kitchen; the engine can’t see the pass.' },
  review_search_gap: { level: 'RECOMMEND', why: 'Menu changes are the owner’s call.' },
  review_product: { level: 'RECOMMEND', why: 'Price and copy changes are the owner’s call.' },
  note: { level: 'OBSERVE', why: 'Information only.' },
};

/** What applying an action would do. The UI performs it through the store; the engine never mutates state. */
export type ExecutionPlan = { type: 'inventory_movement'; ingredientId: string; delta: number; reason: 'Restock' } | { type: 'none' };

export type ProposedAction = {
  id: string;
  insightId: string;
  kind: ActionKind;
  level: DecisionLevel;
  title: string;
  why: string;
  plan: ExecutionPlan;
  evidence: Evidence[];
  confidence: number;
  reversible: boolean;
};

export function proposeActions(insights: Insight[], outlook: StockOutlook[]): ProposedAction[] {
  const byIngredient = new Map(outlook.map((o) => [o.ingredientId, o]));
  return insights.map((insight): ProposedAction => {
    const base = { insightId: insight.id, evidence: insight.evidence, confidence: insight.confidence };
    if (insight.kind === 'stock') {
      const ingredientId = insight.id.split(':')[1];
      const row = byIngredient.get(ingredientId);
      const amount = row?.suggestedRestock ?? 0;
      if (amount > 0) {
        return { ...base, id: `restock:${ingredientId}:${amount}`, kind: 'restock', level: POLICY.restock.level, title: `Record a restock of ${amount} ${row!.unit} ${row!.name.toLowerCase()}`, why: POLICY.restock.why, plan: { type: 'inventory_movement', ingredientId, delta: amount, reason: 'Restock' }, reversible: true };
      }
      return { ...base, id: `restock:${ingredientId}:review`, kind: 'restock', level: 'DRAFT', title: 'Decide how much to reorder', why: 'Not enough order history to suggest an amount.', plan: { type: 'none' }, reversible: true };
    }
    if (insight.kind === 'kitchen') return { ...base, id: `check:${insight.id}`, kind: 'check_order', level: POLICY.check_order.level, title: 'Check on this order', why: POLICY.check_order.why, plan: { type: 'none' }, reversible: true };
    if (insight.kind === 'search') return { ...base, id: `gap:${insight.id}`, kind: 'review_search_gap', level: POLICY.review_search_gap.level, title: 'Review this menu gap', why: POLICY.review_search_gap.why, plan: { type: 'none' }, reversible: true };
    if (insight.kind === 'product' && insight.severity !== 'info') return { ...base, id: `review:${insight.id}`, kind: 'review_product', level: POLICY.review_product.level, title: 'Review this product', why: POLICY.review_product.why, plan: { type: 'none' }, reversible: true };
    return { ...base, id: `note:${insight.id}`, kind: 'note', level: 'OBSERVE', title: 'Noted', why: POLICY.note.why, plan: { type: 'none' }, reversible: true };
  });
}

// ---------- Audit log ----------

export type Verdict = 'approved' | 'rejected' | 'executed';
export type DecisionRecord = { id: string; actionId: string; insightId: string; kind: ActionKind; level: DecisionLevel; verdict: Verdict; at: string; plan: ExecutionPlan };

export type DecisionStore = { load(): DecisionRecord[]; save(records: DecisionRecord[]): void };

export function memoryDecisionStore(initial: DecisionRecord[] = []): DecisionStore {
  let records = [...initial];
  return { load: () => records, save: (next) => { records = next; } };
}

export function browserDecisionStore(key = 'tresor-decisions'): DecisionStore {
  return {
    load() { try { return JSON.parse(window.localStorage.getItem(key) || '[]'); } catch { return []; } },
    save(next) { try { window.localStorage.setItem(key, JSON.stringify(next.slice(-500))); } catch { /* full or blocked */ } },
  };
}

let seq = 0;
function record(store: DecisionStore, action: ProposedAction, verdict: Verdict, at: Date): DecisionRecord {
  const entry: DecisionRecord = { id: `dec-${at.getTime().toString(36)}-${(seq += 1)}`, actionId: action.id, insightId: action.insightId, kind: action.kind, level: action.level, verdict, at: at.toISOString(), plan: action.plan };
  store.save([...store.load(), entry]);
  return entry;
}

export type ApplyResult = { ok: true; plan: ExecutionPlan; records: DecisionRecord[] } | { ok: false; reason: string };

/**
 * Approves and applies an action. Only APPROVAL_REQUIRED (with this explicit approval) or
 * EXECUTE actions with a real plan can be applied; everything else is refused.
 */
export function approveAndApply(store: DecisionStore, action: ProposedAction, apply: (plan: ExecutionPlan) => void, at = new Date()): ApplyResult {
  if (action.level !== 'APPROVAL_REQUIRED' && action.level !== 'EXECUTE') return { ok: false, reason: `${action.level} actions can’t be applied from here` };
  if (action.plan.type === 'none') return { ok: false, reason: 'nothing to apply' };
  if (store.load().some((r) => r.actionId === action.id && r.verdict === 'executed')) return { ok: false, reason: 'already applied' };
  const approved = record(store, action, 'approved', at);
  apply(action.plan);
  const executed = record(store, action, 'executed', at);
  return { ok: true, plan: action.plan, records: [approved, executed] };
}

export function reject(store: DecisionStore, action: ProposedAction, at = new Date()): DecisionRecord {
  return record(store, action, 'rejected', at);
}

/** Hides actions rejected in the last `hours` and ones already applied, so the list stays current. */
export function pending(actions: ProposedAction[], store: DecisionStore, now = new Date(), hours = 24): ProposedAction[] {
  const log = store.load();
  const cutoff = now.getTime() - hours * 3600000;
  return actions.filter((a) => !log.some((r) => r.actionId === a.id && (r.verdict === 'executed' || (r.verdict === 'rejected' && Date.parse(r.at) >= cutoff))));
}
