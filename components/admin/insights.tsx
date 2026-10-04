'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { products } from '@/lib/data';
import { eventBus, generateInsights, type Insight, type TresorEvent } from '@/engine/intelligence';
import { track } from '@/engine/intelligence/events/track';
import { useStore } from '@/components/store-provider';
import { confidenceLabel } from '@/engine/intelligence';

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

export function useInsights(now: Date) {
  const { orders, inventory } = useStore();
  const events = useEvents();
  // Recompute when data changes or the minute ticks over, not on every render.
  const minute = Math.floor(now.getTime() / 60000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => generateInsights({ orders, inventory, events, products, now }), [orders, inventory, events, minute]);
}

const SEVERITY_LABEL = { act: 'Act now', watch: 'Keep an eye', info: 'Good to know' } as const;

function InsightCard({ insight }: { insight: Insight }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.li layout className={`insight insight-${insight.severity}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
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
    </motion.li>
  );
}

export function InsightsPanel({ now, limit = 4 }: { now: Date; limit?: number }) {
  const insights = useInsights(now);
  const list = insights.result.slice(0, limit);
  return (
    <section className="panel insights-panel">
      <div className="panel-head"><h2>What needs you</h2><Link href="/admin/analytics" className="text-link">All insights</Link></div>
      {list.length === 0 ? <p className="muted">Nothing needs attention right now.</p> : (
        <ul className="insight-list"><AnimatePresence initial={false}>{list.map((i) => <InsightCard key={i.id} insight={i} />)}</AnimatePresence></ul>
      )}
      {insights.warnings.length > 0 && <p className="insight-footnote">{insights.warnings[0].charAt(0).toUpperCase() + insights.warnings[0].slice(1)}.</p>}
    </section>
  );
}

export function InsightList({ now }: { now: Date }) {
  const insights = useInsights(now);
  return insights.result.length === 0
    ? <p className="muted">Nothing needs attention right now.</p>
    : <ul className="insight-list insight-list-wide"><AnimatePresence initial={false}>{insights.result.map((i) => <InsightCard key={i.id} insight={i} />)}</AnimatePresence></ul>;
}
