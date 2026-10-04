'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useMemo, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { useAdmin } from '@/components/admin/admin-provider';
import { Chips, Drawer, Empty, Guard, JobBadge, Kpi, PageHeader, Pager, Panel, SearchField, clock, dateTime, useUrlParam } from '@/components/admin/ui';
import { retryJob } from '@/lib/automation/runner';
import type { Job } from '@/lib/automation/automation';
import { paginate } from '@/lib/admin/order-ops';

type F = 'ALL' | 'RUNNING' | 'SUCCESS' | 'RETRYING' | 'FAILED';
const FILTERS: { id: F; label: string }[] = [{ id: 'ALL', label: 'All' }, { id: 'RUNNING', label: 'Running' }, { id: 'SUCCESS', label: 'Success' }, { id: 'RETRYING', label: 'Retrying' }, { id: 'FAILED', label: 'Failed' }];
const STATUS_OF: Record<F, Job['status'] | null> = { ALL: null, RUNNING: 'requested', SUCCESS: 'succeeded', RETRYING: 'retrying', FAILED: 'failed' };
const typeLabel = (j: Job) => (j.kind === 'invoice' ? 'Invoice' : j.topic === 'confirmation' ? 'WhatsApp · confirmation' : `WhatsApp · ${j.topic.replace('status:', '').toLowerCase().replace(/_/g, ' ')}`);

export default function AutomationsPage() {
  return <Guard permission="automations.view"><Automations /></Guard>;
}

function Automations() {
  const { findOrder } = useStore();
  const admin = useAdmin();
  const { jobs, log, outbox, invoices } = admin.automation;
  const [filter, setFilter] = useUrlParam('filter', 'ALL');
  const [query, setQuery] = useUrlParam('q', '');
  const [openJob, setOpenJob] = useUrlParam('job', '');
  const [page, setPage] = useState(1);
  const f = (FILTERS.some((x) => x.id === filter) ? filter : 'ALL') as F;
  const sorted = useMemo(() => [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)), [jobs]);
  const q = query.trim().toLowerCase();
  const shown = sorted.filter((j) => (!STATUS_OF[f] || j.status === STATUS_OF[f]) && (!q || j.orderId.toLowerCase().includes(q) || j.id.toLowerCase().includes(q) || (j.lastError ?? '').toLowerCase().includes(q)));
  const counts = Object.fromEntries(FILTERS.map((x) => [x.id, jobs.filter((j) => !STATUS_OF[x.id] || j.status === STATUS_OF[x.id]).length])) as Record<F, number>;
  const paged = paginate(shown, page, 40);
  useEffect(() => { setPage(1); }, [f, query]);
  const job = jobs.find((j) => j.id === openJob);
  const rate = (kind: Job['kind']) => { const done = jobs.filter((j) => j.kind === kind && (j.status === 'succeeded' || j.status === 'failed')); return done.length ? `${Math.round((done.filter((j) => j.status === 'succeeded').length / done.length) * 100)}%` : '—'; };
  const retry = (j: Job) => admin.act({ permission: 'automations.retry', action: 'automation.retried', entity: { type: 'automation', id: j.id, label: j.orderId }, before: { status: j.status, attempts: j.attempts }, after: { status: 'retrying' }, run: () => { retryJob(j.id, () => findOrder(j.orderId)); }, success: `Retrying ${typeLabel(j).toLowerCase()} for ${j.orderId}` });

  return (
    <div>
      <PageHeader eyebrow="System" title="Automations" description="Invoices and WhatsApp messages run as jobs with retries; a failure never changes the order. Providers are simulations: nothing leaves this browser. Email and SMS have no provider connected." />
      <div className="ad-kpis">
        <Kpi label="Jobs" value={jobs.length} />
        <Kpi label="Running / retrying" value={counts.RUNNING + counts.RETRYING} />
        <Kpi label="Failed" value={counts.FAILED} tone={counts.FAILED ? 'bad' : undefined} meta={counts.FAILED ? 'Need a retry' : 'None'} />
        <Kpi label="Invoice success" value={rate('invoice')} />
        <Kpi label="WhatsApp success" value={rate('whatsapp')} />
      </div>
      <Panel title="Jobs">
        <div className="ad-toolbar"><Chips label="Job status" items={FILTERS} value={f} onChange={setFilter} counts={counts} /><SearchField value={query} onChange={setQuery} placeholder="Order, job id or error" label="Search jobs" /></div>
        {shown.length === 0 ? <Empty>{jobs.length ? 'No jobs match.' : 'No automations yet. Place an order in the shop to see invoices and messages run.'}</Empty> : (
          <div className="ad-table-wrap">
            <table className="table ad-cards automation-table">
              <thead><tr><th>Job</th><th>Order</th><th>Type</th><th>Created</th><th className="num">Attempts</th><th>Status</th><th>Last error</th><th /></tr></thead>
              <tbody>{paged.items.map((j) => (
                <tr key={j.id} data-order={j.orderId} data-job={j.id} data-status={j.status} className={j.status === 'failed' ? 'is-urgent' : ''}>
                  <td data-label="Job"><button type="button" className="ad-link ad-mono" onClick={() => setOpenJob(j.id)}>{j.id.split(':').slice(-1)[0]}</button></td>
                  <td data-label="Order"><Link className="ad-rowlink" href={`/admin/orders/${j.orderId}` as Route}>{j.orderId}</Link></td>
                  <td data-label="Type">{typeLabel(j)}</td>
                  <td data-label="Created">{clock(j.createdAt)}</td>
                  <td data-label="Attempts" className="num">{j.attempts}</td>
                  <td data-label="Status"><JobBadge status={j.status} /></td>
                  <td data-label="Last error" className="ad-muted">{j.lastError ?? '—'}</td>
                  <td data-label="" className="cell-actions">
                    {j.status === 'failed' && admin.can('automations.retry') && <button type="button" className="ad-btn ad-btn-sm job-retry" onClick={() => retry(j)}><RotateCw size={12} /> Retry</button>}
                    <button type="button" className="ad-btn ad-btn-sm ad-btn-ghost" onClick={() => setOpenJob(j.id)}>Details</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <Pager page={paged.page} pages={paged.pages} total={paged.total} onPage={setPage} label="jobs" />
      </Panel>
      <Panel title="Event log" actions={<span className="ad-muted small">Latest {Math.min(80, log.length)} of {log.length}</span>}>
        <div className="ad-table-wrap"><table className="table ad-cards">
          <thead><tr><th>Time</th><th>Event</th><th>Order</th><th>Result</th><th>Detail</th></tr></thead>
          <tbody>{[...log].reverse().slice(0, 80).map((e) => <tr key={e.id}><td data-label="Time">{clock(e.timestamp)}</td><td data-label="Event"><code className="ad-mono">{e.type}</code></td><td data-label="Order">{e.orderId}</td><td data-label="Result">{e.status}</td><td data-label="Detail" className="ad-muted">{e.detail}</td></tr>)}</tbody>
        </table></div>
      </Panel>
      {job && (
        <Drawer open onClose={() => setOpenJob('')} title={typeLabel(job)} subtitle={<><JobBadge status={job.status} /><Link className="ad-link" href={`/admin/orders/${job.orderId}` as Route}>{job.orderId}</Link></>}
          footer={job.status === 'failed' && admin.can('automations.retry') && <button type="button" className="ad-btn ad-btn-primary" onClick={() => retry(job)}><RotateCw size={13} /> Retry</button>}>
          <dl className="ad-dl">
            <dt>Job id</dt><dd className="ad-mono">{job.id}</dd>
            <dt>Created</dt><dd>{dateTime(job.createdAt)}</dd>
            <dt>Updated</dt><dd>{dateTime(job.updatedAt)}</dd>
            <dt>Attempts</dt><dd>{job.attempts} of 3 automatic</dd>
            <dt>Last error</dt><dd>{job.lastError ?? '—'}</dd>
            <dt>Idempotency</dt><dd className="ad-muted small">One job per order and topic: repeating the trigger can’t send twice.</dd>
          </dl>
          {job.kind === 'whatsapp' && <>
            <h3 className="ad-section-title">Message (mock outbox)</h3>
            {outbox.filter((m) => m.jobId === job.id).map((m) => <pre key={m.jobId} className="ad-wa">{m.text}<small>To {admin.can('customers.pii') ? m.to : `•••• ${m.to.slice(-4)}`} · {dateTime(m.sentAt)}</small></pre>)}
            {!outbox.some((m) => m.jobId === job.id) && <p className="ad-muted small">Not sent.</p>}
          </>}
          {job.kind === 'invoice' && invoices[job.orderId] && <p>Invoice <Link className="ad-link" href={`/admin/invoices?order=${job.orderId}` as Route}>{invoices[job.orderId].invoiceNumber}</Link> issued {dateTime(invoices[job.orderId].issuedAt)}.</p>}
          <h3 className="ad-section-title">Events for this order</h3>
          <ol className="ad-timeline">{log.filter((e) => e.orderId === job.orderId).map((e) => <li key={e.id} className={e.status === 'failed' ? 't-error' : e.status === 'retry' ? 't-warn' : 't-ok'}><span><strong>{e.type}</strong>{e.detail && <small>{e.detail}</small>}</span><time>{clock(e.timestamp)}</time></li>)}</ol>
        </Drawer>
      )}
    </div>
  );
}
