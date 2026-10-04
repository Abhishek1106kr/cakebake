'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useState } from 'react';
import { CakeSlice, Maximize2, Pause, Play } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { useAdmin } from '@/components/admin/admin-provider';
import { useOrderActions } from '@/components/admin/order-actions';
import { specRows } from '@/components/admin/cake-spec';
import { Badge, Guard, PageHeader, PausedBadge, PriorityBadge, clock, dayLabel } from '@/components/admin/ui';
import { STATUS_LABEL, prepTarget, type Order, type OrderStatus } from '@/lib/orders';
import { dueState, hasCustom, minutesInStatus, priorityOf, requiredBy } from '@/lib/admin/order-ops';
import type { KitchenState } from '@/lib/admin/repositories';

const COLUMNS: { status: OrderStatus; title: string; hint: string }[] = [
  { status: 'NEW', title: 'New', hint: 'Waiting for confirmation' },
  { status: 'CONFIRMED', title: 'Confirmed', hint: 'Ready to start' },
  { status: 'PREPARING', title: 'Preparing', hint: 'In the kitchen' },
  { status: 'READY', title: 'Ready', hint: 'Boxed, waiting for the rider' },
];

const RANK = { URGENT: 0, HIGH: 1, NORMAL: 2 } as const;

export default function KitchenPage() {
  return <Guard permission="kitchen.view"><Kitchen /></Guard>;
}

function Kitchen() {
  const { orders } = useStore();
  const admin = useAdmin();
  const { now } = admin;
  const [customOnly, setCustomOnly] = useState(false);
  const board = orders.filter((o) => COLUMNS.some((c) => c.status === o.status) && (!customOnly || hasCustom(o)));

  return (
    <div>
      <PageHeader eyebrow="Kitchen display" title="Kitchen" description="Tickets sorted by urgency, then due time. Custom cakes carry their full spec."
        actions={<>
          <label className="ad-toggle"><input type="checkbox" checked={customOnly} onChange={(e) => setCustomOnly(e.target.checked)} /> Custom cakes only</label>
          <button type="button" className="ad-btn" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}><Maximize2 size={14} /> Fullscreen</button>
        </>} />
      {admin.settings?.['ordering.autoConfirm'] !== false && <p className="ad-muted small" style={{ margin: '-6px 0 12px' }}>Orders are auto-confirmed (Settings → Ordering), so New stays empty unless that is turned off.</p>}
      <div className="ad-board">
        {COLUMNS.map((col) => {
          const tickets = board.filter((o) => o.status === col.status).sort((a, b) => RANK[priorityOf(a, now)] - RANK[priorityOf(b, now)] || requiredBy(a).getTime() - requiredBy(b).getTime());
          return (
            <section key={col.status} className="ad-col" aria-labelledby={`col-${col.status}`}>
              <header><h2 id={`col-${col.status}`}>{col.title}</h2><span className="ad-chip-count">{tickets.length}</span><span className="ad-muted small">{col.hint}</span></header>
              <div className="ad-col-list">
                {tickets.length === 0 ? <p className="ad-muted small">Nothing here.</p> : tickets.map((o) => <Ticket key={o.id} order={o} state={admin.kitchen[o.id]} now={now} />)}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Ticket({ order, state, now }: { order: Order; state?: KitchenState; now: Date }) {
  const admin = useAdmin();
  const { advance } = useOrderActions();
  const custom = hasCustom(order);
  const p = priorityOf(order, now);
  const due = requiredBy(order);
  const pausedNow = state?.paused && state.pausedAt ? Math.floor((now.getTime() - Date.parse(state.pausedAt)) / 60000) : 0;
  const elapsed = Math.max(0, minutesInStatus(order, now) - (order.status === 'PREPARING' ? (state?.pausedMinutes ?? 0) + pausedNow : 0));
  const target = prepTarget(order);
  const over = order.status === 'PREPARING' && !custom && elapsed > target;
  const canUpdate = admin.can('kitchen.update');

  const setPaused = (paused: boolean) => admin.act({
    permission: 'kitchen.update', action: paused ? 'kitchen.paused' : 'kitchen.resumed', entity: { type: 'order', id: order.id }, before: { paused: !paused }, after: { paused },
    run: () => {
      const all = admin.repos!.kitchen.read();
      const cur = all[order.id] ?? { paused: false, pausedAt: null, pausedMinutes: 0, startedAt: null };
      const add = cur.paused && cur.pausedAt ? Math.floor((Date.now() - Date.parse(cur.pausedAt)) / 60000) : 0;
      admin.saveKitchen({ ...all, [order.id]: paused ? { ...cur, paused: true, pausedAt: new Date().toISOString() } : { ...cur, paused: false, pausedAt: null, pausedMinutes: cur.pausedMinutes + add } });
    },
    success: paused ? `${order.id} paused` : `${order.id} resumed`,
  });

  const step = (label: string) => <button type="button" className="ad-btn ad-btn-sm btn-sm ad-btn-primary" onClick={() => advance(order, 'kitchen.update')} disabled={!canUpdate || state?.paused}>{label}</button>;

  return (
    <article className={`ad-ticket ${custom ? 'is-custom' : ''} ${p === 'URGENT' ? 'is-urgent' : ''}`} aria-label={`${order.id}, ${STATUS_LABEL[order.status]}${custom ? ', custom cake' : ''}`}>
      <div className="ad-between">
        <Link href={`/admin/orders/${order.id}` as Route} className="ad-rowlink">{order.id}</Link>
        <span className="ad-row">{state?.paused && <PausedBadge />}{p !== 'NORMAL' && <PriorityBadge priority={p} due={dueState(order, now)} />}</span>
      </div>
      <div className="ad-ticket-meta">
        <span>Due <strong>{dayLabel(due, now)} {clock(due)}</strong></span>
        <span className={over ? 'ad-over' : ''}>{elapsed} min{order.status === 'PREPARING' && !custom ? ` / ${target}` : ''}{over ? ' · over' : ''}</span>
      </div>
      <div className="ad-muted small">{order.customer.name}</div>
      <ul className="ad-ticket-items">
        {order.items.map((l) => <li key={l.lineId}><strong>{l.qty} ×</strong> {l.custom ? <><CakeSlice size={12} aria-hidden /> {l.custom.title}</> : `${l.product.name}${l.size === 'Large' ? ' (L)' : ''}`}</li>)}
      </ul>
      {order.items.filter((l) => l.custom).map((l) => (
        <div key={l.lineId} className="ad-ticket-spec">
          <Badge tone="info" icon={<CakeSlice size={12} aria-hidden />}>Custom cake · {l.custom!.productionHours} h</Badge>
          <dl>{specRows(l, { compact: true }).filter((r) => r.label !== 'Production time').map((r) => <div key={r.label}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}</dl>
          {(admin.notes[`${order.id}:${l.lineId}`] ?? []).length > 0 && <p className="ad-ticket-note"><strong>Production notes:</strong> {admin.notes[`${order.id}:${l.lineId}`].map((n) => n.text).join(' · ')}</p>}
          <Link className="ad-link small" href={`/admin/custom-cakes?order=${order.id}` as Route}>Full production sheet →</Link>
        </div>
      ))}
      {canUpdate && (
        <div className="ad-ticket-actions">
          {order.status === 'NEW' && step('Confirm')}
          {order.status === 'CONFIRMED' && step('Start')}
          {order.status === 'PREPARING' && (state?.paused
            ? <button type="button" className="ad-btn ad-btn-sm" onClick={() => setPaused(false)}><Play size={12} /> Resume</button>
            : <><button type="button" className="ad-btn ad-btn-sm" onClick={() => setPaused(true)}><Pause size={12} /> Pause</button>{step('Ready')}</>)}
          {order.status === 'READY' && admin.can('orders.update') && <button type="button" className="ad-btn ad-btn-sm btn-sm" onClick={() => advance(order)}>Hand to rider</button>}
        </div>
      )}
    </article>
  );
}
