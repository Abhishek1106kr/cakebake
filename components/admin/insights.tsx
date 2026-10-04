'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, X } from 'lucide-react';
import { products } from '@/lib/data';
import {
  approveAndApply, browserDecisionStore, confidenceLabel, eventBus, generateInsights, generateOperationalInsights, pending, proposeActions, reject, stockOutlook,
  type Insight, type ProposedAction, type TresorEvent,
} from '@/engine/intelligence';
import { track } from '@/engine/intelligence/events/track';
import { useStore } from '@/components/store-provider';
import { useAutomation } from '@/components/use-automation';

/** Events recorded in this browser, kept fresh as new ones arrive. */
export function useEvents(): TresorEvent[] {
  const [events, setEvents] = useState<TresorEvent[]>([]);
  useEffect(() => {
    const bus = eventBus();
    setEvents(bus.query());
    const off = bus.subscribe(() => setEvents(bus.query()));
    // Other tabs (the shop) write to storage; re-read when they do.
    const onStorage = (e: StorageEvent) => { if (e.key === 'tresor-events') setEvents(bus.query()); };
    window.addEventListener('storage', onStorage);
    return () => { off(); window.removeEventListener('storage', onStorage); };
  }, []);
  return events;
}

const store = typeof window !== 'undefined' ? browserDecisionStore() : null;
// Every panel on the page re-filters when any of them records a decision.
const DECISION_EVENT = 'tresor-decision';
const announce = () => window.dispatchEvent(new Event(DECISION_EVENT));

/**
 * Insights plus the actions the decision engine proposes for them. Approving applies the
 * action's plan through the store (the engine never changes data itself); dismissing hides
 * it for a day. Both are written to the decision log and the event stream.
 */
export function useInsights(now: Date) {
  const { orders, inventory, recordMovement } = useStore();
  const events = useEvents();
  const { jobs } = useAutomation();
  const [logVersion, setLogVersion] = useState(0);
  useEffect(() => {
    const bump = () => setLogVersion((v) => v + 1);
    const onStorage = (e: StorageEvent) => { if (e.key === 'tresor-decisions') bump(); };
    window.addEventListener(DECISION_EVENT, bump);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener(DECISION_EVENT, bump); window.removeEventListener('storage', onStorage); };
  }, []);
  // Recompute when data changes or the minute ticks over, not on every render.
  const minute = Math.floor(now.getTime() / 60000);
  const computed = useMemo(() => {
    const core = generateInsights({ orders, inventory, events, products, now });
    const ops = generateOperationalInsights({ orders, jobs, events, products, now });
    const rank = { act: 0, watch: 1, info: 2 } as const;
    const insights = { ...core, result: [...core.result, ...ops.result].sort((a, b) => rank[a.severity] - rank[b.severity] || b.confidence - a.confidence), warnings: [...core.warnings, ...ops.warnings] };
    const actions = proposeActions(insights.result, stockOutlook(inventory, orders, now).result);
    return { insights, actions };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, inventory, events, jobs, minute]);

  const open = useMemo(() => (store ? pending(computed.actions, store, now) : computed.actions), [computed, logVersion, minute]); // eslint-disable-line react-hooks/exhaustive-deps
  const actionFor = useMemo(() => new Map(open.map((a) => [a.insightId, a])), [open]);
  const visible = computed.insights.result.filter((i) => actionFor.has(i.id));

  const approve = useCallback((action: ProposedAction) => {
    if (!store) return { ok: false as const, reason: 'no storage' };
    const result = approveAndApply(store, action, (plan) => {
      if (plan.type === 'inventory_movement') recordMovement(plan.ingredientId, plan.delta, plan.reason);
    });
    if (result.ok) {
      track('action_approved', { actionId: action.id, kind: action.kind, level: action.level }, 'admin');
      track('action_executed', { actionId: action.id, kind: action.kind, plan: result.plan.type }, 'admin');
      announce();
    }
    return result;
  }, [recordMovement]);

  const dismiss = useCallback((action: ProposedAction) => {
    if (!store) return;
    reject(store, action);
    track('action_rejected', { actionId: action.id, kind: action.kind, level: action.level }, 'admin');
    announce();
  }, []);

  return { insights: computed.insights, visible, actionFor, approve, dismiss };
}

const SEVERITY_LABEL = { act: 'Act now', watch: 'Keep an eye', info: 'Good to know' } as const;
const LEVEL_LABEL = { OBSERVE: 'For information', RECOMMEND: 'Suggested', DRAFT: 'Draft for you', APPROVAL_REQUIRED: 'Needs your approval', EXECUTE: 'Automatic' } as const;

export function ActionControls({ action, onApprove, onDismiss }: { action: ProposedAction; onApprove: (a: ProposedAction) => { ok: boolean }; onDismiss: (a: ProposedAction) => void }) {
  const [confirming, setConfirming] = useState(false);
  if (action.level === 'OBSERVE') return <button className="insight-dismiss" onClick={() => onDismiss(action)} aria-label="Dismiss for today"><X size={13} /> Dismiss</button>;
  return (
    <div className="insight-decision">
      <div className="insight-level">{LEVEL_LABEL[action.level]} · <span title={action.why}>{action.title}</span></div>
      <div className="insight-decision-buttons">
        {action.level === 'APPROVAL_REQUIRED' && action.plan.type !== 'none' && (
          confirming
            ? <button className="btn btn-brand btn-sm" onClick={() => { onApprove(action); setConfirming(false); }}><Check size={14} /> Confirm</button>
            : <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(true)}>Approve</button>
        )}
        {confirming && <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>Cancel</button>}
        {!confirming && <button className="insight-dismiss" onClick={() => onDismiss(action)}><X size={13} /> Dismiss</button>}
      </div>
    </div>
  );
}

function InsightCard({ insight, action, onApprove, onDismiss }: { insight: Insight; action?: ProposedAction; onApprove: (a: ProposedAction) => { ok: boolean }; onDismiss: (a: ProposedAction) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.li layout className={`insight insight-${insight.severity}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}>
      <div className="insight-top">
        <span className="insight-sev">{SEVERITY_LABEL[insight.severity]}</span>
        <span className="insight-conf" title={`Confidence ${Math.round(insight.confidence * 100)}%`}>{confidenceLabel(insight.confidence)} confidence</span>
      </div>
      <strong className="insight-title">{insight.title}</strong>
      <p className="insight-detail">{insight.detail}</p>
      <div className="insight-actions">
        {insight.next && <Link href={insight.next.href as Route} className="text-link" onClick={() => track('insight_viewed', { insightId: insight.id, kind: insight.kind }, 'admin')}>{insight.next.label}</Link>}
        <button className="insight-why" onClick={() => setOpen((o) => !o)} aria-expanded={open}>Why <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} /></button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.dl className="insight-evidence" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            {insight.evidence.map((e) => <div key={e.label}><dt>{e.label}</dt><dd>{String(e.value ?? '—')}</dd></div>)}
          </motion.dl>
        )}
      </AnimatePresence>
      {action && <ActionControls action={action} onApprove={onApprove} onDismiss={onDismiss} />}
    </motion.li>
  );
}

function List({ now, limit, wide }: { now: Date; limit?: number; wide?: boolean }) {
  const { insights, visible, actionFor, approve, dismiss } = useInsights(now);
  const list = limit ? visible.slice(0, limit) : visible;
  return (
    <>
      {list.length === 0 ? <p className="muted">Nothing needs attention right now.</p> : (
        <ul className={`insight-list ${wide ? 'insight-list-wide' : ''}`}>
          <AnimatePresence initial={false}>{list.map((i) => <InsightCard key={i.id} insight={i} action={actionFor.get(i.id)} onApprove={approve} onDismiss={dismiss} />)}</AnimatePresence>
        </ul>
      )}
      {insights.warnings.length > 0 && <p className="insight-footnote">{insights.warnings[0].charAt(0).toUpperCase() + insights.warnings[0].slice(1)}.</p>}
    </>
  );
}

export function InsightsPanel({ now, limit = 4 }: { now: Date; limit?: number }) {
  return (
    <section className="panel insights-panel">
      <div className="panel-head"><h2>What needs you</h2><Link href="/admin/analytics" className="text-link">All insights</Link></div>
      <List now={now} limit={limit} />
    </section>
  );
}

export function InsightList({ now }: { now: Date }) {
  return <List now={now} wide />;
}
