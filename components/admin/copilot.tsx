'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Check, MessageSquareText, Sparkles, X } from 'lucide-react';
import { products } from '@/lib/data';
import { askCopilot, confidenceLabel, type CopilotAnswer, type IntelligenceResult, type ProposedAction } from '@/engine/intelligence';
import { useStore } from '@/components/store-provider';
import { useAdmin } from './admin-provider';
import { useInsights } from './insights';
import { Badge, Panel } from './ui';
import { buildCopilotContext } from '@/lib/admin/copilot-context';

const STARTERS = ['What needs my attention?', 'How are cakes doing today?', 'Why is revenue lower than yesterday?', 'What is likely to stock out?', 'Which cake should we feature?', 'What orders are at risk of missing their slot?', 'Show failed automations.', 'How many custom cake orders are due tomorrow?'];

export const LEVEL_LABEL = { OBSERVE: 'For information', RECOMMEND: 'Suggested', DRAFT: 'Draft for you', APPROVAL_REQUIRED: 'Needs your approval', EXECUTE: 'Automatic' } as const;

/** Approve / dismiss for one proposed action. Approval goes through the audited action path. */
export function useDecisions(now: Date) {
  const admin = useAdmin();
  const { approve, dismiss } = useInsights(now);
  const approveAudited = async (a: ProposedAction) => {
    if (a.plan.type === 'inventory_movement' && !admin.can('inventory.adjust')) { admin.toast({ tone: 'error', title: 'Not allowed', detail: 'Approving a restock records stock, which your role can’t do.' }); return false; }
    const r = await admin.confirm({ title: a.title, impact: [a.why, ...(a.plan.type === 'inventory_movement' ? [`Records a restock of ${a.plan.delta} for ${a.plan.ingredientId}. Only approve once the delivery has actually arrived.`] : [])], confirmLabel: 'Approve', tone: 'primary', reason: 'optional' });
    if (!r.ok) return false;
    const res = admin.act({ permission: 'intelligence.approve', action: 'decision.approved', entity: { type: 'decision', id: a.id, label: a.title }, before: { level: a.level }, after: { plan: a.plan }, reason: r.reason, source: 'intelligence', run: () => { const out = approve(a); return out.ok ? undefined : `Couldn’t apply: ${'reason' in out ? out.reason : 'unknown'}`; }, success: 'Approved and applied' });
    return res.ok;
  };
  const dismissAudited = (a: ProposedAction) => admin.act({ permission: 'intelligence.view', action: 'decision.dismissed', entity: { type: 'decision', id: a.id, label: a.title }, after: { hiddenFor: '24 h' }, source: 'intelligence', run: () => dismiss(a), success: 'Dismissed for a day', quiet: true });
  return { approve: approveAudited, dismiss: dismissAudited };
}

export function ActionRow({ action, now, onDone }: { action: ProposedAction; now: Date; onDone?: (id: string) => void }) {
  const admin = useAdmin();
  const { approve, dismiss } = useDecisions(now);
  return (
    <div className="ad-action">
      <span><Badge tone={action.level === 'APPROVAL_REQUIRED' ? 'warn' : action.level === 'DRAFT' ? 'info' : 'neutral'}>{LEVEL_LABEL[action.level]}</Badge> <span title={action.why}>{action.title}</span></span>
      <span className="ad-row">
        {action.level === 'APPROVAL_REQUIRED' && action.plan.type !== 'none' && admin.can('intelligence.approve') && <button type="button" className="ad-btn ad-btn-sm" onClick={async () => { if (await approve(action)) onDone?.(action.id); }}><Check size={12} /> Approve…</button>}
        <button type="button" className="ad-btn ad-btn-sm ad-btn-ghost" onClick={() => { dismiss(action); onDone?.(action.id); }}><X size={12} /> Dismiss</button>
      </span>
    </div>
  );
}

type ModelReply = { state: 'idle' | 'loading' | 'done' | 'unavailable' | 'error'; answer?: string; model?: string; fallback?: boolean; note?: string };

const MODEL_ERRORS: Record<string, string> = {
  rate_limited: 'The demo limit for model answers is reached for now.',
  provider_busy: 'The model is busy; showing the answer from the records.',
  timeout: 'The model took too long; showing the answer from the records.',
};

/**
 * Ask the bakery a question. The rule-based answer and its facts come from the structured records.
 * When a model is configured on the server (/api/ai/copilot), it writes a short answer from a small
 * summary of the same records; the facts stay visible underneath as the evidence. Actions are only drafted.
 */
export function CopilotPanel({ now }: { now: Date }) {
  const { orders, inventory } = useStore();
  const admin = useAdmin();
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<{ q: string; n: number } | null>(null);
  const [handled, setHandled] = useState<Set<string>>(new Set());
  const [model, setModel] = useState<ModelReply>({ state: 'idle' });
  const enabled = useRef<boolean | null>(null);
  const reply: IntelligenceResult<CopilotAnswer> | null = useMemo(
    () => (asked === null ? null : askCopilot(asked.q, { orders, inventory, events: admin.events, products, now, jobs: admin.automation.jobs })),
    // Re-answer when the data changes so numbers stay live; not on every clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [asked, orders, inventory, admin.events, admin.automation.jobs],
  );

  // One model call per question asked (not per data change), with the records as they are now.
  useEffect(() => {
    if (!asked || !reply) return;
    let cancelled = false;
    (async () => {
      try {
        if (enabled.current === null) {
          const s = await fetch('/api/ai/copilot', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ enabled: false }));
          enabled.current = Boolean(s.enabled);
        }
        if (!enabled.current) { if (!cancelled) setModel({ state: 'unavailable' }); return; }
        if (!cancelled) setModel({ state: 'loading' });
        const context = buildCopilotContext({ orders, inventory, jobs: admin.automation.jobs, now: new Date(), rule: reply.result });
        const res = await fetch('/api/ai/copilot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: asked.q, context }) });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.answer) setModel({ state: 'done', answer: data.answer, model: data.model, fallback: Boolean(data.fallback) });
        else setModel({ state: 'error', note: MODEL_ERRORS[data.error] ?? 'The model is unavailable; showing the answer from the records.' });
      } catch {
        if (!cancelled) setModel({ state: 'error', note: 'The model is unavailable; showing the answer from the records.' });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked]);

  const ask = (q: string) => { if (!q.trim()) return; setQuestion(q); setAsked((a) => ({ q, n: (a?.n ?? 0) + 1 })); };
  return (
    <Panel title={<><MessageSquareText size={15} aria-hidden /> Ask Tresor</>} actions={<span className="ad-muted small">Answers from the records; facts shown underneath</span>} className="ad-copilot">
      <form className="ad-row" onSubmit={(e) => { e.preventDefault(); ask(question); }}>
        <input className="ad-input" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. What orders are at risk of missing their slot?" aria-label="Ask a question about the bakery" maxLength={400} />
        <button className="ad-btn ad-btn-primary ad-btn-sm" type="submit" aria-label="Ask"><ArrowUp size={14} /></button>
      </form>
      <div className="ad-starters">{(reply ? reply.result.followUps : STARTERS).map((s) => <button key={s} type="button" onClick={() => ask(s)}>{s}</button>)}</div>
      {reply && (
        <div className="ad-answer" aria-live="polite" aria-busy={model.state === 'loading'}>
          {model.state === 'loading' && <p className="ad-model-answer is-loading"><Sparkles size={13} aria-hidden /> Writing an answer from the records…</p>}
          {model.state === 'done' && (
            <div className="ad-model-answer">
              <p>{model.answer}</p>
              <p className="ad-muted small"><Sparkles size={12} aria-hidden /> Written by a language model ({model.model}{model.fallback ? ', a fallback because the main model was unavailable' : ''}) from the figures below. Demo data; check the facts before acting.</p>
            </div>
          )}
          {model.state === 'error' && <p className="ad-muted small">{model.note}</p>}
          <p className={model.state === 'done' ? 'ad-muted small' : undefined}>{model.state === 'done' ? `From the records: ${reply.result.answer}` : reply.result.answer}</p>
          {reply.result.facts.length > 0 && <dl className="ad-dl">{reply.result.facts.slice(0, 8).map((f) => <div key={f.label} style={{ display: 'contents' }}><dt>{f.label}</dt><dd>{/^TRS-\d+$/.test(f.label) ? <Link className="ad-link" href={`/admin/orders/${f.label}` as Route}>{f.value}</Link> : f.value}</dd></div>)}</dl>}
          {reply.result.actions.filter((a) => !handled.has(a.id) && a.level !== 'OBSERVE').slice(0, 3).map((a) => <ActionRow key={a.id} action={a} now={now} onDone={(id) => setHandled((h) => new Set(h).add(id))} />)}
          <p className="ad-muted small">{confidenceLabel(reply.confidence)} confidence · topic: {reply.result.topic}{reply.warnings[0] ? ` · ${reply.warnings[0]}` : ''}</p>
        </div>
      )}
    </Panel>
  );
}
