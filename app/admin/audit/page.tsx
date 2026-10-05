'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useAdmin } from '@/components/admin/admin-provider';
import { Drawer, Empty, Guard, PageHeader, Pager, Panel, SearchField, dateTime, useUrlParam } from '@/components/admin/ui';
import { describeChange, diff, filterAudit, type AuditRecord, type EntityType } from '@/lib/admin/audit';
import { paginate } from '@/lib/admin/order-ops';
import { toCsv, downloadText, stamp } from '@/lib/admin/csv';

const TYPES: EntityType[] = ['order', 'inventory', 'product', 'cakeOption', 'cakeRule', 'printRules', 'customer', 'invoice', 'automation', 'campaign', 'content', 'media', 'staff', 'settings', 'customCake', 'notification', 'decision', 'session', 'issue', 'payment'];
const show = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

export default function AuditPage() {
  return <Guard permission="audit.view"><Audit /></Guard>;
}

function Audit() {
  const admin = useAdmin();
  const [query, setQuery] = useUrlParam('q', '');
  const [type, setType] = useUrlParam('type', 'ALL');
  const [actor, setActor] = useUrlParam('actor', 'ALL');
  const [openId, setOpenId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const shown = useMemo(() => filterAudit(admin.audit, { query, entityType: type as EntityType | 'ALL', actorId: actor }), [admin.audit, query, type, actor]);
  const actors = useMemo(() => [...new Map(admin.audit.map((r) => [r.actor.id, r.actor.name])).entries()], [admin.audit]);
  const paged = paginate(shown, page, 50);
  useEffect(() => { setPage(1); }, [query, type, actor]);
  const open = admin.audit.find((r) => r.id === openId);
  const csv = () => downloadText(`tresor-audit-${stamp()}.csv`, toCsv([['Time', 'Actor', 'Role', 'Action', 'Entity type', 'Entity', 'Change', 'Reason', 'Source'], ...shown.map((r) => [r.at, r.actor.name, r.actor.role, r.action, r.entity.type, r.entity.label ? `${r.entity.id} (${r.entity.label})` : r.entity.id, describeChange(r), r.reason ?? '', r.source])]));

  return (
    <div>
      <PageHeader eyebrow="System" title="Audit log" description="Every change made in the admin: who, what, before, after, when, why and from where. Append-only: records are never edited or removed."
        actions={<button type="button" className="ad-btn" onClick={csv}>Export ({shown.length}) <ArrowUpRight size={14} /></button>} />
      <Panel>
        <div className="ad-toolbar">
          <select className="ad-select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Entity type"><option value="ALL">Everything</option>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          <select className="ad-select" value={actor} onChange={(e) => setActor(e.target.value)} aria-label="Who"><option value="ALL">Anyone</option>{actors.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
          <SearchField value={query} onChange={setQuery} placeholder="Action, record, person or reason" label="Search the audit log" />
        </div>
        {shown.length === 0 ? <Empty>{admin.audit.length ? 'No records match.' : 'No changes recorded yet. Every admin action will appear here.'}</Empty> : (
          <div className="ad-table-wrap"><table className="table ad-cards">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Change</th><th>Reason</th><th>Source</th></tr></thead>
            <tbody>{paged.items.map((r) => (
              <tr key={r.id}>
                <td data-label="When"><button type="button" className="ad-link" onClick={() => setOpenId(r.id)}>{dateTime(r.at)}</button></td>
                <td data-label="Who">{r.actor.name}<span className="ad-sub">{r.actor.role.toLowerCase()}</span></td>
                <td data-label="Action" className="ad-mono">{r.action}</td>
                <td data-label="Record">{r.entity.label ?? r.entity.id}<span className="ad-sub">{r.entity.type}{r.entity.label ? ` · ${r.entity.id}` : ''}</span></td>
                <td data-label="Change" className="ad-muted ad-audit-change">{describeChange(r)}</td>
                <td data-label="Reason">{r.reason ?? <span className="ad-muted">—</span>}</td>
                <td data-label="Source">{r.source}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <Pager page={paged.page} pages={paged.pages} total={paged.total} onPage={setPage} label="records" />
        <p className="ad-muted small">{admin.audit.length.toLocaleString('en-IN')} records: the demo’s shipped history plus changes made in this browser. In production the log is written server-side, where it can’t be changed from a browser.</p>
      </Panel>
      {open && <AuditDrawer record={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function AuditDrawer({ record: r, onClose }: { record: AuditRecord; onClose: () => void }) {
  const changes = diff(r.before, r.after);
  return (
    <Drawer open onClose={onClose} title={r.action} subtitle={<span>{dateTime(r.at)} · {r.actor.name} ({r.actor.role.toLowerCase()})</span>}>
      <dl className="ad-dl">
        <dt>Record</dt><dd>{r.entity.type} · <span className="ad-mono">{r.entity.id}</span>{r.entity.label && ` · ${r.entity.label}`}</dd>
        <dt>Reason</dt><dd>{r.reason ?? '—'}</dd>
        <dt>Source</dt><dd>{r.source}</dd>
        <dt>Record id</dt><dd className="ad-mono">{r.id}</dd>
      </dl>
      <h3 className="ad-section-title">Before → after</h3>
      {changes.length === 0 ? <p className="ad-muted small">No field-level change (an action such as a review or a retry).</p> : (
        <table className="table"><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
          <tbody>{changes.map((c) => <tr key={c.field}><td className="ad-mono">{c.field}</td><td className="ad-mono ad-wrap">{show(c.before)}</td><td className="ad-mono ad-wrap">{show(c.after)}</td></tr>)}</tbody></table>
      )}
    </Drawer>
  );
}
