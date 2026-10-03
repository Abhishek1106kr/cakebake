'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { StatusBadge, clock, downloadCsv, rupees, todayStamp } from '@/components/admin/admin-utils';
import { NEXT_ACTION, OrderFilter, canCancel, filterOrders, itemsSummary, ordersToCsv } from '@/lib/orders';

const FILTERS: { id: OrderFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'CONFIRMED', label: 'New' },
  { id: 'PREPARING', label: 'Preparing' },
  { id: 'READY', label: 'Ready' },
  { id: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { id: 'DELIVERED', label: 'Delivered' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

export default function OrdersAdmin() {
  const { orders, advance, cancel, mounted } = useStore();
  const [filter, setFilter] = useState<OrderFilter>('ACTIVE');
  const [query, setQuery] = useState('');
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const shown = filterOrders(orders, filter, query);

  if (!mounted) return <div className="page-loader" />;

  return (
    <div>
      <div className="admin-top">
        <div><div className="eyebrow">Operations</div><h1 className="display admin-title">Orders</h1></div>
        <div className="admin-actions">
          <button className="btn btn-ghost" onClick={() => downloadCsv(`tresor-orders-${todayStamp()}.csv`, ordersToCsv(shown))}>Export view <ArrowUpRight size={15} /></button>
          <Link className="btn btn-primary" href="/shop">New order</Link>
        </div>
      </div>
      <div className="panel">
        <div className="admin-toolbar">
          <div className="filters" role="group" aria-label="Filter orders">
            {FILTERS.map((f) => {
              const count = filterOrders(orders, f.id, '').length;
              return <button key={f.id} className={`chip ${filter === f.id ? 'active' : ''}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label} <span className="chip-count">{count}</span></button>;
            })}
          </div>
          <input className="admin-search" placeholder="Search order, customer or phone" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search orders" />
        </div>
        {shown.length === 0 ? <p className="muted empty-row">No orders match.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Status</th><th>Payment</th><th>Total</th><th>Placed</th><th /></tr></thead>
              <tbody>
                {shown.map((o) => (
                  <tr key={o.id}>
                    <td><strong>{o.id}</strong>{o.source === 'sample' && <div className="small muted">sample</div>}</td>
                    <td>{o.customer.name}<div className="small muted">{o.customer.phone}</div></td>
                    <td className="cell-items">{itemsSummary(o)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td>{o.paymentMethod}<div className="small muted">{o.paymentStatus.toLowerCase()}</div></td>
                    <td>{rupees(o.total)}</td>
                    <td>{clock(o.createdAt)}</td>
                    <td className="cell-actions">
                      {NEXT_ACTION[o.status] && <button className="btn btn-ghost btn-sm" onClick={() => advance(o.id)}>{NEXT_ACTION[o.status]}</button>}
                      {canCancel(o) && (confirmCancel === o.id
                        ? <button className="btn btn-danger btn-sm" onClick={() => { cancel(o.id); setConfirmCancel(null); }}>Confirm cancel</button>
                        : <button className="btn btn-link btn-sm" onClick={() => setConfirmCancel(o.id)}>Cancel</button>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
