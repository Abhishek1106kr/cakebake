'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Lock, MessageCircle, Plus } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { useAdmin } from '@/components/admin/admin-provider';
import { Badge, Chips, Drawer, Empty, Field, Guard, Kpi, PageHeader, Pager, Panel, SearchField, ago, dateTime, rupees, useUrlParam } from '@/components/admin/ui';
import {
  addCustomerMessage, addInternalNote, assignIssue, ISSUE_CATEGORY_LABEL, ISSUE_PRIORITY_LABEL, ISSUE_STATUS_LABEL, ISSUE_TRANSITIONS, isOpenIssue, moveIssue, newIssue, queryIssues, type IssueFilter,
} from '@/lib/admin/issues';
import { paginate } from '@/lib/admin/order-ops';
import { toCsv, downloadText, stamp } from '@/lib/admin/csv';
import type { IssueCategory, IssuePriority, IssueStatus, SeedIssue } from '@/lib/mock-data/types';

type Tone = 'ok' | 'info' | 'bad' | 'warn' | 'muted' | 'neutral';
const STATUS_TONE: Record<IssueStatus, Tone> = { OPEN: 'bad', ACKNOWLEDGED: 'warn', INVESTIGATING: 'info', WAITING_CUSTOMER: 'neutral', RESOLVED: 'ok', CLOSED: 'muted' };
const PRIORITY_TONE: Record<IssuePriority, Tone> = { URGENT: 'bad', HIGH: 'warn', NORMAL: 'neutral', LOW: 'muted' };
const VIEWS: { id: IssueFilter['view']; label: string }[] = [
  { id: 'open', label: 'Open' }, { id: 'OPEN', label: 'New' }, { id: 'INVESTIGATING', label: 'Investigating' }, { id: 'WAITING_CUSTOMER', label: 'Waiting' },
  { id: 'RESOLVED', label: 'Resolved' }, { id: 'CLOSED', label: 'Closed' }, { id: 'all', label: 'All' },
];
const CATEGORIES = Object.keys(ISSUE_CATEGORY_LABEL) as IssueCategory[];
const PRIORITIES = Object.keys(ISSUE_PRIORITY_LABEL) as IssuePriority[];

export default function IssuesPage() {
  return <Guard permission="issues.view"><Issues /></Guard>;
}

function Issues() {
  const { findOrder } = useStore();
  const admin = useAdmin();
  const [view, setView] = useUrlParam('view', 'open');
  const [category, setCategory] = useUrlParam('category', 'ALL');
  const [priority, setPriority] = useUrlParam('priority', 'ALL');
  const [assignee, setAssignee] = useUrlParam('assignee', 'ALL');
  const [query, setQuery] = useUrlParam('q', '');
  const [openId, setOpenId] = useUrlParam('issue', '');
  const [creating, setCreating] = useUrlParam('new', '');
  const [page, setPage] = useState(1);
  const customerName = (i: SeedIssue) => findOrder(i.orderId)?.customer.name ?? i.customerId;

  const f: IssueFilter = {
    view: (VIEWS.some((v) => v.id === view) ? view : 'open') as IssueFilter['view'],
    category: (CATEGORIES.includes(category as IssueCategory) ? category : 'ALL') as IssueFilter['category'],
    priority: (PRIORITIES.includes(priority as IssuePriority) ? priority : 'ALL') as IssueFilter['priority'],
    assignee, query,
  };
  const shown = useMemo(() => queryIssues(admin.issues, f, customerName),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [admin.issues, f.view, f.category, f.priority, assignee, query]);
  const counts = useMemo(() => Object.fromEntries(VIEWS.map((v) => [v.id, admin.issues.filter((i) => v.id === 'all' || (v.id === 'open' ? isOpenIssue(i) : i.status === v.id)).length])), [admin.issues]);
  const paged = paginate(shown, page, 25);
  useEffect(() => { setPage(1); }, [f.view, f.category, f.priority, assignee, query]);
  const open = admin.issues.find((i) => i.id === openId) ?? null;

  const week = admin.now.getTime() - 7 * 86_400_000;
  const openList = admin.issues.filter(isOpenIssue);
  const resolvedWeek = admin.issues.filter((i) => i.resolvedAt && new Date(i.resolvedAt).getTime() >= week);
  const resolveHours = resolvedWeek.length ? resolvedWeek.reduce((s, i) => s + (new Date(i.resolvedAt!).getTime() - new Date(i.createdAt).getTime()) / 3_600_000, 0) / resolvedWeek.length : null;
  const staff = admin.staffList.filter((s) => s.active);

  const csv = () => downloadText(`tresor-issues-${stamp()}.csv`, toCsv([
    ['Issue', 'Order', 'Customer', 'Category', 'Priority', 'Status', 'Assigned to', 'Opened', 'Resolved', 'Resolution'],
    ...shown.map((i) => [i.id, i.orderId, customerName(i), ISSUE_CATEGORY_LABEL[i.category], ISSUE_PRIORITY_LABEL[i.priority], ISSUE_STATUS_LABEL[i.status], admin.staffName(i.assignedTo), i.createdAt, i.resolvedAt ?? '', i.resolution ?? '']),
  ]));

  return (
    <div>
      <PageHeader eyebrow="Support" title="Issues" description="Customer problems with an order: what happened, who is on it, what was said and how it was resolved. Internal notes stay with the team; replies are recorded here (simulated, nothing is sent)."
        actions={<>
          {admin.can('issues.manage') && <button type="button" className="ad-btn ad-btn-primary" onClick={() => setCreating('1')}><Plus size={14} /> New issue</button>}
          <button type="button" className="ad-btn" onClick={csv}>Export ({shown.length}) <ArrowUpRight size={14} /></button>
        </>} />

      <div className="ad-kpis">
        <Kpi label="Open" value={openList.length} meta={`${openList.filter((i) => !i.assignedTo).length} unassigned`} tone={openList.some((i) => !i.assignedTo) ? 'warn' : undefined} href="/admin/issues?view=open" />
        <Kpi label="Urgent or high" value={openList.filter((i) => i.priority === 'URGENT' || i.priority === 'HIGH').length} meta="open now" tone={openList.some((i) => i.priority === 'URGENT') ? 'bad' : undefined} />
        <Kpi label="Waiting for customer" value={openList.filter((i) => i.status === 'WAITING_CUSTOMER').length} meta="no action until they reply" href="/admin/issues?view=WAITING_CUSTOMER" />
        <Kpi label="Resolved this week" value={resolvedWeek.length} meta={resolveHours === null ? '—' : `average ${Math.round(resolveHours)} h to resolve`} />
      </div>

      <Panel>
        <div className="ad-toolbar"><Chips label="Issue view" items={VIEWS} value={f.view} onChange={setView} counts={counts} /></div>
        <div className="ad-toolbar">
          <select className="ad-select" value={f.category} onChange={(e) => setCategory(e.target.value)} aria-label="Category"><option value="ALL">Any category</option>{CATEGORIES.map((c) => <option key={c} value={c}>{ISSUE_CATEGORY_LABEL[c]}</option>)}</select>
          <select className="ad-select" value={f.priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority"><option value="ALL">Any priority</option>{PRIORITIES.map((p) => <option key={p} value={p}>{ISSUE_PRIORITY_LABEL[p]}</option>)}</select>
          <select className="ad-select" value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Assigned to"><option value="ALL">Anyone</option><option value="UNASSIGNED">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <SearchField value={query} onChange={setQuery} placeholder="Issue, order, customer or words" label="Search issues" />
        </div>
        {shown.length === 0 ? <Empty>{f.view === 'open' ? 'No open issues. Nice.' : 'No issues match.'}</Empty> : (
          <div className="ad-table-wrap">
            <table className="table ad-cards">
              <thead><tr><th>Issue</th><th>Order</th><th>Customer</th><th>Category</th><th>Priority</th><th>Status</th><th>Assigned</th><th>Opened</th></tr></thead>
              <tbody>{paged.items.map((i) => (
                <tr key={i.id} data-issue={i.id}>
                  <td data-label="Issue"><button type="button" className="ad-link ad-rowlink ad-mono" onClick={() => setOpenId(i.id)}>{i.id}</button><span className="ad-sub">{i.description.slice(0, 70)}{i.description.length > 70 ? '…' : ''}</span></td>
                  <td data-label="Order"><Link className="ad-rowlink" href={`/admin/orders/${i.orderId}` as Route}>{i.orderId}</Link></td>
                  <td data-label="Customer">{customerName(i)}<span className="ad-sub">{i.customerId}</span></td>
                  <td data-label="Category">{ISSUE_CATEGORY_LABEL[i.category]}</td>
                  <td data-label="Priority"><Badge tone={PRIORITY_TONE[i.priority]}>{ISSUE_PRIORITY_LABEL[i.priority]}</Badge></td>
                  <td data-label="Status"><Badge tone={STATUS_TONE[i.status]}>{ISSUE_STATUS_LABEL[i.status]}</Badge></td>
                  <td data-label="Assigned">{i.assignedTo ? admin.staffName(i.assignedTo) : <span className="ad-muted">Unassigned</span>}</td>
                  <td data-label="Opened">{ago(i.createdAt, admin.now)}<span className="ad-sub">{dateTime(i.createdAt)}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <Pager page={paged.page} pages={paged.pages} total={paged.total} onPage={setPage} label="issues" />
      </Panel>

      {open && <IssueDrawer issue={open} onClose={() => setOpenId('')} />}
      {creating && <NewIssueDrawer onClose={() => setCreating('')} onCreated={(id) => { setCreating(''); setOpenId(id); }} />}
    </div>
  );
}

function IssueDrawer({ issue, onClose }: { issue: SeedIssue; onClose: () => void }) {
  const { findOrder } = useStore();
  const admin = useAdmin();
  const [note, setNote] = useState('');
  const [reply, setReply] = useState('');
  const order = findOrder(issue.orderId);
  const me = admin.staff?.id ?? 'staff-owner';
  const canManage = admin.can('issues.manage');
  const label = `${issue.id} · ${issue.orderId}`;

  const save = (next: SeedIssue, action: string, before: unknown, after: unknown, success: string, reason?: string | null, permission: 'issues.manage' | 'issues.assign' = 'issues.manage') =>
    admin.act({ permission, action, entity: { type: 'issue', id: issue.id, label: issue.orderId }, before, after, reason: reason ?? null, run: () => admin.saveIssue(next), success });

  const move = async (to: IssueStatus) => {
    let resolution: string | undefined;
    if (to === 'RESOLVED' || to === 'CLOSED') {
      const r = await admin.confirm({
        title: to === 'RESOLVED' ? `Resolve ${issue.id}?` : `Close ${issue.id}?`,
        impact: to === 'RESOLVED' ? ['Records how it was resolved; the customer sees nothing until you reply.', 'Can be reopened while resolved; closing makes it final.'] : ['Closing is final: a closed issue can’t be reopened.'],
        confirmLabel: to === 'RESOLVED' ? 'Resolve' : 'Close issue', tone: 'primary', reason: to === 'RESOLVED' ? 'required' : 'optional',
      });
      if (!r.ok) return;
      resolution = r.reason;
    }
    const res = moveIssue(issue, to, new Date(), resolution);
    if (!res.ok) { admin.toast({ tone: 'error', title: 'Not changed', detail: res.reason }); return; }
    save(res.issue, `issue.${to.toLowerCase()}`, { status: issue.status }, { status: to }, `${issue.id} · ${ISSUE_STATUS_LABEL[to]}`, resolution);
  };

  return (
    <Drawer open wide onClose={onClose} title={issue.id} subtitle={<><Badge tone={STATUS_TONE[issue.status]}>{ISSUE_STATUS_LABEL[issue.status]}</Badge><Badge tone={PRIORITY_TONE[issue.priority]}>{ISSUE_PRIORITY_LABEL[issue.priority]}</Badge><span>{ISSUE_CATEGORY_LABEL[issue.category]}</span></>}
      footer={canManage && ISSUE_TRANSITIONS[issue.status].length > 0 ? <>{ISSUE_TRANSITIONS[issue.status].map((to) => (
        <button key={to} type="button" className={`ad-btn ${to === 'RESOLVED' ? 'ad-btn-primary' : ''}`} onClick={() => move(to)}>{to === 'INVESTIGATING' && issue.status === 'RESOLVED' ? 'Reopen' : ISSUE_STATUS_LABEL[to]}</button>
      ))}</> : undefined}>
      <p>{issue.description}</p>
      <dl className="ad-dl">
        <dt>Order</dt><dd><Link className="ad-link" href={`/admin/orders/${issue.orderId}` as Route}>{issue.orderId}</Link>{order && <span className="ad-sub">{order.customer.name} · {rupees(order.total)} · {order.items.length} line{order.items.length === 1 ? '' : 's'}</span>}</dd>
        <dt>Customer</dt><dd><Link className="ad-link" href={`/admin/customers?q=${encodeURIComponent(order?.customer.name ?? issue.customerId)}` as Route}>{order?.customer.name ?? issue.customerId}</Link><span className="ad-sub">{issue.customerId}</span></dd>
        <dt>Assigned to</dt><dd>{admin.can('issues.assign') ? (
          <select className="ad-select" value={issue.assignedTo ?? ''} aria-label="Assign to" onChange={(e) => { const to = e.target.value || null; save(assignIssue(issue, to, new Date()), 'issue.assigned', { assignedTo: issue.assignedTo }, { assignedTo: to }, to ? `Assigned to ${admin.staffName(to)}` : 'Unassigned', null, 'issues.assign'); }}>
            <option value="">Unassigned</option>{admin.staffList.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        ) : admin.staffName(issue.assignedTo)}</dd>
        <dt>Opened</dt><dd>{dateTime(issue.createdAt)} <span className="ad-muted">({ago(issue.createdAt, admin.now)})</span></dd>
        {issue.resolvedAt && <><dt>Resolved</dt><dd>{dateTime(issue.resolvedAt)}<span className="ad-sub">{issue.resolution}</span></dd></>}
        {issue.refundId && <><dt>Refund</dt><dd><Link className="ad-link" href={`/admin/payments?q=${issue.orderId}` as Route}>{issue.refundId}</Link></dd></>}
        {order?.paymentStatus === 'REFUND_PENDING' && <><dt>Payment</dt><dd><Badge tone="warn">Refund pending</Badge> <Link className="ad-link" href={`/admin/payments?q=${issue.orderId}` as Route}>Complete it in Payments</Link></dd></>}
      </dl>

      <h3 className="ad-section-title"><MessageCircle size={14} aria-hidden /> Conversation with the customer</h3>
      {issue.messages.length === 0 ? <p className="ad-muted small">No messages yet.</p> : (
        <ul className="ad-thread">{issue.messages.map((m, k) => (
          <li key={k} className={m.direction === 'outbound' ? 'is-out' : 'is-in'}>
            <span className="ad-thread-meta">{m.direction === 'outbound' ? `${admin.staffName(m.by)} · ${m.channel}` : `Customer · ${m.channel}`} · {dateTime(m.at)}</span>
            <span>{m.body}</span>
          </li>
        ))}</ul>
      )}
      {canManage && issue.status !== 'CLOSED' && (
        <form className="ad-row" onSubmit={(e) => { e.preventDefault(); const r = addCustomerMessage(issue, me, reply, new Date()); if (!r.ok) { admin.toast({ tone: 'error', title: r.reason }); return; } save(r.issue, 'issue.replied', null, { message: reply.trim().slice(0, 80) }, 'Reply recorded (simulated, not sent)'); setReply(''); }}>
          <input className="ad-input" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to the customer (simulated: recorded, not sent)" aria-label="Reply to the customer" maxLength={1000} />
          <button className="ad-btn ad-btn-sm" type="submit">Record reply</button>
        </form>
      )}

      <h3 className="ad-section-title"><Lock size={14} aria-hidden /> Internal notes (team only)</h3>
      {issue.internalNotes.length === 0 ? <p className="ad-muted small">No notes yet.</p> : (
        <ul className="ad-lines">{issue.internalNotes.map((n, k) => <li key={k} className="ad-note-item"><span>{n.body}</span><span className="ad-muted small">{admin.staffName(n.by)} · {dateTime(n.at)}</span></li>)}</ul>
      )}
      {canManage && issue.status !== 'CLOSED' && (
        <form className="ad-row" onSubmit={(e) => { e.preventDefault(); const r = addInternalNote(issue, me, note, new Date()); if (!r.ok) { admin.toast({ tone: 'error', title: r.reason }); return; } save(r.issue, 'issue.noted', null, { note: note.trim().slice(0, 80) }, 'Note added'); setNote(''); }}>
          <input className="ad-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note" aria-label="Add an internal note" maxLength={1000} />
          <button className="ad-btn ad-btn-sm" type="submit">Add note</button>
        </form>
      )}
      <p className="ad-muted small">{label}</p>
    </Drawer>
  );
}

function NewIssueDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { findOrder } = useStore();
  const admin = useAdmin();
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const [orderId, setOrderId] = useState(params?.get('order') ?? '');
  const [category, setCategory] = useState<IssueCategory>('MISSING_ITEM');
  const [priority, setPriority] = useState<IssuePriority>('NORMAL');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const order = findOrder(orderId.trim().toUpperCase());

  const submit = () => {
    if (!order) { setError('Enter an existing order number, e.g. TRS-09139.'); return; }
    const customerId = (order as { customerId?: string }).customerId ?? admin.customerByPhone.get(order.customer.phone)?.id ?? order.customer.phone;
    const r = newIssue({ orderId: order.id, customerId, category, priority, description, existing: admin.issues, at: new Date() });
    if (!r.ok) { setError(r.reason); return; }
    const res = admin.act({ permission: 'issues.manage', action: 'issue.created', entity: { type: 'issue', id: r.issue.id, label: order.id }, after: { category, priority }, run: () => admin.saveIssue(r.issue), success: `${r.issue.id} opened for ${order.id}` });
    if (res.ok) onCreated(r.issue.id);
  };

  return (
    <Drawer open onClose={onClose} title="New issue" subtitle="Record a customer problem with an order"
      footer={<><button type="button" className="ad-btn" onClick={onClose}>Cancel</button><button type="button" className="ad-btn ad-btn-primary" onClick={submit}>Open issue</button></>}>
      <div className="ad-form">
        <Field label="Order" error={error && !order ? error : undefined} hint={order ? `${order.customer.name} · ${rupees(order.total)}` : undefined}><input value={orderId} onChange={(e) => { setOrderId(e.target.value); setError(null); }} placeholder="TRS-09139" /></Field>
        <Field label="Category"><select value={category} onChange={(e) => setCategory(e.target.value as IssueCategory)}>{CATEGORIES.map((c) => <option key={c} value={c}>{ISSUE_CATEGORY_LABEL[c]}</option>)}</select></Field>
        <Field label="Priority"><select value={priority} onChange={(e) => setPriority(e.target.value as IssuePriority)}>{PRIORITIES.map((p) => <option key={p} value={p}>{ISSUE_PRIORITY_LABEL[p]}</option>)}</select></Field>
        <Field label="What happened" wide error={error && order ? error : undefined}><textarea rows={4} value={description} onChange={(e) => { setDescription(e.target.value); setError(null); }} placeholder="e.g. The chocolate brownie was missing from the bag." /></Field>
      </div>
    </Drawer>
  );
}
