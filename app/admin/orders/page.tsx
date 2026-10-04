'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, ExternalLink } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { useAdmin } from '@/components/admin/admin-provider';
import { AdvanceButton, useOrderActions } from '@/components/admin/order-actions';
import { OrderDetail } from '@/components/admin/order-detail';
import { Badge, Chips, Drawer, Empty, Guard, OrderStatusBadge, PageHeader, Pager, Panel, PaymentBadge, PriorityBadge, SearchField, ago, clock, dayLabel, rupees, useUrlParam } from '@/components/admin/ui';
import { ORDER_FILTERS, ORDER_SORTS, dueState, filterCounts, hasCustom, ordersCsvRows, paginate, priorityOf, queryOrders, requiredBy, type AdminOrderFilter, type OrderSort } from '@/lib/admin/order-ops';
import { toCsv, downloadText, stamp } from '@/lib/admin/csv';
import { canCancel } from '@/lib/orders';

const PAGE = 25;

export default function OrdersPage() {
  return <Guard permission="orders.view"><Orders /></Guard>;
}

function Orders() {
  const { orders } = useStore();
  const admin = useAdmin();
  const { now } = admin;
  const { bulk, cancel } = useOrderActions();
  const [filter, setFilter] = useUrlParam('filter', 'ACTIVE');
  const [query, setQuery] = useUrlParam('q', '');
  const [sort, setSort] = useUrlParam('sort', 'newest');
  const [open, setOpen] = useUrlParam('o', '');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const f = (ORDER_FILTERS.some((x) => x.id === filter) ? filter : 'ACTIVE') as AdminOrderFilter;
  const s = (ORDER_SORTS.some((x) => x.id === sort) ? sort : 'newest') as OrderSort;
  const shown = useMemo(() => queryOrders(orders, { filter: f, query, sort: s, now }), [orders, f, query, s, now]);
  const counts = useMemo(() => filterCounts(orders, now), [orders, now]);
  const paged = paginate(shown, page, PAGE);
  useEffect(() => { setPage(1); }, [f, query, s]);
  // Drop selections that left the view (status changed, filtered out).
  useEffect(() => { setSelected((cur) => new Set([...cur].filter((id) => shown.some((o) => o.id === id)))); }, [shown]);
  const detail = open ? orders.find((o) => o.id === open) : undefined;
  const allOnPage = paged.items.length > 0 && paged.items.every((o) => selected.has(o.id));
  const toggle = (id: string) => setSelected((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const exportRows = (list: typeof shown, label: string) => downloadText(`tresor-orders-${label}-${stamp()}.csv`, toCsv(ordersCsvRows(list, now)));

  return (
    <div>
      <PageHeader eyebrow="Operations" title="Orders" description="Every order from the shop, live. Click a row for the full record; the first button moves it to its next step."
        actions={admin.can('orders.export') && <button type="button" className="ad-btn" onClick={() => exportRows(shown, f.toLowerCase())}>Export view ({shown.length}) <ArrowUpRight size={14} /></button>} />

      <Panel>
        <div className="ad-toolbar">
          <Chips label="Filter orders" items={ORDER_FILTERS} value={f} onChange={(v) => setFilter(v)} counts={counts} />
        </div>
        <div className="ad-toolbar">
          <label className="ad-row small"><span className="ad-muted">Sort</span>
            <select className="ad-select" value={s} onChange={(e) => setSort(e.target.value)} aria-label="Sort orders">{ORDER_SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
          </label>
          <SearchField value={query} onChange={setQuery} placeholder="Order, name, phone, email, product, custom cake" label="Search orders" />
        </div>

        {selected.size > 0 && (
          <div className="ad-bulkbar" role="region" aria-label="Bulk actions">
            <strong>{selected.size} selected</strong>
            {admin.can('orders.update') && <button type="button" className="ad-btn ad-btn-sm" onClick={() => bulk([...selected], 'confirm')}>Confirm</button>}
            {admin.can('orders.update') && <button type="button" className="ad-btn ad-btn-sm" onClick={() => bulk([...selected], 'ready')}>Mark ready</button>}
            {admin.can('orders.export') && <button type="button" className="ad-btn ad-btn-sm" onClick={() => exportRows(shown.filter((o) => selected.has(o.id)), 'selected')}>Export</button>}
            <button type="button" className="ad-btn ad-btn-sm ad-btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}

        {shown.length === 0 ? (
          <Empty>{f === 'PAYMENT_FAILED' ? 'No orders with a failed payment. In this prototype a failed payment never creates an order; failed attempts are counted under Analytics → Payments.' : query ? `No orders match “${query}”.` : 'No orders here.'}</Empty>
        ) : (
          <div className="ad-table-wrap">
            <table className="table ad-cards ad-orders">
              <thead>
                <tr>
                  <th><input type="checkbox" className="ad-check" checked={allOnPage} onChange={() => setSelected((cur) => { const n = new Set(cur); paged.items.forEach((o) => (allOnPage ? n.delete(o.id) : n.add(o.id))); return n; })} aria-label="Select all orders on this page" /></th>
                  <th>Order</th><th>Customer</th><th>Items</th><th>Payment</th><th>Status</th><th>Fulfilment</th><th className="num">Total</th><th>Placed</th><th>Required by</th><th />
                </tr>
              </thead>
              <tbody>
                {paged.items.map((o) => {
                  const p = priorityOf(o, now);
                  const due = requiredBy(o);
                  return (
                    <tr key={o.id} className={`${selected.has(o.id) ? 'is-selected' : ''} ${p === 'URGENT' ? 'is-urgent' : ''}`}>
                      <td data-label=""><input type="checkbox" className="ad-check" checked={selected.has(o.id)} onChange={() => toggle(o.id)} aria-label={`Select ${o.id}`} /></td>
                      <td data-label="Order"><button type="button" className="ad-link ad-rowlink" onClick={() => setOpen(o.id)}>{o.id}</button>{o.source === 'sample' && <span className="ad-sub">sample</span>}</td>
                      <td data-label="Customer">{o.customer.name}<span className="ad-sub">{admin.can('customers.pii') ? o.customer.phone : `•••••• ${o.customer.phone.slice(-4)}`}</span></td>
                      <td data-label="Items" className="cell-items">{o.items.map((l) => `${l.qty} × ${l.product.name}`).join(', ')}{hasCustom(o) && <> <Badge tone="info">Custom cake</Badge></>}</td>
                      <td data-label="Payment">{o.paymentMethod}<span className="ad-sub"><PaymentBadge status={o.paymentStatus} /></span></td>
                      <td data-label="Status"><OrderStatusBadge status={o.status} /></td>
                      <td data-label="Fulfilment">Delivery<span className="ad-sub">{o.slot}</span></td>
                      <td data-label="Total" className="num">{rupees(o.total)}</td>
                      <td data-label="Placed">{clock(o.createdAt)}<span className="ad-sub">{ago(o.createdAt, now)}</span></td>
                      <td data-label="Required by">{dayLabel(due, now)} {clock(due)}{p !== 'NORMAL' && <span className="ad-sub"><PriorityBadge priority={p} due={dueState(o, now)} /></span>}</td>
                      <td data-label="" className="cell-actions">
                        <AdvanceButton order={o} />
                        {canCancel(o) && admin.can('orders.cancel') && <button type="button" className="ad-btn ad-btn-sm ad-btn-ghost ad-btn-quiet-danger" onClick={() => cancel(o)}>Cancel</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={paged.page} pages={paged.pages} total={paged.total} onPage={setPage} label="orders" />
      </Panel>

      <Drawer open={Boolean(detail)} onClose={() => setOpen('')} wide title={detail ? `Order ${detail.id}` : ''}
        subtitle={detail && <>{detail.customer.name} · {rupees(detail.total)} · <Link className="ad-link" href={`/admin/orders/${detail.id}` as Route}>Open full page <ExternalLink size={12} /></Link></>}>
        {detail && <OrderDetail order={detail} />}
      </Drawer>
    </div>
  );
}
