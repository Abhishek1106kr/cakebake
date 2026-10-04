'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Lock } from 'lucide-react';
import { useAdmin } from '@/components/admin/admin-provider';
import { Toggle } from '@/components/admin/forms';
import { Badge, Chips, Drawer, Empty, Guard, Kpi, OrderStatusBadge, PageHeader, Pager, Panel, SearchField, dateTime, rupees, useUrlParam } from '@/components/admin/ui';
import { DEFAULT_PREFS, LIFECYCLE_LABEL, LIFECYCLE_RULES, customersCsvRows, searchCustomers, type Customer, type Lifecycle } from '@/lib/admin/customers';
import { maskEmail, maskPhone } from '@/lib/admin/permissions';
import { paginate } from '@/lib/admin/order-ops';
import { toCsv, downloadText, stamp } from '@/lib/admin/csv';

type LF = 'ALL' | Lifecycle;
const FILTERS: { id: LF; label: string }[] = [{ id: 'ALL', label: 'All' }, ...(['NEW', 'ACTIVE', 'RETURNING', 'HIGH_VALUE', 'AT_RISK', 'INACTIVE'] as Lifecycle[]).map((id) => ({ id, label: LIFECYCLE_LABEL[id] }))];
const TONE: Record<Lifecycle, 'info' | 'ok' | 'neutral' | 'warn' | 'muted'> = { NEW: 'info', ACTIVE: 'ok', RETURNING: 'ok', HIGH_VALUE: 'neutral', AT_RISK: 'warn', INACTIVE: 'muted' };
type Sort = 'recent' | 'spend' | 'orders';

export default function CustomersPage() {
  return <Guard permission="customers.view"><Customers /></Guard>;
}

function Customers() {
  const admin = useAdmin();
  const [filter, setFilter] = useUrlParam('lifecycle', 'ALL');
  const [query, setQuery] = useUrlParam('q', '');
  const [openId, setOpenId] = useUrlParam('c', '');
  const [sort, setSort] = useState<Sort>('recent');
  const [hideSamples, setHideSamples] = useState(false);
  const [page, setPage] = useState(1);
  const pii = admin.can('customers.pii');
  const f = (FILTERS.some((x) => x.id === filter) ? filter : 'ALL') as LF;
  const base = admin.customers.filter((c) => !hideSamples || !c.sample);
  const shown = useMemo(() => {
    const list = searchCustomers(base, pii ? query : query.replace(/\d{3,}/g, '')).filter((c) => f === 'ALL' || c.lifecycle === f);
    return [...list].sort((a, b) => (sort === 'spend' ? b.totalSpend - a.totalSpend : sort === 'orders' ? b.orderCount - a.orderCount : b.lastOrderAt.localeCompare(a.lastOrderAt)));
  }, [base, query, f, sort, pii]);
  const counts = Object.fromEntries(FILTERS.map((x) => [x.id, base.filter((c) => x.id === 'ALL' || c.lifecycle === x.id).length])) as Record<LF, number>;
  const paged = paginate(shown, page, 30);
  useEffect(() => { setPage(1); }, [f, query, sort, hideSamples]);
  const open = admin.customers.find((c) => c.id === openId);
  const totalSpend = base.reduce((s, c) => s + c.totalSpend, 0);

  return (
    <div>
      <PageHeader eyebrow="Customers" title="Customers" description="Built from orders: one customer per mobile number. Labels come from fixed rules on order dates and spend only."
        actions={admin.can('customers.export') && <button type="button" className="ad-btn" onClick={() => downloadText(`tresor-customers-${stamp()}.csv`, toCsv(customersCsvRows(shown, pii)))}>Export ({shown.length}){!pii && ' · no contact details'} <ArrowUpRight size={14} /></button>} />
      <div className="ad-kpis">
        <Kpi label="Customers" value={base.length} />
        <Kpi label="Returning" value={base.filter((c) => c.orderCount >= 2).length} meta="2+ orders" />
        <Kpi label="High value" value={counts.HIGH_VALUE} />
        <Kpi label="At risk" value={counts.AT_RISK} tone={counts.AT_RISK ? 'warn' : undefined} />
        <Kpi label="Average spend" value={rupees(base.length ? totalSpend / base.length : 0)} />
      </div>
      <Panel>
        <div className="ad-toolbar"><Chips label="Lifecycle" items={FILTERS} value={f} onChange={setFilter} counts={counts} /></div>
        <div className="ad-toolbar">
          <select className="ad-select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort customers"><option value="recent">Last order</option><option value="spend">Total spend</option><option value="orders">Orders</option></select>
          <label className="ad-toggle small"><input type="checkbox" checked={hideSamples} onChange={(e) => setHideSamples(e.target.checked)} /> Hide sample customers</label>
          <SearchField value={query} onChange={setQuery} placeholder={pii ? 'Name, phone, email or order number' : 'Name or order number'} label="Search customers" />
        </div>
        {!pii && <p className="ad-muted small"><Lock size={12} aria-hidden /> Phone numbers and emails are hidden for your role.</p>}
        {shown.length === 0 ? <Empty>No customers match.</Empty> : (
          <div className="ad-table-wrap">
            <table className="table ad-cards">
              <thead><tr><th>Customer</th><th>Phone</th><th>Email</th><th className="num">Orders</th><th className="num">Total spend</th><th className="num">Avg order</th><th>Last order</th><th>Status</th></tr></thead>
              <tbody>{paged.items.map((c) => (
                <tr key={c.id}>
                  <td data-label="Customer"><button type="button" className="ad-link ad-rowlink" onClick={() => setOpenId(c.id)}>{c.name}</button>{c.sample && <span className="ad-sub">sample</span>}</td>
                  <td data-label="Phone">{pii ? c.phone : maskPhone(c.phone)}</td>
                  <td data-label="Email">{c.email ? (pii ? c.email : maskEmail(c.email)) : <span className="ad-muted">—</span>}</td>
                  <td data-label="Orders" className="num">{c.orderCount}</td>
                  <td data-label="Total spend" className="num">{rupees(c.totalSpend)}</td>
                  <td data-label="Avg order" className="num">{rupees(c.averageOrder)}</td>
                  <td data-label="Last order">{dateTime(c.lastOrderAt)}</td>
                  <td data-label="Status"><Badge tone={TONE[c.lifecycle]}>{LIFECYCLE_LABEL[c.lifecycle]}</Badge></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <Pager page={paged.page} pages={paged.pages} total={paged.total} onPage={setPage} label="customers" />
      </Panel>
      {open && <CustomerDrawer customer={open} onClose={() => setOpenId('')} />}
    </div>
  );
}

function CustomerDrawer({ customer: c, onClose }: { customer: Customer; onClose: () => void }) {
  const admin = useAdmin();
  const pii = admin.can('customers.pii');
  const canEdit = admin.can('customers.edit');
  const profile = admin.profiles[c.id] ?? { id: c.id, prefs: DEFAULT_PREFS, notes: '', updatedAt: '' };
  const [notes, setNotes] = useState(profile.notes);
  useEffect(() => { setNotes(profile.notes); }, [profile.notes]);
  const rule = LIFECYCLE_RULES.find((r) => r.id === c.lifecycle)!;
  const cakes = c.orders.filter((o) => o.items.some((l) => l.custom));

  const savePrefs = (key: keyof typeof DEFAULT_PREFS, value: boolean) => admin.act({
    permission: 'customers.edit', action: 'customer.preferences.changed', entity: { type: 'customer', id: c.id, label: c.name },
    before: { [key]: profile.prefs[key] }, after: { [key]: value }, reason: 'Recorded on the customer’s request',
    run: () => admin.saveProfile({ ...profile, prefs: { ...profile.prefs, [key]: value }, updatedAt: new Date().toISOString() }), success: 'Preference saved',
  });
  const saveNotes = () => admin.act({
    permission: 'customers.edit', action: 'customer.notes.changed', entity: { type: 'customer', id: c.id, label: c.name }, before: { notes: profile.notes }, after: { notes },
    run: () => admin.saveProfile({ ...profile, notes: notes.slice(0, 1000), updatedAt: new Date().toISOString() }), success: 'Note saved (staff only)',
  });

  return (
    <Drawer open onClose={onClose} wide title={c.name} subtitle={<><Badge tone={TONE[c.lifecycle]}>{LIFECYCLE_LABEL[c.lifecycle]}</Badge><span title={rule.rule}>{rule.rule}</span></>}>
      <div className="ad-kpis">
        <Kpi label="Orders" value={c.orderCount} meta={c.orders.length > c.orderCount ? `${c.orders.length - c.orderCount} cancelled` : undefined} />
        <Kpi label="Total spend" value={rupees(c.totalSpend)} />
        <Kpi label="Average order" value={rupees(c.averageOrder)} />
        <Kpi label="Last purchase" value={new Date(c.lastOrderAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} meta={`First ${new Date(c.firstOrderAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`} />
        <Kpi label="Top category" value={c.topCategory ?? '—'} />
      </div>
      <div className="ad-detail-grid">
        <section>
          <h3 className="ad-section-title">Profile</h3>
          <dl className="ad-dl">
            <dt>Phone</dt><dd>{pii ? c.phone : maskPhone(c.phone)}</dd>
            <dt>Email</dt><dd>{c.email ? (pii ? c.email : maskEmail(c.email)) : '—'}</dd>
            <dt>Last address</dt><dd>{pii ? c.address : 'Hidden for your role'}</dd>
          </dl>
          <h3 className="ad-section-title">Favourites</h3>
          {c.favorites.length === 0 ? <p className="ad-muted small">No menu items yet.</p> : <ul className="ad-lines">{c.favorites.map((f) => <li key={f.productId}><span>{f.name}</span><span className="ad-num">{f.qty}</span></li>)}</ul>}
          <h3 className="ad-section-title">Saved designs</h3>
          <p className="ad-muted small">Cake designs are saved on the customer’s own device and aren’t shared with the bakery. Designs they ordered are listed under custom cakes.</p>
        </section>
        <section>
          <h3 className="ad-section-title">Preferences</h3>
          <div className="ad-stack-tight">
            <Toggle checked={profile.prefs.whatsappUpdates} disabled={!canEdit} onChange={(v) => savePrefs('whatsappUpdates', v)} label="WhatsApp order updates" />
            <Toggle checked={profile.prefs.whatsappMarketing} disabled={!canEdit} onChange={(v) => savePrefs('whatsappMarketing', v)} label="WhatsApp offers (opt-in)" />
            <Toggle checked={profile.prefs.emailMarketing} disabled={!canEdit} onChange={(v) => savePrefs('emailMarketing', v)} label="Email offers (opt-in)" />
          </div>
          <p className="ad-muted small">Offers stay off until the customer asks for them. Changes are recorded in the audit log.</p>
          <h3 className="ad-section-title"><Lock size={12} aria-hidden /> Notes · staff only</h3>
          <textarea className="ad-textarea" rows={3} value={notes} disabled={!canEdit} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Prefers delivery after 6 pm" aria-label="Staff notes about this customer" />
          {canEdit && <div className="ad-row" style={{ justifyContent: 'flex-end', marginTop: 6 }}><button type="button" className="ad-btn ad-btn-sm" disabled={notes === profile.notes} onClick={saveNotes}>Save note</button></div>}
        </section>
      </div>
      <h3 className="ad-section-title">Order history</h3>
      <table className="table ad-cards"><thead><tr><th>Order</th><th>Placed</th><th>Items</th><th>Status</th><th className="num">Total</th></tr></thead>
        <tbody>{c.orders.map((o) => <tr key={o.id}><td data-label="Order"><Link className="ad-rowlink" href={`/admin/orders/${o.id}` as Route}>{o.id}</Link></td><td data-label="Placed">{dateTime(o.createdAt)}</td><td data-label="Items" className="cell-items">{o.items.map((l) => `${l.qty} × ${l.product.name}`).join(', ')}</td><td data-label="Status"><OrderStatusBadge status={o.status} /></td><td data-label="Total" className="num">{rupees(o.total)}</td></tr>)}</tbody>
      </table>
      <h3 className="ad-section-title">Custom cakes ({c.customCakes})</h3>
      {cakes.length === 0 ? <p className="ad-muted small">None yet.</p> : <ul className="ad-lines">{cakes.flatMap((o) => o.items.filter((l) => l.custom).map((l) => <li key={`${o.id}:${l.lineId}`}><Link className="ad-rowlink" href={`/admin/custom-cakes?order=${o.id}` as Route}>{l.custom!.title}</Link><span className="ad-muted small">{o.id} · {rupees(l.unitPrice)}</span></li>))}</ul>}
    </Drawer>
  );
}
