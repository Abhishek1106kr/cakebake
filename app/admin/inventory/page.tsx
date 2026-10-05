'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { useAdmin } from '@/components/admin/admin-provider';
import { NumberInput } from '@/components/admin/forms';
import { Chips, Drawer, Empty, Field, Guard, Kpi, Meter, PageHeader, Panel, SearchField, Spark, StockBadge, dateTime, useUrlParam } from '@/components/admin/ui';
import { availableQty, formatQty, stockLevel, type Ingredient, type MovementReason, type StockLevel } from '@/lib/inventory';
import { stockOutlook, type StockOutlook } from '@/engine/intelligence';
import { dailyConsumption } from '@/engine/intelligence/forecast/forecast';
import { inventoryCsvRows, ordersConsuming, usageBreakdown, whyLow } from '@/lib/admin/inventory-ops';
import { toCsv, downloadText, stamp } from '@/lib/admin/csv';

type LevelFilter = 'ALL' | 'attention' | StockLevel;
const LEVELS: { id: LevelFilter; label: string }[] = [
  { id: 'attention', label: 'Needs attention' }, { id: 'CRITICAL', label: 'Critical' }, { id: 'OUT', label: 'Out' }, { id: 'LOW', label: 'Low' }, { id: 'HEALTHY', label: 'Healthy' }, { id: 'ALL', label: 'All' },
];
const MOVES: { id: MovementReason; label: string; help: string }[] = [
  { id: 'Restock', label: 'Restock', help: 'Adds to what’s on hand.' },
  { id: 'Wastage', label: 'Wastage', help: 'Removes spoiled or dropped stock.' },
  { id: 'Correction', label: 'Stock count', help: 'Sets on hand to what you counted.' },
  { id: 'Reserve', label: 'Reserve', help: 'Sets stock aside (an event, a big order). Not available to the shop.' },
  { id: 'Release', label: 'Release', help: 'Returns reserved stock to available.' },
];

export default function InventoryPage() {
  return <Guard permission="inventory.view"><Inventory /></Guard>;
}

function Inventory() {
  const { inventory, orders } = useStore();
  const admin = useAdmin();
  const { now } = admin;
  const [level, setLevel] = useUrlParam('level', 'ALL');
  const [area, setArea] = useUrlParam('area', '');
  const [query, setQuery] = useUrlParam('q', '');
  const [openId, setOpenId] = useUrlParam('item', '');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const lf = (LEVELS.some((x) => x.id === level) ? level : 'ALL') as LevelFilter;
  const outlook = useMemo(() => new Map(stockOutlook(inventory, orders, now).result.map((r) => [r.ingredientId, r])), [inventory, orders, now]);
  const matches = (i: Ingredient, f: LevelFilter) => f === 'ALL' || (f === 'attention' ? stockLevel(i) !== 'HEALTHY' : stockLevel(i) === f);
  const shown = inventory.filter((i) => matches(i, lf) && (!area || i.area === area) && (!query || i.name.toLowerCase().includes(query.toLowerCase())))
    .sort((a, b) => availableQty(a) / Math.max(a.reorderPoint, 1e-9) - availableQty(b) / Math.max(b.reorderPoint, 1e-9));
  const counts = Object.fromEntries(LEVELS.map((x) => [x.id, inventory.filter((i) => matches(i, x.id)).length])) as Record<LevelFilter, number>;
  const item = inventory.find((i) => i.id === openId);

  const review = async () => {
    const list = inventory.filter((i) => selected.has(i.id));
    const r = await admin.confirm({ title: `Mark ${list.length} ingredient${list.length === 1 ? '' : 's'} as reviewed?`, impact: ['Records in the audit log that someone checked these levels today. Stock doesn’t change.'], confirmLabel: 'Mark reviewed', reason: 'optional' });
    if (!r.ok) return;
    for (const i of list) admin.act({ permission: 'inventory.adjust', action: 'inventory.reviewed', entity: { type: 'inventory', id: i.id, label: i.name }, after: { onHand: i.onHand, reserved: i.reserved ?? 0, level: stockLevel(i) }, reason: r.reason, source: 'bulk', quiet: true, run: () => {} });
    admin.toast({ tone: 'success', title: `${list.length} reviewed` });
    setSelected(new Set());
  };

  const coverOf = (i: Ingredient) => { const o = outlook.get(i.id); return o && o.forecastDaily > 0 ? Math.round((availableQty(i) / o.forecastDaily) * 10) / 10 : null; };

  return (
    <div>
      <PageHeader eyebrow="Operations" title="Inventory" description="Orders draw stock down as they’re placed; early cancellations put it back. Every manual movement is audited."
        actions={<button type="button" className="ad-btn" onClick={() => downloadText(`tresor-inventory-${stamp()}.csv`, toCsv(inventoryCsvRows(shown, outlook)))}>Export ({shown.length}) <ArrowUpRight size={14} /></button>} />
      <div className="ad-kpis">
        <Kpi label="Out" value={counts.OUT} tone={counts.OUT ? 'bad' : undefined} />
        <Kpi label="Critical" value={counts.CRITICAL} tone={counts.CRITICAL ? 'bad' : undefined} meta="At or under half the reorder point" />
        <Kpi label="Low" value={counts.LOW} tone={counts.LOW ? 'warn' : undefined} />
        <Kpi label="Healthy" value={counts.HEALTHY} tone="ok" />
        <Kpi label="Under 1 day of cover" value={inventory.filter((i) => (coverOf(i) ?? Infinity) < 1).length} />
      </div>
      <Panel>
        <div className="ad-toolbar"><Chips label="Stock level" items={LEVELS} value={lf} onChange={setLevel} counts={counts} /></div>
        <div className="ad-toolbar">
          <select className="ad-select" value={area} onChange={(e) => setArea(e.target.value)} aria-label="Area"><option value="">All areas</option>{['Baking', 'Kitchen', 'Bar', 'Coffee'].map((a) => <option key={a}>{a}</option>)}</select>
          <SearchField value={query} onChange={setQuery} placeholder="Ingredient" label="Search ingredients" />
        </div>
        {selected.size > 0 && admin.can('inventory.adjust') && (
          <div className="ad-bulkbar" role="region" aria-label="Bulk actions"><strong>{selected.size} selected</strong>
            <button type="button" className="ad-btn ad-btn-sm" onClick={review}>Mark reviewed</button>
            <button type="button" className="ad-btn ad-btn-sm" onClick={() => downloadText(`tresor-inventory-selected-${stamp()}.csv`, toCsv(inventoryCsvRows(inventory.filter((i) => selected.has(i.id)), outlook)))}>Export</button>
            <button type="button" className="ad-btn ad-btn-sm ad-btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}
        {shown.length === 0 ? <Empty>Nothing at this level.</Empty> : (
          <div className="ad-table-wrap">
            <table className="table ad-cards">
              <thead><tr><th /><th>Ingredient</th><th>Area</th><th className="num">On hand</th><th className="num">Reserved</th><th className="num">Available</th><th className="num">Reorder at</th><th className="num">Use / day</th><th className="num">Cover</th><th>Status</th><th /></tr></thead>
              <tbody>
                {shown.map((i) => {
                  const o = outlook.get(i.id);
                  const cover = coverOf(i);
                  const lvl = stockLevel(i);
                  return (
                    <tr key={i.id} className={`${selected.has(i.id) ? 'is-selected' : ''} ${lvl === 'OUT' || lvl === 'CRITICAL' ? 'is-urgent' : ''}`}>
                      <td data-label=""><input type="checkbox" className="ad-check" checked={selected.has(i.id)} onChange={() => setSelected((s) => { const n = new Set(s); if (n.has(i.id)) n.delete(i.id); else n.add(i.id); return n; })} aria-label={`Select ${i.name}`} /></td>
                      <td data-label="Ingredient"><button type="button" className="ad-link ad-rowlink" onClick={() => setOpenId(i.id)}>{i.name}</button></td>
                      <td data-label="Area">{i.area}</td>
                      <td data-label="On hand" className="num">{formatQty(i.onHand, i.unit)}</td>
                      <td data-label="Reserved" className="num">{i.reserved ? formatQty(i.reserved, i.unit) : '—'}</td>
                      <td data-label="Available" className="num"><strong>{formatQty(availableQty(i), i.unit)}</strong> <Meter value={availableQty(i)} max={i.reorderPoint * 2} tone={lvl === 'HEALTHY' ? 'ok' : lvl === 'LOW' ? 'warn' : 'bad'} /></td>
                      <td data-label="Reorder at" className="num">{formatQty(i.reorderPoint, i.unit)}</td>
                      <td data-label="Use / day" className="num">{o ? formatQty(o.forecastDaily, i.unit) : '—'}</td>
                      <td data-label="Cover" className="num">{cover === null ? '—' : `${cover} d`}</td>
                      <td data-label="Status"><StockBadge level={lvl} /></td>
                      <td data-label="" className="cell-actions"><button type="button" className="ad-btn ad-btn-sm" onClick={() => setOpenId(i.id)}>{admin.can('inventory.adjust') ? 'Adjust' : 'View'}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {item && <IngredientDrawer item={item} outlook={outlook.get(item.id)} onClose={() => setOpenId('')} />}
    </div>
  );
}

function IngredientDrawer({ item, outlook, onClose }: { item: Ingredient; outlook?: StockOutlook; onClose: () => void }) {
  const { orders, movementHistory, recordMovement, setReorderPoint } = useStore();
  const admin = useAdmin();
  const { now } = admin;
  const [reason, setReason] = useState<MovementReason>('Restock');
  const [amount, setAmount] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [reorder, setReorder] = useState<number | null>(item.reorderPoint);
  const [error, setError] = useState('');
  const usage = useMemo(() => usageBreakdown(item.id, orders, now), [item.id, orders, now]);
  const itemHistory = useMemo(() => movementHistory.filter((m) => m.ingredientId === item.id), [movementHistory, item.id]);
  // Daily use for the last 14 days: recorded sales (online and counter) where the history has them, else online orders.
  const trend = useMemo(() => {
    const days = [...Array(14)].map((_, i) => { const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (13 - i)); return d.getTime(); });
    const sales = itemHistory.filter((m) => m.reason === 'Sale' && Date.parse(m.at) >= days[0]);
    if (!sales.length) return dailyConsumption(orders, now, 14)[item.id] ?? new Array(14).fill(0);
    return days.map((start) => Math.round(-sales.filter((m) => Date.parse(m.at) >= start && Date.parse(m.at) < start + 86_400_000).reduce((sum, m) => sum + m.delta, 0) * 1000) / 1000);
  }, [itemHistory, orders, now, item.id]);
  const consuming = useMemo(() => ordersConsuming(item.id, orders), [item.id, orders]);
  const history = itemHistory.slice(0, 20);
  const why = whyLow(item, usage, outlook, itemHistory, now);
  const canAdjust = admin.can('inventory.adjust');

  const submit = async () => {
    setError('');
    if (amount === null || !(amount > 0)) { setError('Enter an amount above zero.'); return; }
    let delta = amount;
    if (reason === 'Wastage') { if (amount > item.onHand) { setError(`Only ${formatQty(item.onHand, item.unit)} on hand.`); return; } delta = -amount; }
    if (reason === 'Correction') delta = amount - item.onHand;
    if (reason === 'Reserve' && amount > availableQty(item)) { setError(`Only ${formatQty(availableQty(item), item.unit)} available to reserve.`); return; }
    if (reason === 'Release' && amount > (item.reserved ?? 0)) { setError(`Only ${formatQty(item.reserved ?? 0, item.unit)} reserved.`); return; }
    if (reason !== 'Restock' && !note.trim()) { setError('Add a short reason for this movement.'); return; }
    if (delta === 0) { setError('That matches what’s on hand already.'); return; }
    const after = reason === 'Reserve' || reason === 'Release'
      ? { reserved: Math.round(((item.reserved ?? 0) + (reason === 'Reserve' ? amount : -amount)) * 1000) / 1000 }
      : { onHand: Math.max(0, Math.round((item.onHand + delta) * 1000) / 1000) };
    const big = reason === 'Correction' && Math.abs(delta) > item.reorderPoint;
    if (big) {
      const r = await admin.confirm({ title: `Set ${item.name} to ${formatQty(amount, item.unit)}?`, impact: [`That’s ${delta > 0 ? '+' : '−'}${formatQty(Math.abs(delta), item.unit)} from the recorded ${formatQty(item.onHand, item.unit)}.`, 'Shop availability updates immediately.'], confirmLabel: 'Record count', tone: 'primary' });
      if (!r.ok) return;
    }
    const res = admin.act({
      permission: 'inventory.adjust', action: `inventory.${reason.toLowerCase()}`, entity: { type: 'inventory', id: item.id, label: item.name },
      before: { onHand: item.onHand, reserved: item.reserved ?? 0 }, after, reason: note || reason,
      run: () => recordMovement(item.id, delta, reason, { note, actor: admin.staff?.name }), success: `${MOVES.find((m) => m.id === reason)?.label} recorded for ${item.name}`,
    });
    if (res.ok) { setAmount(null); setNote(''); }
  };

  const saveReorder = () => {
    if (reorder === null || reorder < 0) return;
    admin.act({ permission: 'inventory.adjust', action: 'inventory.reorderPoint.changed', entity: { type: 'inventory', id: item.id, label: item.name }, before: { reorderPoint: item.reorderPoint }, after: { reorderPoint: reorder }, run: () => setReorderPoint(item.id, reorder), success: 'Reorder point saved' });
  };

  return (
    <Drawer open onClose={onClose} wide title={item.name} subtitle={<><StockBadge level={stockLevel(item)} /><span>{item.area} · {item.unit}</span></>}>
      <div className="ad-kpis">
        <Kpi label="On hand" value={formatQty(item.onHand, item.unit)} />
        <Kpi label="Reserved" value={formatQty(item.reserved ?? 0, item.unit)} />
        <Kpi label="Available" value={formatQty(availableQty(item), item.unit)} />
        <Kpi label="Days of cover" value={outlook && outlook.forecastDaily > 0 ? `${Math.round((availableQty(item) / outlook.forecastDaily) * 10) / 10}` : '—'} meta={outlook ? `${formatQty(outlook.forecastDaily, item.unit)} / day forecast` : 'No recent use'} />
        <Kpi label="Suggested restock" value={outlook?.suggestedRestock ? formatQty(outlook.suggestedRestock, item.unit) : '—'} meta="3 days + reorder point" />
      </div>

      <div className="ad-why">
        <h3 className="ad-section-title">Why is this {stockLevel(item) === 'HEALTHY' ? 'healthy' : 'low'}?</h3>
        <ul>{why.map((w) => <li key={w}>{w}</li>)}</ul>
        <Link className="ad-link small" href={'/admin/intelligence' as Route}>See the evidence in Intelligence →</Link>
      </div>

      {canAdjust && (
        <div className="ad-movement">
          <h3 className="ad-section-title">Record a movement</h3>
          <div className="ad-chips" role="radiogroup" aria-label="Movement type">
            {MOVES.map((m) => <button key={m.id} type="button" role="radio" aria-checked={reason === m.id} className={`ad-chip ${reason === m.id ? 'is-on' : ''}`} onClick={() => { setReason(m.id); setError(''); }}>{m.label}</button>)}
          </div>
          <p className="ad-muted small">{MOVES.find((m) => m.id === reason)?.help}</p>
          <div className="ad-form">
            <Field label={`${reason === 'Correction' ? 'Counted on hand' : 'Amount'} (${item.unit})`} error={error}><NumberInput value={amount} step={0.01} onChange={setAmount} invalid={Boolean(error)} /></Field>
            <Field label={reason === 'Restock' ? 'Note (optional)' : 'Reason'}><input value={note} onChange={(e) => setNote(e.target.value)} placeholder={reason === 'Wastage' ? 'e.g. Dropped tray' : reason === 'Reserve' ? 'e.g. Saturday wedding order' : ''} /></Field>
          </div>
          <div className="ad-row" style={{ justifyContent: 'flex-end', marginTop: 8 }}><button type="button" className="ad-btn ad-btn-primary" onClick={submit}>Record {MOVES.find((m) => m.id === reason)?.label.toLowerCase()}</button></div>
          <div className="ad-row" style={{ marginTop: 10 }}>
            <Field label={`Reorder point (${item.unit})`}><NumberInput value={reorder} step={0.01} onChange={setReorder} /></Field>
            <button type="button" className="ad-btn" style={{ alignSelf: 'flex-end' }} disabled={reorder === item.reorderPoint} onClick={saveReorder}>Save reorder point</button>
          </div>
        </div>
      )}

      <div className="ad-detail-grid">
        <section>
          <h3 className="ad-section-title">Use, last 14 days</h3>
          <Spark values={trend} label={`Daily use of ${item.name} over 14 days`} />
          <p className="ad-muted small">This week {formatQty(usage.thisWeek, item.unit)} · last week {formatQty(usage.lastWeek, item.unit)}{usage.changePct !== null ? ` · ${usage.changePct >= 0 ? '+' : ''}${usage.changePct}%` : ''}</p>
          {usage.byProduct.length > 0 && <div className="ad-bars">{usage.byProduct.slice(0, 5).map((b) => <div key={b.key} className="ad-bar-row"><span>{b.name}</span><span className="ad-bar"><span style={{ width: `${Math.round(b.share * 100)}%` }} /></span><span className="ad-num">{Math.round(b.share * 100)}%</span></div>)}</div>}
        </section>
        <section>
          <h3 className="ad-section-title">Orders using it</h3>
          {consuming.length === 0 ? <p className="ad-muted small">No recent orders use it.</p> : (
            <ul className="ad-lines">{consuming.map(({ order, amount: a }) => <li key={order.id}><Link className="ad-rowlink" href={`/admin/orders/${order.id}` as Route}>{order.id}</Link><span className="ad-muted small">{formatQty(a, item.unit)} · {dateTime(order.createdAt)}</span></li>)}</ul>
          )}
        </section>
      </div>

      <h3 className="ad-section-title">Stock movements {itemHistory.length > 20 && <span className="ad-muted small">(latest 20 of {itemHistory.length.toLocaleString('en-IN')})</span>}</h3>
      {history.length === 0 ? <p className="ad-muted small">No movements yet.</p> : (
        <table className="table"><thead><tr><th>When</th><th>Type</th><th className="num">Change</th><th>By</th><th>Note</th></tr></thead>
          <tbody>{history.map((m) => <tr key={m.id}><td>{dateTime(m.at)}</td><td>{m.reason === 'Sale' ? 'Used (sales)' : m.reason}</td><td className="num">{m.reason === 'Reserve' || m.reason === 'Release' ? `${m.reason === 'Reserve' ? '+' : '−'}${formatQty(Math.abs(m.delta), item.unit)} reserved` : `${m.delta >= 0 ? '+' : '−'}${formatQty(Math.abs(m.delta), item.unit)}`}</td><td>{m.actor ? admin.staffName(m.actor) : '—'}</td><td className="ad-muted">{m.note ?? ''}</td></tr>)}</tbody>
        </table>
      )}
    </Drawer>
  );
}
