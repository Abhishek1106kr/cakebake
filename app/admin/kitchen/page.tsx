'use client';

import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useStore } from '@/components/store-provider';
import { useNow } from '@/components/admin/admin-utils';
import { NEXT_ACTION, Order, OrderStatus, minutesSince, prepTarget, statusTime } from '@/lib/orders';

const COLUMNS: { title: string; statuses: OrderStatus[] }[] = [
  { title: 'Incoming', statuses: ['NEW', 'CONFIRMED'] },
  { title: 'Preparing', statuses: ['PREPARING'] },
  { title: 'Ready', statuses: ['READY'] },
];

function Ticket({ order, now, onAdvance }: { order: Order; now: Date; onAdvance: () => void }) {
  const since = statusTime(order, order.status) ?? order.createdAt;
  const waited = minutesSince(since, now);
  const late = order.status === 'PREPARING' && waited > prepTarget(order);
  return (
    <motion.div layout layoutId={order.id} className={`ticket ${late ? 'late' : ''}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
      <div className="ticket-head"><strong>{order.id}</strong><span className="small">{waited} min{late ? ' · late' : ''}</span></div>
      <ul className="ticket-items">{order.items.map((line) => <li key={line.lineId}>{line.qty} × {line.product.name}{line.size === 'Large' ? ' (L)' : ''}</li>)}</ul>
      <div className="small muted">{order.customer.name} · target {prepTarget(order)} min</div>
      {NEXT_ACTION[order.status] && <motion.button whileTap={{ scale: 0.94 }} className="btn btn-primary btn-sm" onClick={onAdvance}>{NEXT_ACTION[order.status]}</motion.button>}
    </motion.div>
  );
}

export default function KitchenPage() {
  const { orders, advance, mounted } = useStore();
  const now = useNow(15000);
  if (!mounted) return <div className="page-loader" />;
  return (
    <div>
      <div className="admin-top">
        <div><div className="eyebrow">Kitchen display</div><h1 className="display admin-title">Make it, move it.</h1></div>
        <button className="btn btn-ghost" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}>Fullscreen</button>
      </div>
      <LayoutGroup><div className="kitchen-grid">
        {COLUMNS.map((column) => {
          const tickets = orders.filter((o) => column.statuses.includes(o.status)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          return (
            <section className="panel" key={column.title}>
              <div className="panel-head"><div className="eyebrow">{column.title}</div><motion.span key={tickets.length} initial={{ scale: 1.5 }} animate={{ scale: 1 }} className="chip-count">{tickets.length}</motion.span></div>
              <div className="ticket-list">
                <AnimatePresence mode="popLayout">{tickets.length === 0 ? <motion.p key="empty" className="muted small" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Nothing here.</motion.p> : tickets.map((o) => <Ticket key={o.id} order={o} now={now} onAdvance={() => advance(o.id)} />)}</AnimatePresence>
              </div>
            </section>
          );
        })}
      </div></LayoutGroup>
    </div>
  );
}
