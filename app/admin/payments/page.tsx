'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { useAdmin } from '@/components/admin/admin-provider';
import { useOrderActions } from '@/components/admin/order-actions';
import { Badge, Chips, Drawer, Empty, Guard, Kpi, PageHeader, Pager, Panel, SearchField, dateTime, rupees, useUrlParam } from '@/components/admin/ui';
import { filterPayments, PAYMENT_STATUS_LABEL, paymentStatsFor, type PaymentFilter } from '@/lib/admin/payments';
import { paginate } from '@/lib/admin/order-ops';
import { toCsv, downloadText, stamp } from '@/lib/admin/csv';
import { maskPhone } from '@/lib/admin/permissions';
import type { PaymentRecordStatus, SeedPayment } from '@/lib/mock-data/types';

type Tone = 'ok' | 'info' | 'bad' | 'warn' | 'muted' | 'neutral';
const TONE: Record<PaymentRecordStatus, Tone> = { CREATED: 'info', AUTHORIZED: 'info', CAPTURED: 'ok', FAILED: 'bad', CANCELLED: 'muted', REFUND_PENDING: 'warn', PARTIALLY_REFUNDED: 'warn', REFUNDED: 'neutral' };
const STATUS_CHIPS: { id: PaymentRecordStatus | 'ALL'; label: string }[] = [
  { id: 'ALL', label: 'All' }, { id: 'CAPTURED', label: 'Captured' }, { id: 'CREATED', label: 'Due (COD)' }, { id: 'FAILED', label: 'Failed' },
  { id: 'REFUND_PENDING', label: 'Refund pending' }, { id: 'PARTIALLY_REFUNDED', label: 'Partly refunded' }, { id: 'REFUNDED', label: 'Refunded' }, { id: 'CANCELLED', label: 'Cancelled' },
];
const PERIODS = [{ id: '7', label: '7 days' }, { id: '30', label: '30 days' }, { id: '90', label: '90 days' }, { id: '365', label: '12 months' }] as const;

export default function PaymentsPage() {
  return <Guard permission="payments.view"><Payments /></Guard>;
}

function Payments() {
  const { findOrder } = useStore();
  const admin = useAdmin();
  const { refund } = useOrderActions();
  const [status, setStatus] = useUrlParam('status', 'ALL');
  const [method, setMethod] = useUrlParam('method', 'ALL');
  const [provider, setProvider] = useUrlParam('provider', 'ALL');
  const [query, setQuery] = useUrlParam('q', '');
  const [period, setPeriod] = useUrlParam('period', '30');
  const [openId, setOpenId] = useUrlParam('payment', '');
  const [page, setPage] = useState(1);

  const name = (customerId: string, orderId: string) => findOrder(orderId)?.customer.name ?? customerId;
  const f: PaymentFilter = {
    status: (STATUS_CHIPS.some((c) => c.id === status) ? status : 'ALL') as PaymentFilter['status'],
    method: (['ALL', 'UPI', 'Card', 'COD'].includes(method) ? method : 'ALL') as PaymentFilter['method'],
    provider: (['ALL', 'simulated', 'cod'].includes(provider) ? provider : 'ALL') as PaymentFilter['provider'],
    query,
  };
  const shown = useMemo(() => filterPayments(admin.payments, f, name),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [admin.payments, f.status, f.method, f.provider, query]);
  const counts = useMemo(() => Object.fromEntries(STATUS_CHIPS.map((c) => [c.id, c.id === 'ALL' ? admin.payments.length : admin.payments.filter((p) => p.status === c.id).length])), [admin.payments]);
  const days = Number(PERIODS.find((p) => p.id === period)?.id ?? 30);
  const stats = useMemo(() => paymentStatsFor(admin.payments, new Date(admin.now.getTime() - days * 86_400_000), admin.now), [admin.payments, admin.now, days]);
  const paged = paginate(shown, page, 25);
  useEffect(() => { setPage(1); }, [f.status, f.method, f.provider, query]);
  const open = admin.payments.find((p) => p.id === openId) ?? null;

  const csv = () => downloadText(`tresor-payments-${stamp()}.csv`, toCsv([
    ['Payment', 'Order', 'Customer', 'Method', 'Provider', 'Status', 'Amount', 'Refunded', 'Attempt', 'Reference', 'Created', 'Captured', 'Failure'],
    ...shown.map((p) => [p.id, p.orderId, name(p.customerId, p.orderId), p.method, p.provider, PAYMENT_STATUS_LABEL[p.status], p.amount, p.refundedAmount, p.attempt, p.reference ?? '', p.createdAt, p.capturedAt ?? '', p.failureReason ?? '']),
  ]));

  return (
    <div>
      <PageHeader eyebrow="Finance" title="Payments" description="Every payment attempt, refund and pay-at-door collection, linked to its order and customer. Simulated: UPI and card payments go through a demo gateway, so no money moves."
        actions={<button type="button" className="ad-btn" onClick={csv}>Export ({shown.length}) <ArrowUpRight size={14} /></button>} />

      <div className="ad-toolbar">
        <Chips label="Period" items={PERIODS.map((p) => ({ id: p.id, label: p.label }))} value={period} onChange={setPeriod} />
      </div>
      <div className="ad-kpis">
        <Kpi label="Captured" value={rupees(stats.captured)} meta={`last ${PERIODS.find((p) => p.id === period)?.label ?? '30 days'}`} />
        <Kpi label="Failed attempts" value={stats.failedAttempts} meta={`${Math.round(stats.failureRate * 1000) / 10}% of online attempts`} tone={stats.failureRate > 0.08 ? 'warn' : undefined} href="/admin/payments?status=FAILED" />
        <Kpi label="Refunded" value={rupees(stats.refunded)} meta={`${stats.refundsPending} refund${stats.refundsPending === 1 ? '' : 's'} pending`} tone={stats.refundsPending ? 'warn' : undefined} href="/admin/payments?status=REFUND_PENDING" />
        <Kpi label="Pay at door due" value={rupees(stats.codDue)} meta="collected on delivery" href="/admin/payments?status=CREATED" />
      </div>

      <Panel>
        <div className="ad-toolbar"><Chips label="Payment status" items={STATUS_CHIPS} value={f.status} onChange={setStatus} counts={counts} /></div>
        <div className="ad-toolbar">
          <select className="ad-select" value={f.method} onChange={(e) => setMethod(e.target.value)} aria-label="Method">
            <option value="ALL">Any method</option><option value="UPI">UPI</option><option value="Card">Card</option><option value="COD">Pay at door</option>
          </select>
          <select className="ad-select" value={f.provider} onChange={(e) => setProvider(e.target.value)} aria-label="Provider">
            <option value="ALL">Any provider</option><option value="simulated">Demo gateway (simulated)</option><option value="cod">Pay at door</option>
          </select>
          <SearchField value={query} onChange={setQuery} placeholder="Payment, order, reference or customer" label="Search payments" />
        </div>
        {shown.length === 0 ? <Empty>No payments match.</Empty> : (
          <div className="ad-table-wrap">
            <table className="table ad-cards">
              <thead><tr><th>Payment</th><th>Order</th><th>Customer</th><th>Method</th><th>Status</th><th className="num">Amount</th><th>When</th></tr></thead>
              <tbody>{paged.items.map((p) => (
                <tr key={p.id} data-payment={p.id}>
                  <td data-label="Payment"><button type="button" className="ad-link ad-rowlink ad-mono" onClick={() => setOpenId(p.id)}>{p.id}</button>{p.attempt > 1 && <span className="ad-sub">attempt {p.attempt}</span>}</td>
                  <td data-label="Order"><Link className="ad-rowlink" href={`/admin/orders/${p.orderId}` as Route}>{p.orderId}</Link></td>
                  <td data-label="Customer">{name(p.customerId, p.orderId)}{p.customerId && <span className="ad-sub">{p.customerId}</span>}</td>
                  <td data-label="Method">{p.method === 'COD' ? 'Pay at door' : p.method}<span className="ad-sub">{p.provider === 'simulated' ? 'demo gateway' : 'cash or UPI at door'}</span></td>
                  <td data-label="Status"><Badge tone={TONE[p.status]}>{PAYMENT_STATUS_LABEL[p.status]}</Badge>{p.failureReason && <span className="ad-sub">{p.failureReason}</span>}</td>
                  <td data-label="Amount" className="num">{rupees(p.amount)}{p.refundedAmount > 0 && <span className="ad-sub">−{rupees(p.refundedAmount)} refunded</span>}</td>
                  <td data-label="When">{dateTime(p.createdAt)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <Pager page={paged.page} pages={paged.pages} total={paged.total} onPage={setPage} label="payments" />
      </Panel>

      {open && <PaymentDrawer payment={open} onClose={() => setOpenId('')} all={admin.payments} onRefund={() => { const o = findOrder(open.orderId); if (o) refund(o); }} />}
    </div>
  );
}

function PaymentDrawer({ payment: p, all, onClose, onRefund }: { payment: SeedPayment; all: SeedPayment[]; onClose: () => void; onRefund: () => void }) {
  const { findOrder } = useStore();
  const admin = useAdmin();
  const order = findOrder(p.orderId);
  const attempts = all.filter((x) => x.orderId === p.orderId).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.attempt - b.attempt);
  const timeline = [
    ...attempts.flatMap((x) => [
      { at: x.createdAt, text: `${x.id}: ${x.method === 'COD' ? 'pay at door chosen' : `attempt ${x.attempt} started`}` },
      ...(x.status === 'FAILED' ? [{ at: x.createdAt, text: `${x.id}: failed (${x.failureReason})` }] : []),
      ...(x.capturedAt ? [{ at: x.capturedAt, text: `${x.id}: ${x.method === 'COD' ? 'collected at the door' : 'captured'} · ${rupees(x.amount)}` }] : []),
    ]),
    ...attempts.flatMap((x) => x.refunds.flatMap((r) => [
      { at: r.createdAt, text: `${r.id}: refund of ${rupees(r.amount)} requested (${r.reason})` },
      ...(r.processedAt ? [{ at: r.processedAt, text: `${r.id}: refund processed` }] : []),
    ])),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <Drawer open onClose={onClose} title={p.id} subtitle={<><Badge tone={TONE[p.status]}>{PAYMENT_STATUS_LABEL[p.status]}</Badge><span>{p.orderId} · {rupees(p.amount)}</span></>}
      footer={order?.paymentStatus === 'REFUND_PENDING' && admin.can('payments.refund') ? <button type="button" className="ad-btn ad-btn-primary" onClick={onRefund}>Mark refund completed…</button> : undefined}>
      <dl className="ad-dl">
        <dt>Order</dt><dd><Link className="ad-link" href={`/admin/orders/${p.orderId}` as Route}>{p.orderId}</Link>{order && <span className="ad-sub">{order.customer.name} · {admin.can('customers.pii') ? order.customer.phone : maskPhone(order.customer.phone)}</span>}</dd>
        <dt>Method</dt><dd>{p.method === 'COD' ? 'Pay at door' : p.method}</dd>
        <dt>Provider</dt><dd>{p.provider === 'simulated' ? 'Demo gateway (simulated: no money moves)' : 'Collected by the rider'}</dd>
        <dt>Reference</dt><dd className="ad-mono">{p.reference ?? '—'}</dd>
        <dt>Amount</dt><dd>{rupees(p.amount)}{p.refundedAmount > 0 && <span className="ad-sub">{rupees(p.refundedAmount)} refunded</span>}</dd>
        <dt>Created</dt><dd>{dateTime(p.createdAt)}</dd>
        <dt>Captured</dt><dd>{p.capturedAt ? dateTime(p.capturedAt) : '—'}</dd>
        {p.failureReason && <><dt>Failure</dt><dd>{p.failureReason}</dd></>}
      </dl>
      {p.refunds.length > 0 && <>
        <h3 className="ad-section-title">Refunds</h3>
        <ul className="ad-lines">{p.refunds.map((r) => (
          <li key={r.id}><span>{r.id} · {r.reason}{r.issueId && <span className="ad-sub">from <Link className="ad-link" href={`/admin/issues?issue=${r.issueId}` as Route}>{r.issueId}</Link></span>}</span><span className="ad-num">{rupees(r.amount)} <Badge tone={r.status === 'PROCESSED' ? 'ok' : 'warn'}>{r.status === 'PROCESSED' ? 'Processed' : 'Pending'}</Badge></span></li>
        ))}</ul>
      </>}
      <h3 className="ad-section-title">Timeline for {p.orderId}</h3>
      <ul className="ad-lines">{timeline.map((t, i) => <li key={i}><span>{t.text}</span><span className="ad-muted small">{dateTime(t.at)}</span></li>)}</ul>
    </Drawer>
  );
}
