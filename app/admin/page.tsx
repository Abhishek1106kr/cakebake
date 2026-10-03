'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, RotateCcw } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { StatusBadge, StockBadge, downloadCsv, rupees, todayStamp, useNow } from '@/components/admin/admin-utils';
import { NEXT_ACTION, isActive, isSameDay, itemsSummary, orderStats, ordersToCsv } from '@/lib/orders';
import { formatQty, stockState } from '@/lib/inventory';

function greeting(now: Date) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function AdminPage() {
  const { orders, inventory, advance, resetDemo, mounted } = useStore();
  const now = useNow();
  const [confirmReset, setConfirmReset] = useState(false);
  const stats = orderStats(orders, now);
  const live = orders.filter(isActive).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, 6);
  const low = inventory.filter((item) => stockState(item) !== 'Healthy').sort((a, b) => a.onHand / a.reorderPoint - b.onHand / b.reorderPoint);

  if (!mounted) return <div className="page-loader" />;

  return (
    <div>
      <div className="admin-top">
        <div>
          <div className="eyebrow">Command centre</div>
          <h1 className="display admin-title">{greeting(now)}, Tresor.</h1>
          <div className="muted">Here’s what the bakery looks like right now.</div>
        </div>
        <div className="admin-actions">
          <button className="btn btn-primary" onClick={() => downloadCsv(`tresor-orders-${todayStamp()}.csv`, ordersToCsv(orders.filter((o) => isSameDay(o.createdAt, now))))}>Export today <ArrowUpRight size={15} /></button>
          {confirmReset
            ? <button className="btn btn-danger" onClick={() => { resetDemo(); setConfirmReset(false); }}>Yes, reset demo data</button>
            : <button className="btn btn-ghost" onClick={() => setConfirmReset(true)}><RotateCcw size={15} /> Reset demo</button>}
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-meta">Today’s revenue</div><div className="kpi-value">{rupees(stats.revenue)}</div><div className="kpi-meta">{stats.cancelledToday ? `${stats.cancelledToday} cancelled, not counted` : 'Excludes cancelled orders'}</div></div>
        <div className="kpi"><div className="kpi-meta">Orders today</div><div className="kpi-value">{stats.count}</div><div className="kpi-meta">{stats.inKitchen} in the kitchen</div></div>
        <div className="kpi"><div className="kpi-meta">Avg. order value</div><div className="kpi-value">{rupees(stats.averageValue)}</div><div className="kpi-meta">{stats.ready} ready · {stats.onTheWay} on the way</div></div>
        <div className="kpi"><div className="kpi-meta">Stock alerts</div><div className="kpi-value">{low.length}</div><div className="kpi-meta">{low.length ? 'Needs attention today' : 'All shelves healthy'}</div></div>
      </div>

      <div className="admin-grid">
        <section className="panel">
          <div className="panel-head"><h2>Live orders</h2><Link href="/admin/orders" className="text-link">All orders</Link></div>
          {live.length === 0 ? <p className="muted">No active orders. Nice and calm.</p> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Status</th><th>Total</th><th /></tr></thead>
                <tbody>
                  {live.map((o) => (
                    <tr key={o.id}>
                      <td><strong>{o.id}</strong></td>
                      <td>{o.customer.name}</td>
                      <td className="cell-items">{itemsSummary(o)}</td>
                      <td><StatusBadge status={o.status} /></td>
                      <td>{rupees(o.total)}</td>
                      <td>{NEXT_ACTION[o.status] && <button className="btn btn-ghost btn-sm" onClick={() => advance(o.id)}>{NEXT_ACTION[o.status]}</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <aside className="panel">
          <div className="panel-head"><h2>Low stock</h2><Link href="/admin/inventory" className="text-link">Inventory</Link></div>
          {low.length === 0 ? <p className="muted">Nothing below its reorder point.</p> : low.map((item) => (
            <div key={item.id} className="summary-row">
              <div><strong>{item.name}</strong><div className="small muted">Reorder at {formatQty(item.reorderPoint, item.unit)}</div></div>
              <div className="stock-cell"><span>{formatQty(item.onHand, item.unit)}</span><StockBadge state={stockState(item)} /></div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
