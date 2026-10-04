'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { products } from '@/lib/data';
import {
  approveAndApply, browserDecisionStore, eventBus, generateInsights, generateOperationalInsights, pending, proposeActions, reject, stockOutlook,
  type ProposedAction, type TresorEvent,
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
