'use client';

import { useState } from 'react';
import { RotateCw } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { useAutomation } from '@/components/use-automation';
import { StatusBadge, clock, rupees } from '@/components/admin/admin-utils';
import { retryJob } from '@/lib/automation/runner';
import { invoiceIsConsistent, type Job } from '@/lib/automation/automation';

const MARK: Record<Job['status'], string> = { requested: '…', retrying: '⚠ retry', succeeded: '✓', failed: '✗' };

function JobCell({ job, onRetry }: { job?: Job; onRetry: (id: string) => void }) {
  if (!job) return <td className="muted">—</td>;
  return (
    <td data-job={job.id} data-status={job.status}>
      <span className={`job job-${job.status}`} title={job.lastError ?? undefined}>{MARK[job.status]}</span>
      {job.attempts > 1 && <small className="muted"> {job.attempts} tries</small>}
      {job.status === 'failed' && <button type="button" className="btn btn-ghost btn-sm job-retry" onClick={() => onRetry(job.id)}><RotateCw size={12} /> Retry</button>}
    </td>
  );
}

/** Mock automations per order: invoice, WhatsApp confirmation and status messages, with the event log. */
export default function AutomationsPage() {
  const { orders, mounted, findOrder } = useStore();
  const { jobs, log, invoices, outbox } = useAutomation();
  const [open, setOpen] = useState<string | null>(null);
  if (!mounted) return <div className="page-loader" />;
  const tracked = orders.filter((o) => jobs.some((j) => j.orderId === o.id));
  const retry = (id: string) => retryJob(id, () => findOrder(id.split(':')[1]));
  const detail = open ? findOrder(open) : undefined;
  const inv = open ? invoices[open] : undefined;
  return (
    <div>
      <div className="admin-top">
        <div>
          <div className="eyebrow">Automations (simulated)</div>
          <h1 className="display admin-title">Invoices and messages.</h1>
          <div className="muted">Every order triggers an invoice and a WhatsApp confirmation, and status changes send updates. Nothing leaves this browser: the providers are mocks.</div>
        </div>
      </div>
      <section className="panel analytics-block">
        <div className="panel-head"><h2>Orders</h2><span className="small muted">{tracked.length} with automations</span></div>
        {tracked.length === 0 ? <p className="muted">No orders placed from the shop yet.</p> : (
          <div className="table-wrap"><table className="table automation-table">
            <thead><tr><th>Order</th><th>Status</th><th>Total</th><th>Invoice</th><th>WhatsApp</th><th>Updates sent</th><th /></tr></thead>
            <tbody>{tracked.map((o) => {
              const updates = jobs.filter((j) => j.orderId === o.id && j.topic.startsWith('status:'));
              return (
                <tr key={o.id} data-order={o.id}>
                  <td><strong>{o.id}</strong><div className="small muted">{clock(o.createdAt)}{o.items.some((l) => l.custom) ? ' · custom cake' : ''}</div></td>
                  <td><StatusBadge status={o.status} /></td>
                  <td>{rupees(o.total)}</td>
                  <JobCell job={jobs.find((j) => j.id === `invoice:${o.id}:confirmation`)} onRetry={retry} />
                  <JobCell job={jobs.find((j) => j.id === `whatsapp:${o.id}:confirmation`)} onRetry={retry} />
                  <td>{updates.filter((u) => u.status === 'succeeded').length}/{updates.length}</td>
                  <td><button type="button" className="text-link" onClick={() => setOpen(open === o.id ? null : o.id)}>{open === o.id ? 'Hide' : 'Details'}</button></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </section>
      {detail && (
        <section className="panel analytics-block automation-detail">
          <div className="panel-head"><h2>{detail.id}</h2></div>
          <div className="analytics-grid">
            <div>
              <h3 className="small muted">Invoice {inv ? inv.invoiceNumber : '(not generated)'}</h3>
              {inv && (
                <div className="invoice">
                  {inv.lines.map((l, i) => <div key={i} className="invoice-line"><span>{l.qty} × {l.description}{l.detail.length > 0 && <small>{l.detail.join(' · ')}</small>}</span><span>{rupees(l.amount)}</span></div>)}
                  <div className="invoice-line"><span>Delivery</span><span>{rupees(inv.delivery)}</span></div>
                  <div className="invoice-line invoice-total"><span>Total</span><span>{rupees(inv.total)}</span></div>
                  <p className="small muted">{invoiceIsConsistent(inv, detail) ? 'Matches the order.' : 'Does not match the order.'} {inv.note}</p>
                </div>
              )}
            </div>
            <div>
              <h3 className="small muted">WhatsApp outbox (mock)</h3>
              {outbox.filter((m) => m.orderId === detail.id).map((m) => <pre key={m.jobId} className="wa-message">{m.text}<small>{m.jobId.split(':')[2]} · {clock(m.sentAt)}</small></pre>)}
            </div>
          </div>
        </section>
      )}
      <section className="panel analytics-block">
        <div className="panel-head"><h2>Event log</h2><span className="small muted">Latest {Math.min(60, log.length)} of {log.length}</span></div>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Time</th><th>Event</th><th>Order</th><th>Status</th><th>Detail</th></tr></thead>
          <tbody>{[...log].reverse().slice(0, 60).map((e) => <tr key={e.id}><td>{clock(e.timestamp)}</td><td><code>{e.type}</code></td><td>{e.orderId}</td><td>{e.status}</td><td className="small muted">{e.detail}</td></tr>)}</tbody>
        </table></div>
      </section>
    </div>
  );
}
