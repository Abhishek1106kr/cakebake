'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useMemo } from 'react';
import { AlertOctagon, AlertTriangle, ArrowUpRight, CheckCircle2, Info, RotateCcw } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { useAdmin } from '@/components/admin/admin-provider';
import { useInsights } from '@/components/admin/insights';
import { AdvanceButton } from '@/components/admin/order-actions';
import { Badge, Empty, Guard, Kpi, OrderStatusBadge, PageHeader, Panel, PriorityBadge, StockBadge, ago, clock, dayLabel, rupees } from '@/components/admin/ui';
import { isActive, isSameDay, orderStats, statusTime, type OrderStatus } from '@/lib/orders';
import { availableQty, stockLevel } from '@/lib/inventory';
import { dueState, hasCustom, ordersCsvRows, priorityOf, requiredBy } from '@/lib/admin/order-ops';
import { toCsv, downloadText, stamp } from '@/lib/admin/csv';
import { stockOutlook, confidenceLabel } from '@/engine/intelligence';

const greeting = (d: Date) => (d.getHours() < 12 ? 'Good morning' : d.getHours() < 17 ? 'Good afternoon' : 'Good evening');
const SEV_ICON = { critical: <AlertOctagon size={15} aria-hidden />, warning: <AlertTriangle size={15} aria-hidden />, info: <Info size={15} aria-hidden /> };

export default function CommandCenter() {
  return <Guard permission="overview.view"><Overview /></Guard>;
}

function Overview() {
  const { orders, inventory, resetDemo } = useStore();
  const admin = useAdmin();
  const { now } = admin;
  const stats = orderStats(orders, now);
  const { visible } = useInsights(now);

  const today = orders.filter((o) => isSameDay(o.createdAt, now));
  const customActive = orders.filter((o) => isActive(o) && hasCustom(o));
  const customDoneToday = orders.filter((o) => hasCustom(o) && (o.status === 'READY' || o.status === 'OUT_FOR_DELIVERY' || o.status === 'DELIVERED') && isSameDay(statusTime(o, 'READY') ?? '', now)).length;
  const lowStock = inventory.filter((i) => stockLevel(i) !== 'HEALTHY');
  const failedJobs = admin.automation.jobs.filter((j) => j.status === 'failed');
  const urgent = orders.filter((o) => isActive(o) && priorityOf(o, now) === 'URGENT');
  const count = (s: OrderStatus) => orders.filter((o) => o.status === s).length;
  // Live stream: newest first, so a new order appears at the top without a refresh.
  const live = orders.filter(isActive).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
  const outlook = useMemo(() => stockOutlook(inventory, orders, now), [inventory, orders, now]);
  const cover = new Map(outlook.result.map((r) => [r.ingredientId, r.daysOfCover]));
  const recentlyNew = admin.lastDomainEvent?.type === 'order.created' ? admin.lastDomainEvent.entityId : null;

  const reset = async () => {
    const r = await admin.confirm({ title: 'Reset all demo orders and stock?', impact: ['Every order in this browser is replaced by the six sample orders.', 'Ingredient stock returns to its starting levels.', 'Catalogue, settings, staff and the audit log are kept.'], confirmLabel: 'Reset demo data', tone: 'danger', reason: 'required' });
    if (r.ok) admin.act({ permission: 'settings.edit', action: 'demo.reset', entity: { type: 'settings', id: 'demo-data' }, before: { orders: orders.length }, after: { orders: 6 }, reason: r.reason, run: () => resetDemo(), success: 'Demo data reset' });
  };

  return (
    <div>
      <PageHeader eyebrow="Command centre" title={`${greeting(now)}, Tresor.`}
        description={`${now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · what’s happening, what needs you, what’s next.`}
        actions={<>
          {admin.can('orders.export') && <button type="button" className="ad-btn" onClick={() => downloadText(`tresor-orders-${stamp()}.csv`, toCsv(ordersCsvRows(today, now)))}>Export today <ArrowUpRight size={14} /></button>}
          {admin.can('settings.edit') && <button type="button" className="ad-btn ad-btn-ghost" onClick={reset}><RotateCcw size={14} /> Reset demo</button>}
        </>} />

      <div className="ad-kpis" aria-label="Today">
        <Kpi label="Revenue today" value={rupees(stats.revenue)} meta={stats.cancelledToday ? `${stats.cancelledToday} cancelled, not counted` : 'Cancelled orders excluded'} href="/admin/analytics" />
        <Kpi label="Orders today" value={stats.count} meta={`${today.filter((o) => o.source === 'online').length} from the shop`} href="/admin/orders?filter=ALL" />
        <Kpi label="Average order" value={rupees(stats.averageValue)} />
        <Kpi label="Active" value={orders.filter(isActive).length} meta={`${stats.inKitchen} in the kitchen`} href="/admin/orders" />
        <Kpi label="Ready" value={count('READY')} href="/admin/orders?filter=READY" tone={count('READY') ? 'ok' : undefined} />
        <Kpi label="Out for delivery" value={count('OUT_FOR_DELIVERY')} href="/admin/orders?filter=OUT_FOR_DELIVERY" />
        <Kpi label="Custom cakes" value={customActive.length} meta={`${customDoneToday} finished today`} href="/admin/custom-cakes" />
        <Kpi label="Urgent" value={urgent.length} tone={urgent.length ? 'bad' : undefined} meta={urgent.length ? 'Late or at risk' : 'Everything on track'} href="/admin/orders?filter=URGENT" />
        <Kpi label="Low stock" value={lowStock.length} tone={lowStock.some((i) => stockLevel(i) !== 'LOW') ? 'bad' : lowStock.length ? 'warn' : undefined} href="/admin/inventory?level=attention" />
        <Kpi label="Failed automations" value={failedJobs.length} tone={failedJobs.length ? 'bad' : undefined} href="/admin/automations?filter=FAILED" />
      </div>

      <div className="ad-grid-2">
        <Panel title="Needs attention" id="attention" actions={<span className="ad-muted small">{admin.attention.length} open</span>}>
          {admin.attention.length === 0 ? <Empty>All clear. Nothing needs you right now.</Empty> : (
            <ul className="ad-attn">
              {admin.attention.slice(0, 7).map((a) => (
                <li key={a.id} className={`ad-sev-${a.severity}`}>
                  <Link href={a.href as Route} onClick={() => admin.setAttentionState([a.id], 'READ')}>
                    <span className="ad-sev-icon">{SEV_ICON[a.severity]}</span>
                    <span><strong>{a.title}</strong><span className="ad-sub">{a.detail}</span></span>
                    <span className="ad-sub">{ago(a.at, now)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {customDoneToday > 0 && <p className="ad-row small" style={{ marginTop: 10, color: 'var(--ad-ok)' }}><CheckCircle2 size={14} aria-hidden /> {customDoneToday} custom cake{customDoneToday === 1 ? '' : 's'} completed today</p>}
        </Panel>

        <Panel title="Live kitchen" id="kitchen" actions={<Link className="ad-link" href="/admin/kitchen">Kitchen board</Link>}>
          <div className="ad-kitchen-counts">
            {(['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] as OrderStatus[]).map((s) => (
              <Link key={s} href={`/admin/orders?filter=${s}` as Route}><span>{s === 'OUT_FOR_DELIVERY' ? 'Out' : s.charAt(0) + s.slice(1).toLowerCase()}</span><strong>{count(s)}</strong></Link>
            ))}
          </div>
          <div className="ad-section-title">Stock to watch</div>
          {lowStock.length === 0 ? <p className="ad-muted small">Every ingredient is above its reorder point.</p> : (
            <ul className="ad-lines">
              {lowStock.sort((a, b) => availableQty(a) / a.reorderPoint - availableQty(b) / b.reorderPoint).slice(0, 5).map((i) => (
                <li key={i.id}><Link href={`/admin/inventory?item=${i.id}` as Route} className="ad-rowlink">{i.name}</Link><span className="ad-row"><span className="ad-muted small">{availableQty(i)} {i.unit}{cover.get(i.id) != null ? ` · ${cover.get(i.id)} d cover` : ''}</span><StockBadge level={stockLevel(i)} /></span></li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Live orders" id="live" actions={<><span className="ad-muted small">Newest first · updates live</span><Link className="ad-link" href="/admin/orders">All orders</Link></>}>
        {live.length === 0 ? <Empty>No active orders. Nice and calm.</Empty> : (
          <div className="ad-table-wrap">
            <table className="table ad-cards">
              <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Due</th><th>Status</th><th className="num">Total</th><th /></tr></thead>
              <tbody>
                {live.map((o) => {
                  const p = priorityOf(o, now);
                  return (
                    <tr key={o.id} className={`${p === 'URGENT' ? 'is-urgent' : ''} ${recentlyNew === o.id ? 'is-new' : ''}`}>
                      <td data-label="Order"><Link className="ad-rowlink" href={`/admin/orders/${o.id}` as Route}>{o.id}</Link><span className="ad-sub">{ago(o.createdAt, now)}</span></td>
                      <td data-label="Customer">{o.customer.name}</td>
                      <td data-label="Items" className="cell-items">{o.items.map((l) => `${l.qty} × ${l.product.name}`).join(', ')}{hasCustom(o) && <> <Badge tone="info">Custom</Badge></>}</td>
                      <td data-label="Due">{dayLabel(requiredBy(o), now)} {clock(requiredBy(o))} {p !== 'NORMAL' && <PriorityBadge priority={p} due={dueState(o, now)} />}</td>
                      <td data-label="Status"><OrderStatusBadge status={o.status} /></td>
                      <td data-label="Total" className="num">{rupees(o.total)}</td>
                      <td data-label="" className="cell-actions"><AdvanceButton order={o} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Intelligence" id="intel" actions={<Link className="ad-link" href={"/admin/intelligence" as Route}>All insights</Link>}>
        {visible.length === 0 ? <Empty>No insights right now. They appear as orders, stock and visits build up.</Empty> : (
          <ul className="ad-insights">
            {visible.slice(0, 5).map((i) => (
              <li key={i.id} className={`ad-insight ad-insight-${i.severity}`}>
                <div className="ad-between"><strong>{i.title}</strong><span className="ad-muted small">{confidenceLabel(i.confidence)} confidence</span></div>
                <p>{i.detail}</p>
                {i.next && <Link className="ad-link" href={i.next.href as Route}>{i.next.label} →</Link>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
