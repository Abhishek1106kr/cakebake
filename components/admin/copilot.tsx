'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, MessageSquareText } from 'lucide-react';
import { products } from '@/lib/data';
import { askCopilot, confidenceLabel, type CopilotAnswer, type IntelligenceResult } from '@/engine/intelligence';
import { useStore } from '@/components/store-provider';
import { ActionControls, useEvents, useInsights } from './insights';

const STARTERS = ['What needs my attention?', 'How are sales today?', 'What’s running low?', 'What did people search for and not find?'];

/** Ask the bakery a question in plain words. Answers come from the engine's numbers, with the facts shown. */
export function CopilotPanel({ now }: { now: Date }) {
  const { orders, inventory } = useStore();
  const events = useEvents();
  const { approve, dismiss } = useInsights(now);
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const [handled, setHandled] = useState<Set<string>>(new Set());

  const reply: IntelligenceResult<CopilotAnswer> | null = useMemo(
    () => (asked === null ? null : askCopilot(asked, { orders, inventory, events, products, now })),
    // Re-answer when the data changes so numbers stay live; not on every clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [asked, orders, inventory, events],
  );

  const ask = (q: string) => { setQuestion(q); setAsked(q); };

  return (
    <section className="panel copilot">
      <div className="panel-head"><h2><MessageSquareText size={17} /> Ask Tresor</h2><span className="small muted">Answers come from today’s orders, stock and visits</span></div>
      <form className="copilot-form" onSubmit={(e) => { e.preventDefault(); ask(question.trim()); }}>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="How long will the milk last?" aria-label="Ask a question about the bakery" />
        <button className="btn btn-brand btn-sm" type="submit" aria-label="Ask"><ArrowUp size={15} /></button>
      </form>
      {!reply && <div className="copilot-starters">{STARTERS.map((s) => <button key={s} onClick={() => ask(s)}>{s}</button>)}</div>}
      <AnimatePresence mode="wait">
        {reply && (
          <motion.div key={`${asked}|${reply.result.answer}`} className="copilot-answer" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <p className="copilot-text">{reply.result.answer}</p>
            {reply.result.facts.length > 0 && (
              <dl className="copilot-facts">{reply.result.facts.slice(0, 8).map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>
            )}
            {reply.result.actions.filter((a) => !handled.has(a.id)).slice(0, 3).map((a) => (
              <ActionControls key={a.id} action={a}
                onApprove={(x) => { const r = approve(x); if (r.ok) setHandled((h) => new Set(h).add(x.id)); return r; }}
                onDismiss={(x) => { dismiss(x); setHandled((h) => new Set(h).add(x.id)); }} />
            ))}
            <div className="copilot-meta">
              <span>{confidenceLabel(reply.confidence)} confidence</span>
              {reply.warnings[0] && <span>· {reply.warnings[0]}</span>}
            </div>
            <div className="copilot-starters">{reply.result.followUps.map((s) => <button key={s} onClick={() => ask(s)}>{s}</button>)}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
