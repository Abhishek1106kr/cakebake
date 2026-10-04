'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Download, RotateCw } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { useAdmin } from '@/components/admin/admin-provider';
import { useInvoiceActions } from '@/components/admin/invoice-actions';
import { Badge, Chips, Drawer, Empty, Guard, PageHeader, Pager, Panel, PaymentBadge, SearchField, dateTime, rupees, useUrlParam } from '@/components/admin/ui';
import { invoiceRows, type InvoiceStatus } from '@/lib/admin/invoices';
import { invoiceIsConsistent } from '@/lib/automation/automation';
import { retryJob } from '@/lib/automation/runner';
import { paginate } from '@/lib/admin/order-ops';
import { toCsv, downloadText, stamp } from '@/lib/admin/csv';

type F = 'ALL' | InvoiceStatus;
const FILTERS: { id: F; label: string }[] = [{ id: 'ALL', label: 'All' }, { id: 'ISSUED', label: 'Issued' }, { id: 'PENDING', label: 'Pending' }, { id: 'FAILED', label: 'Failed' }, { id: 'NOT_REQUESTED', label: 'Not requested' }];
const TONE: Record<InvoiceStatus, 'ok' | 'info' | 'bad' | 'muted'> = { ISSUED: 'ok', PENDING: 'info', FAILED: 'bad', NOT_REQUESTED: 'muted' };
const LABEL: Record<InvoiceStatus, string> = { ISSUED: 'Issued', PENDING: 'Pending', FAILED: 'Failed', NOT_REQUESTED: 'Not requested' };

export default function InvoicesPage() {
  return <Guard permission="invoices.view"><Invoices /></Guard>;
}

function Invoices() {
  const { orders, findOrder } = useStore();
  const admin = useAdmin();
  const actions = useInvoiceActions();
  const [filter, setFilter] = useUrlParam('status', 'ALL');
  const [query, setQuery] = useUrlParam('q', '');
  const [openOrder, setOpenOrder] = useUrlParam('order', '');
  const [page, setPage] = useState(1);
  const f = (FILTERS.some((x) => x.id === filter) ? filter : 'ALL') as F;
  const rows = useMemo(() => invoiceRows(orders, admin.automation.invoices, admin.automation.jobs), [orders, admin.automation.invoices, admin.automation.jobs]);
  const q = query.trim().toLowerCase();
  const shown = rows.filter((r) => (f === 'ALL' || r.status === f) && (!q || r.number.toLowerCase().includes(q) || r.order.id.toLowerCase().includes(q) || r.order.customer.name.toLowerCase().includes(q)));
  const counts = Object.fromEntries(FILTERS.map((x) => [x.id, rows.filter((r) => x.id === 'ALL' || r.status === x.id).length])) as Record<F, number>;
  const paged = paginate(shown, page, 30);
  useEffect(() => { setPage(1); }, [f, query]);
  const open = rows.find((r) => r.order.id === openOrder);
  const retry = (id: string, orderId: string) => admin.act({ permission: 'automations.retry', action: 'automation.retried', entity: { type: 'automation', id, label: orderId }, before: { status: 'failed' }, after: { status: 'retrying' }, run: () => { retryJob(id, () => findOrder(orderId)); }, success: 'Retrying invoice…' });
  const csv = () => downloadText(`tresor-invoices-${stamp()}.csv`, toCsv([['Invoice', 'Revision', 'Order', 'Customer', 'Amount', 'Status', 'Issued', 'Payment'], ...shown.map((r) => [r.number, r.invoice?.revision ?? '', r.order.id, r.order.customer.name, r.order.total, LABEL[r.status], r.invoice?.issuedAt ?? '', r.order.paymentStatus])]));

  return (
    <div>
      <PageHeader eyebrow="Finance" title="Invoices" description="One invoice per order, numbered from the order and never renumbered. Regenerating adds a revision rebuilt from the order’s own snapshot. Simulated: no tax registration is real."
        actions={<button type="button" className="ad-btn" onClick={csv}>Export ({shown.length}) <ArrowUpRight size={14} /></button>} />
      <Panel>
        <div className="ad-toolbar"><Chips label="Invoice status" items={FILTERS} value={f} onChange={setFilter} counts={counts} /></div>
        <div className="ad-toolbar"><SearchField value={query} onChange={setQuery} placeholder="Invoice, order or customer" label="Search invoices" /></div>
        {shown.length === 0 ? <Empty>No invoices match.</Empty> : (
          <div className="ad-table-wrap">
            <table className="table ad-cards">
              <thead><tr><th>Invoice</th><th>Order</th><th>Customer</th><th className="num">Amount</th><th>Status</th><th>Issued</th><th>Payment</th><th /></tr></thead>
              <tbody>{paged.items.map((r) => (
                <tr key={r.order.id} data-order={r.order.id}>
                  <td data-label="Invoice"><button type="button" className="ad-link ad-rowlink ad-mono" onClick={() => setOpenOrder(r.order.id)}>{r.number}</button>{(r.invoice?.revision ?? 1) > 1 && <span className="ad-sub">revision {r.invoice!.revision}</span>}</td>
                  <td data-label="Order"><Link className="ad-rowlink" href={`/admin/orders/${r.order.id}` as Route}>{r.order.id}</Link></td>
                  <td data-label="Customer">{r.order.customer.name}</td>
                  <td data-label="Amount" className="num">{rupees(r.order.total)}</td>
                  <td data-label="Status"><Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>{r.status === 'FAILED' && <span className="ad-sub">{r.job?.lastError}</span>}</td>
                  <td data-label="Issued">{r.invoice ? dateTime(r.invoice.issuedAt) : '—'}</td>
                  <td data-label="Payment"><PaymentBadge status={r.order.paymentStatus} /></td>
                  <td data-label="" className="cell-actions">
                    {r.invoice && <><button type="button" className="ad-btn ad-btn-sm" onClick={() => actions.view(r.invoice!)}>View</button><button type="button" className="ad-btn ad-btn-sm" onClick={() => actions.download(r.invoice!)} aria-label={`Download ${r.number}`}><Download size={12} /></button></>}
                    {r.status === 'FAILED' && r.job && admin.can('automations.retry') && <button type="button" className="ad-btn ad-btn-sm" onClick={() => retry(r.job!.id, r.order.id)}><RotateCw size={12} /> Retry</button>}
                    {admin.can('invoices.regenerate') && r.status !== 'PENDING' && <button type="button" className="ad-btn ad-btn-sm ad-btn-ghost" onClick={() => actions.regenerate(r.order)}>{r.invoice ? 'Regenerate' : 'Generate'}</button>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <Pager page={paged.page} pages={paged.pages} total={paged.total} onPage={setPage} label="invoices" />
      </Panel>
      {open && (
        <Drawer open onClose={() => setOpenOrder('')} title={open.number} subtitle={<><Badge tone={TONE[open.status]}>{LABEL[open.status]}</Badge><span>{open.order.id} · {open.order.customer.name}</span></>}
          footer={open.invoice && <><button type="button" className="ad-btn" onClick={() => actions.view(open.invoice!)}>Open printable</button><button type="button" className="ad-btn ad-btn-primary" onClick={() => actions.download(open.invoice!)}><Download size={13} /> Download</button></>}>
          {!open.invoice ? <Empty>{open.status === 'FAILED' ? `Generation failed: ${open.job?.lastError}` : open.status === 'PENDING' ? 'Being generated…' : 'No invoice was requested for this order (sample data).'}</Empty> : (
            <>
              <dl className="ad-dl">
                <dt>Issued</dt><dd>{dateTime(open.invoice.issuedAt)}</dd>
                <dt>Billed to</dt><dd>{open.invoice.customerSnapshot?.name ?? open.invoice.customer}{open.invoice.customerSnapshot && admin.can('customers.pii') && <span className="ad-sub">{open.invoice.customerSnapshot.address}, {open.invoice.customerSnapshot.city} {open.invoice.customerSnapshot.pin}</span>}</dd>
                <dt>Payment</dt><dd>{open.invoice.paymentMethod} · {open.invoice.paymentStatus.toLowerCase().replace('_', ' ')} <span className="ad-muted">(at issue)</span></dd>
                <dt>Tax</dt><dd>{open.invoice.tax && open.invoice.tax.rate > 0 ? `GST ${open.invoice.tax.rate}% included: ${rupees(open.invoice.tax.amount)}` : 'Not configured at issue'}</dd>
                <dt>Check</dt><dd>{invoiceIsConsistent(open.invoice, open.order) ? <Badge tone="ok">Matches the order</Badge> : <Badge tone="bad">Doesn’t match the order</Badge>}</dd>
              </dl>
              <h3 className="ad-section-title">Lines (snapshot)</h3>
              <ul className="ad-lines">
                {open.invoice.lines.map((l, i) => <li key={i}><span>{l.qty} × {l.description}{l.detail.length > 0 && <span className="ad-sub">{l.detail.slice(0, 3).join(' · ')}</span>}</span><span className="ad-num">{rupees(l.amount)}</span></li>)}
                <li><span>Delivery</span><span className="ad-num">{rupees(open.invoice.delivery)}</span></li>
                <li><strong>Total</strong><strong className="ad-num">{rupees(open.invoice.total)}</strong></li>
              </ul>
              {open.invoice.revisions && open.invoice.revisions.length > 0 && <>
                <h3 className="ad-section-title">Revisions</h3>
                <ul className="ad-lines">{open.invoice.revisions.map((r) => <li key={r.revision}><span>Revision {r.revision} · {r.reason}</span><span className="ad-muted small">{r.by} · {dateTime(r.issuedAt)}</span></li>)}</ul>
              </>}
              <p className="ad-muted small">{open.invoice.note}</p>
            </>
          )}
        </Drawer>
      )}
    </div>
  );
}
