'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useMemo, useState } from 'react';
import { Download, Lock, Printer } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { useAdmin } from '@/components/admin/admin-provider';
import { useOrderActions } from '@/components/admin/order-actions';
import { specRows, useAsset } from '@/components/admin/cake-spec';
import { CakePreview } from '@/components/cake-studio/preview';
import { Empty, Guard, OrderStatusBadge, PageHeader, Panel, PriorityBadge, Tabs, clock, dateTime, dayLabel, rupees, useUrlParam } from '@/components/admin/ui';
import { STATUS_LABEL, isActive, statusTime, type CartLine, type Order } from '@/lib/orders';
import { customHours, dueState, priorityOf, requiredBy } from '@/lib/admin/order-ops';

type Job = { key: string; order: Order; line: CartLine };
type View = 'ALL' | 'TODAY' | 'UPCOMING' | 'IN_PRODUCTION' | 'READY' | 'COMPLETED' | 'URGENT';
const VIEWS: { id: View; label: string }[] = [
  { id: 'ALL', label: 'All' }, { id: 'URGENT', label: 'Urgent' }, { id: 'TODAY', label: 'Today' }, { id: 'UPCOMING', label: 'Upcoming' },
  { id: 'IN_PRODUCTION', label: 'In production' }, { id: 'READY', label: 'Ready' }, { id: 'COMPLETED', label: 'Completed' },
];

function inView(j: Job, v: View, now: Date): boolean {
  const o = j.order;
  const due = requiredBy(o);
  switch (v) {
    case 'ALL': return true;
    case 'TODAY': return o.status !== 'CANCELLED' && due.toDateString() === now.toDateString();
    case 'UPCOMING': return isActive(o) && due > now && due.toDateString() !== now.toDateString();
    case 'IN_PRODUCTION': return o.status === 'PREPARING';
    case 'READY': return o.status === 'READY';
    case 'COMPLETED': return o.status === 'OUT_FOR_DELIVERY' || o.status === 'DELIVERED';
    case 'URGENT': return isActive(o) && priorityOf(o, now) === 'URGENT';
  }
}

export default function CustomCakesPage() {
  return <Guard permission="customCakes.view"><CustomCakes /></Guard>;
}

function CustomCakes() {
  const { orders } = useStore();
  const { now } = useAdmin();
  const [view, setView] = useUrlParam('view', 'ALL');
  const [orderParam, setOrderParam] = useUrlParam('order', '');
  const [selected, setSelected] = useState<string | null>(null);
  const v = (VIEWS.some((x) => x.id === view) ? view : 'ALL') as View;

  const jobs = useMemo<Job[]>(() => orders.flatMap((order) => order.items.filter((l) => l.custom).map((line) => ({ key: `${order.id}:${line.lineId}`, order, line })))
    // Active first by due time; finished and cancelled after, newest first.
    .sort((a, b) => Number(!isActive(a.order)) - Number(!isActive(b.order)) || (isActive(a.order) ? requiredBy(a.order).getTime() - requiredBy(b.order).getTime() : b.order.createdAt.localeCompare(a.order.createdAt))), [orders]);
  const shown = jobs.filter((j) => inView(j, v, now));
  const counts = Object.fromEntries(VIEWS.map((x) => [x.id, jobs.filter((j) => inView(j, x.id, now)).length])) as Record<View, number>;
  useEffect(() => { if (orderParam) { const j = jobs.find((x) => x.order.id === orderParam); if (j) setSelected(j.key); } }, [orderParam, jobs]);
  const current = shown.find((j) => j.key === selected) ?? jobs.find((j) => j.key === selected) ?? shown[0];

  return (
    <div>
      <PageHeader eyebrow="Production" title="Custom cakes" description="Every custom order with its full specification, message, print artwork and the kitchen’s notes. Start-by times count production hours back from the slot." />
      <Tabs label="Custom cake views" items={VIEWS.map((x) => ({ ...x, count: counts[x.id] }))} value={v} onChange={(x) => setView(x)} />
      {jobs.length === 0 ? (
        <Panel><Empty>No custom cake orders yet. They appear here as soon as one is placed from the Cake Playground.</Empty></Panel>
      ) : (
        <div className="cc-grid ad-cc">
          <section className="ad-panel cc-list" aria-label="Custom cake jobs">
            {shown.length === 0 ? <Empty>Nothing in this view.</Empty> : shown.map((j) => {
              const due = requiredBy(j.order);
              const startBy = new Date(due.getTime() - customHours(j.order) * 3600000);
              const p = priorityOf(j.order, now);
              return (
                <button key={j.key} type="button" className={`cc-item ${current?.key === j.key ? 'is-active' : ''}`} aria-pressed={current?.key === j.key} onClick={() => { setSelected(j.key); setOrderParam(j.order.id); }}>
                  <CakePreview config={j.line.custom!.config} className="cc-thumb" />
                  <span className="cc-item-text">
                    <strong>{j.line.custom!.title}{j.line.qty > 1 ? ` ×${j.line.qty}` : ''}</strong>
                    <small>{j.order.id} · {j.order.customer.name}</small>
                    <small>Due {dayLabel(due, now)} {clock(due)}{isActive(j.order) && j.order.status !== 'READY' && j.order.status !== 'PREPARING' ? ` · start by ${dayLabel(startBy, now)} ${clock(startBy)}` : ''}</small>
                  </span>
                  <span className="cc-item-badges"><OrderStatusBadge status={j.order.status} />{p !== 'NORMAL' && isActive(j.order) && <PriorityBadge priority={p} due={dueState(j.order, now)} />}</span>
                </button>
              );
            })}
          </section>
          <section className="ad-panel">{current && <Sheet job={current} />}</section>
        </div>
      )}
    </div>
  );
}

/** The bakery's production sheet for one custom cake. Prints cleanly. */
function Sheet({ job }: { job: Job }) {
  const admin = useAdmin();
  const { advance } = useOrderActions();
  const spec = job.line.custom!;
  const c = spec.config;
  const artwork = useAsset(spec.artworkAssetId);
  const photo = useAsset(spec.printAssetId);
  const [note, setNote] = useState('');
  const notes = admin.notes[job.key] ?? [];
  const due = requiredBy(job.order);
  const startBy = new Date(due.getTime() - spec.productionHours * 3600000);
  const canStep = admin.can('customCakes.update') && ['NEW', 'CONFIRMED', 'PREPARING'].includes(job.order.status);
  const nextLabel = { NEW: 'Confirm order', CONFIRMED: 'Start production', PREPARING: 'Mark ready' }[job.order.status as 'NEW' | 'CONFIRMED' | 'PREPARING'];

  return (
    <div className="cc-spec">
      <div className="ad-between ad-sheet-head">
        <div>
          <h2 className="ad-sheet-title">{spec.title}{job.line.qty > 1 ? ` ×${job.line.qty}` : ''}</h2>
          <div className="ad-row ad-muted small"><Link className="ad-link" href={`/admin/orders/${job.order.id}` as Route}>{job.order.id}</Link> · {job.order.customer.name} · <OrderStatusBadge status={job.order.status} /></div>
        </div>
        <div className="ad-row ad-no-print">
          {canStep && <button type="button" className="ad-btn ad-btn-sm btn-sm ad-btn-primary" onClick={() => advance(job.order, 'customCakes.update')}>{nextLabel}</button>}
          <button type="button" className="ad-btn ad-btn-sm" onClick={() => window.print()}><Printer size={13} /> Print sheet</button>
        </div>
      </div>
      <dl className="ad-dl ad-sheet-dates">
        <dt>Due</dt><dd><strong>{dayLabel(due, admin.now)} · {clock(due)}</strong> · slot {job.order.slot}</dd>
        <dt>Start by</dt><dd>{dayLabel(startBy, admin.now)} · {clock(startBy)} ({spec.productionHours} h production)</dd>
        {statusTime(job.order, 'PREPARING') && <><dt>Started</dt><dd>{dateTime(statusTime(job.order, 'PREPARING')!)}</dd></>}
      </dl>
      <div className="cc-previews">
        <div><CakePreview config={c} view="front" /><span>Side</span></div>
        <div><CakePreview config={c} view="top" printUrl={photo} /><span>Top</span></div>
      </div>
      <dl className="cc-table">
        <div className="spec-row"><dt>Design</dt><dd className="ad-mono">{spec.designId}</dd></div>
        <div className="spec-row"><dt>Order</dt><dd>{job.order.id} · {job.order.slot}</dd></div>
        <div className="spec-row"><dt>Quantity</dt><dd>{job.line.qty}</dd></div>
        {specRows(job.line).map((r) => <div key={r.label} className="spec-row"><dt>{r.label}</dt><dd>{r.value}</dd></div>)}
        <div className="spec-row"><dt>Price</dt><dd>{rupees(job.line.unitPrice)} <span className="ad-muted">(snapshot, {spec.priceVersion})</span></dd></div>
      </dl>
      {c.print.enabled && (
        <div className="cc-artwork">
          {artwork ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={artwork} alt="Print artwork for this cake" />
              <a className="ad-btn ad-btn-sm ad-btn-primary" href={artwork} download={`${spec.designId}-print.png`}><Download size={13} /> Print artwork (PNG, 300 dpi)</a>
            </>
          ) : <p className="ad-muted small">Print artwork is stored in the browser where the order was placed. Open this order there to download it.</p>}
        </div>
      )}
      <div className="ad-internal">
        <h3 className="ad-section-title"><Lock size={12} aria-hidden /> Production notes · staff only</h3>
        <p className="ad-muted small">Kept apart from the order record: never shown on invoices, tracking or any customer page.</p>
        {notes.length === 0 ? <p className="ad-muted small">No notes yet.</p> : (
          <ul className="ad-lines">{notes.map((n) => <li key={n.id}><span>{n.text}</span><span className="ad-muted small">{n.by} · {dateTime(n.at)}</span></li>)}</ul>
        )}
        {admin.can('customCakes.notes') && (
          <form className="ad-row ad-no-print" style={{ marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); if (admin.addNote(job.key, note).ok) setNote(''); }}>
            <input className="ad-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Use the 8-inch ring; topper arrives 3 pm" aria-label="Add a production note" maxLength={500} />
            <button type="submit" className="ad-btn ad-btn-sm" disabled={!note.trim()}>Add note</button>
          </form>
        )}
      </div>
      <p className="ad-muted small ad-no-print">Status: {STATUS_LABEL[job.order.status]}. Moving the cake here updates the order, the kitchen board and the customer’s tracking page.</p>
    </div>
  );
}

