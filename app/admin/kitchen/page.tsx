'use client';

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
    <div className={`ticket ${late ? 'late' : ''}`}>
      <div className="ticket-head"><strong>{order.id}</strong><span className="small">{waited} min{late ? ' · late' : ''}</span></div>
      <ul className="ticket-items">{order.items.map((line) => <li key={line.lineId}>{line.qty} × {line.product.name}{line.size === 'Large' ? ' (L)' : ''}</li>)}</ul>
      <div className="small muted">{order.customer.name} · target {prepTarget(order)} min</div>
      {NEXT_ACTION[order.status] && <button className="btn btn-primary btn-sm" onClick={onAdvance}>{NEXT_ACTION[order.status]}</button>}
    </div>
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
      <div className="kitchen-grid">
        {COLUMNS.map((column) => {
          const tickets = orders.filter((o) => column.statuses.includes(o.status)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          return (
            <section className="panel" key={column.title}>
              <div className="panel-head"><div className="eyebrow">{column.title}</div><span className="chip-count">{tickets.length}</span></div>
              <div className="ticket-list">
                {tickets.length === 0 ? <p className="muted small">Nothing here.</p> : tickets.map((o) => <Ticket key={o.id} order={o} now={now} onAdvance={() => advance(o.id)} />)}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
