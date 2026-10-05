'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { CakeSlice, Download, ExternalLink, Printer, RotateCw } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { retryJob } from '@/lib/automation/runner';
import { canCancel, type Order } from '@/lib/orders';
import { auditFor } from '@/lib/admin/audit';
import { deliverBy, dueState, hasCustom, minutesInStatus, orderTimeline, priorityOf, requiredBy } from '@/lib/admin/order-ops';
import { maskEmail, maskPhone } from '@/lib/admin/permissions';
import { useAdmin } from './admin-provider';
import { AdvanceButton, useOrderActions } from './order-actions';
import { useInvoiceActions } from './invoice-actions';
import { Badge, JobBadge, OrderStatusBadge, PaymentBadge, PriorityBadge, clock, dateTime, dayLabel, rupees } from './ui';

const TOPIC_LABEL = (t: string) => (t === 'confirmation' ? 'Confirmation' : t.replace('status:', '').toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()));

/** Everything about one order: who, what, money, delivery, invoice, messages, history, and the actions. */
export function OrderDetail({ order }: { order: Order }) {
  const admin = useAdmin();
  const { findOrder } = useStore();
  const { cancel, refund } = useOrderActions();
  const invoice = useInvoiceActions();
  const { now } = admin;
  const pii = admin.can('customers.pii');
  const jobs = admin.automation.jobs.filter((j) => j.orderId === order.id);
  const whatsapp = jobs.filter((j) => j.kind === 'whatsapp').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const invJob = jobs.find((j) => j.kind === 'invoice');
  const inv = admin.automation.invoices[order.id];
  const timeline = orderTimeline(order, admin.automation.log, auditFor(admin.audit, order.id));
  const p = priorityOf(order, now);
  const due = requiredBy(order);

  const retry = (id: string) => admin.act({
    permission: 'automations.retry', action: 'automation.retried', entity: { type: 'automation', id, label: order.id }, before: { status: 'failed' }, after: { status: 'retrying' },
    run: () => { retryJob(id, () => findOrder(order.id)); }, success: 'Retrying…',
  });

  return (
    <div className="ad-detail">
      <div className="ad-row ad-detail-status">
        <OrderStatusBadge status={order.status} />
        <PaymentBadge status={order.paymentStatus} />
        {p !== 'NORMAL' && <PriorityBadge priority={p} due={dueState(order, now)} />}
        {hasCustom(order) && <Badge tone="info" icon={<CakeSlice size={12} aria-hidden />}>Custom cake</Badge>}
        {order.source === 'sample' && <Badge tone="muted">Sample</Badge>}
        <span className="ad-muted small">{minutesInStatus(order, now)} min in this status</span>
      </div>

      <div className="ad-detail-actions ad-no-print">
        <AdvanceButton order={order} />
        {canCancel(order) && admin.can('orders.cancel') && <button type="button" className="ad-btn ad-btn-sm ad-btn-quiet-danger" onClick={() => cancel(order)}>Cancel order…</button>}
        {order.paymentStatus === 'REFUND_PENDING' && admin.can('payments.refund') && <button type="button" className="ad-btn ad-btn-sm" onClick={() => refund(order)}>Mark refund completed…</button>}
        <Link className="ad-btn ad-btn-sm ad-btn-ghost" href={`/track/${order.id}` as Route} target="_blank" rel="noopener">Customer tracking <ExternalLink size={12} /></Link>
        <button type="button" className="ad-btn ad-btn-sm ad-btn-ghost" onClick={() => window.print()}><Printer size={13} /> Print</button>
      </div>

      <div className="ad-detail-grid">
        <section>
          <h3 className="ad-section-title">Order</h3>
          <dl className="ad-dl">
            <dt>Number</dt><dd><strong>{order.id}</strong></dd>
            <dt>Placed</dt><dd>{dateTime(order.createdAt)}</dd>
            <dt>Required by</dt><dd>{dayLabel(due, now)} · {clock(due)} <span className="ad-muted">(deliver by {clock(deliverBy(order))})</span></dd>
            <dt>Priority</dt><dd>{p === 'NORMAL' ? 'Normal' : p === 'HIGH' ? 'High: due soon' : dueState(order, now) === 'late' ? 'Late: past its slot' : 'Urgent: little slack left'}</dd>
          </dl>
        </section>
        <section>
          <h3 className="ad-section-title">Customer</h3>
          <dl className="ad-dl">
            <dt>Name</dt><dd>{order.customer.name}</dd>
            <dt>Phone</dt><dd>{pii ? <a href={`tel:${order.customer.phone}`}>{order.customer.phone}</a> : maskPhone(order.customer.phone)}</dd>
            <dt>Email</dt><dd>{order.customer.email ? (pii ? order.customer.email : maskEmail(order.customer.email)) : <span className="ad-muted">—</span>}</dd>
            <dt>Address</dt><dd>{pii ? `${order.address}, ${order.city} ${order.pin}` : `${order.city} ${order.pin.slice(0, 3)}•••`}</dd>
            <dt>Instructions</dt><dd>{order.instructions || <span className="ad-muted">None</span>}</dd>
          </dl>
          {!pii && <p className="ad-muted small">Contact details are hidden for your role.</p>}
        </section>
      </div>

      <h3 className="ad-section-title">Items</h3>
      <div className="ad-table-wrap">
        <table className="table">
          <thead><tr><th>Product</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Amount</th></tr></thead>
          <tbody>
            {order.items.map((l) => (
              <tr key={l.lineId}>
                <td>
                  <strong>{l.product.name}</strong>{l.size === 'Large' && ' (Large)'}
                  {l.custom && (
                    <div className="ad-sub">
                      {l.custom.lines.join(' · ')}<br />
                      <Link className="ad-link" href={`/admin/custom-cakes?order=${order.id}` as Route}>Production sheet · {l.custom.designId} · {l.custom.productionHours} h</Link>
                    </div>
                  )}
                </td>
                <td className="num">{l.qty}</td><td className="num">{rupees(l.unitPrice)}</td><td className="num">{rupees(l.unitPrice * l.qty)}</td>
              </tr>
            ))}
            <tr><td colSpan={3}>Delivery</td><td className="num">{rupees(order.delivery)}</td></tr>
            <tr><td colSpan={3}><strong>Total</strong></td><td className="num"><strong>{rupees(order.total)}</strong></td></tr>
          </tbody>
        </table>
      </div>
      <p className="ad-muted small">Prices are the order’s snapshot: later menu changes don’t alter them.</p>

      <div className="ad-detail-grid">
        <section>
          <h3 className="ad-section-title">Payment</h3>
          <dl className="ad-dl">
            <dt>Method</dt><dd>{order.paymentMethod === 'COD' ? 'Cash on delivery' : `${order.paymentMethod} (simulated)`}</dd>
            <dt>Amount</dt><dd>{rupees(order.total)}</dd>
            <dt>Status</dt><dd><PaymentBadge status={order.paymentStatus} /></dd>
            <dt>Reference</dt><dd>{order.paymentReference && order.paymentReference !== 'COD' ? <span className="ad-mono">{order.paymentReference}</span> : <span className="ad-muted">{order.paymentMethod === 'COD' ? 'Collected at the door' : 'Not recorded (placed before references were kept)'}</span>}</dd>
          </dl>
        </section>
        <section>
          <h3 className="ad-section-title">Fulfilment</h3>
          <dl className="ad-dl">
            <dt>Type</dt><dd>Delivery</dd>
            <dt>Date</dt><dd>{dayLabel(due, now)}</dd>
            <dt>Slot</dt><dd>{order.slot}</dd>
            <dt>Address</dt><dd>{pii ? `${order.address}, ${order.city}` : order.city}</dd>
          </dl>
        </section>
      </div>

      <div className="ad-detail-grid">
        <section>
          <h3 className="ad-section-title">Invoice</h3>
          {inv ? (
            <>
              <dl className="ad-dl">
                <dt>Number</dt><dd className="ad-mono">{inv.invoiceNumber}{(inv.revision ?? 1) > 1 && ` · rev ${inv.revision}`}</dd>
                <dt>Status</dt><dd><Badge tone="ok">Issued</Badge> {dateTime(inv.issuedAt)}</dd>
              </dl>
              <div className="ad-row ad-no-print" style={{ marginTop: 8 }}>
                {admin.can('invoices.view') && <button type="button" className="ad-btn ad-btn-sm" onClick={() => invoice.view(inv)}>View</button>}
                {admin.can('invoices.view') && <button type="button" className="ad-btn ad-btn-sm" onClick={() => invoice.download(inv)}><Download size={12} /> Download</button>}
                {admin.can('invoices.regenerate') && <button type="button" className="ad-btn ad-btn-sm ad-btn-ghost" onClick={() => invoice.regenerate(order)}>Regenerate…</button>}
              </div>
            </>
          ) : (
            <p className="ad-muted">{invJob?.status === 'failed' ? <>Invoice failed: {invJob.lastError}. <button type="button" className="ad-link" onClick={() => retry(invJob.id)}><RotateCw size={12} /> Retry</button></> : invJob ? 'Being generated…' : 'No invoice requested (sample order).'}</p>
          )}
        </section>
        <section>
          <h3 className="ad-section-title">Notifications</h3>
          {whatsapp.length === 0 ? <p className="ad-muted">No messages for this order.</p> : (
            <ul className="ad-lines">
              {whatsapp.map((j) => (
                <li key={j.id} data-job={j.id}>
                  <span>WhatsApp · {TOPIC_LABEL(j.topic)}{j.attempts > 1 && <span className="ad-sub">{j.attempts} attempts</span>}{j.status === 'failed' && <span className="ad-sub" style={{ color: 'var(--ad-bad)' }}>{j.lastError}</span>}</span>
                  <span className="ad-row"><JobBadge status={j.status} />{j.status === 'failed' && admin.can('automations.retry') && <button type="button" className="ad-btn ad-btn-sm" onClick={() => retry(j.id)}><RotateCw size={12} /> Retry</button>}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="ad-muted small">Email and SMS: no provider connected. WhatsApp is simulated.</p>
        </section>
      </div>

      <h3 className="ad-section-title">Timeline</h3>
      <ol className="ad-timeline">
        {timeline.map((t, i) => (
          <li key={`${t.at}-${i}`} className={`t-${t.tone}`}>
            <span><strong>{t.label}</strong>{t.detail && <small>{t.detail}</small>}</span>
            <time dateTime={t.at}>{dateTime(t.at)}</time>
          </li>
        ))}
      </ol>
    </div>
  );
}
