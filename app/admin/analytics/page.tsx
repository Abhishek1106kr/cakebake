'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { products } from '@/lib/data';
import { useStore } from '@/components/store-provider';
import { useAdmin } from '@/components/admin/admin-provider';
import { Chips, Empty, Guard, Kpi, PageHeader, Panel, rupees } from '@/components/admin/ui';
import { cakeAnalytics, confidenceLabel, funnel, operationStats, productPerformance, searchAnalytics, stockOutlook } from '@/engine/intelligence';
import { analyticsCsvRows, categoryPerformance, checkoutStats, comparePeriods, dailySeries, delta, deliveryStages, notificationStats, paymentStats, recommendationStats } from '@/lib/admin/analytics';
import { campaignPerformance, effectiveStatus } from '@/lib/admin/marketing';
import { toCsv, downloadText, stamp } from '@/lib/admin/csv';

type Range = '1' | '7' | '30';
const RANGES: { id: Range; label: string }[] = [{ id: '1', label: 'Today' }, { id: '7', label: '7 days' }, { id: '30', label: '30 days' }];
const STEP_LABEL = { product_view: 'Viewed a product', product_added: 'Added to bag', checkout_started: 'Started checkout', order_created: 'Placed an order' } as const;
const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`);
const vs = (d: number | null) => (d === null ? 'no earlier data' : `${d >= 0 ? '+' : ''}${d}% vs previous`);

export default function AnalyticsPage() {
  return <Guard permission="analytics.view"><Analytics /></Guard>;
}

function Analytics() {
  const { orders, inventory } = useStore();
  const admin = useAdmin();
  const { now, events } = admin;
  const [range, setRange] = useState<Range>('7');
  const days = Number(range);
  const cmp = useMemo(() => comparePeriods(orders, now, days), [orders, now, days]);
  const series = useMemo(() => dailySeries(orders, now, days === 1 ? 7 : days), [orders, now, days]);
  const from = now.getTime() - days * 86400000;
  const inRange = useMemo(() => orders.filter((o) => Date.parse(o.createdAt) >= from), [orders, from]);
  const eventsInRange = useMemo(() => events.filter((e) => Date.parse(e.timestamp) >= from), [events, from]);
  const steps = useMemo(() => funnel(eventsInRange), [eventsInRange]);
  const search = useMemo(() => searchAnalytics(eventsInRange), [eventsInRange]);
  const cakes = useMemo(() => cakeAnalytics(eventsInRange), [eventsInRange]);
  const perf = useMemo(() => productPerformance(inRange, eventsInRange).slice(0, 10), [inRange, eventsInRange]);
  const cats = useMemo(() => categoryPerformance(inRange), [inRange]);
  const checkout = useMemo(() => checkoutStats(eventsInRange), [eventsInRange]);
  const pay = useMemo(() => paymentStats(inRange, eventsInRange), [inRange, eventsInRange]);
  const stages = useMemo(() => deliveryStages(inRange), [inRange]);
  const notes = useMemo(() => notificationStats(admin.automation.jobs.filter((j) => Date.parse(j.createdAt) >= from)), [admin.automation.jobs, from]);
  const recs = useMemo(() => recommendationStats(eventsInRange), [eventsInRange]);
  const outlook = useMemo(() => stockOutlook(inventory, orders, now), [inventory, orders, now]);
  const health = useMemo(() => Object.entries(operationStats()), [events, orders]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = (id: string) => products.find((p) => p.id === id)?.name ?? admin.catalog.find((p) => p.id === id)?.name ?? id;
  const maxRevenue = Math.max(1, ...series.map((d) => d.revenue));
  const { current: c, previous: p } = cmp;

  return (
    <div>
      <PageHeader eyebrow="Insight" title="Analytics" description="From the orders, visits and jobs recorded in this browser. Each section says how many records it counts."
        actions={admin.can('analytics.export') && <button type="button" className="ad-btn" onClick={() => downloadText(`tresor-analytics-${range}d-${stamp()}.csv`, toCsv(analyticsCsvRows(series)))}>Export daily ({series.length} days) <ArrowUpRight size={14} /></button>} />
      <div className="ad-toolbar"><Chips label="Period" items={RANGES} value={range} onChange={setRange} /><span className="ad-muted small">Compared with the {days === 1 ? 'day' : `${days} days`} before.</span></div>
      <div className="ad-kpis">
        <Kpi label="Revenue" value={rupees(c.revenue)} meta={vs(delta(c.revenue, p.revenue))} href="/admin/orders?filter=ALL" />
        <Kpi label="Orders" value={c.orders} meta={vs(delta(c.orders, p.orders))} />
        <Kpi label="Average order" value={rupees(c.aov)} meta={vs(delta(c.aov, p.aov))} />
        <Kpi label="Conversion" value={pct(steps[3].rate)} meta="Product viewers who ordered" />
        <Kpi label="Custom cakes" value={c.customCakes} meta={vs(delta(c.customCakes, p.customCakes))} href="/admin/custom-cakes" />
        <Kpi label="Cancelled" value={c.cancelled} tone={c.cancelled ? 'warn' : undefined} href="/admin/orders?filter=CANCELLED" />
      </div>
      <p className="ad-muted small" style={{ margin: '-6px 0 12px' }}>Based on {c.basedOn} orders in the period (cancelled excluded from revenue).</p>

      <div className="ad-grid-2-even">
        <Panel title="Revenue by day">
          <div className="ad-cols" role="img" aria-label={`Revenue by day: ${series.map((d) => `${d.date} ${rupees(d.revenue)}`).join(', ')}`}>
            {series.map((d) => <div key={d.date} title={`${d.date}: ${rupees(d.revenue)}, ${d.orders} orders`}><span style={{ height: `${Math.max(2, (d.revenue / maxRevenue) * 100)}%` }} />{series.length <= 10 ? new Date(`${d.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' }) : new Date(`${d.date}T12:00:00`).getDate()}</div>)}
          </div>
          <p className="ad-muted small">{rupees(series.reduce((s, d) => s + d.revenue, 0))} from {series.reduce((s, d) => s + d.orders, 0)} orders.</p>
        </Panel>
        <Panel title="Customer journey">
          {steps[0].sessions === 0 ? <Empty>No visits recorded in this period.</Empty> : (
            <div className="ad-bars">{steps.map((s) => <div key={s.step} className="ad-bar-row"><span>{STEP_LABEL[s.step]}</span><span className="ad-bar"><span style={{ width: `${(s.rate ?? 0) * 100}%` }} /></span><span className="ad-num">{s.sessions} · {pct(s.rate)}</span></div>)}</div>
          )}
          <p className="ad-muted small">Sessions reaching each step ({eventsInRange.length} events).</p>
        </Panel>
      </div>

      <div className="ad-grid-2-even">
        <Panel title="Products">
          {perf.length === 0 ? <Empty>No sales or views yet.</Empty> : (
            <table className="table ad-cards"><thead><tr><th>Product</th><th className="num">Sold</th><th className="num">Revenue</th><th className="num">Views</th><th className="num">Add rate</th></tr></thead>
              <tbody>{perf.map((r) => <tr key={r.productId}><td data-label="Product">{r.productId === 'custom-cake' ? 'Custom cakes' : <Link className="ad-rowlink" href={`/admin/products?p=${r.productId}` as Route}>{name(r.productId)}</Link>}</td><td data-label="Sold" className="num">{r.units}</td><td data-label="Revenue" className="num">{rupees(r.revenue)}</td><td data-label="Views" className="num">{r.views}</td><td data-label="Add rate" className="num">{pct(r.addRate)}</td></tr>)}</tbody></table>
          )}
        </Panel>
        <Panel title="Categories">
          {cats.length === 0 ? <Empty>No sales yet.</Empty> : <div className="ad-bars">{cats.map((r) => <div key={r.category} className="ad-bar-row"><span>{r.category}</span><span className="ad-bar"><span style={{ width: `${r.share * 100}%` }} /></span><span className="ad-num">{rupees(r.revenue)} · {r.units}</span></div>)}</div>}
        </Panel>
      </div>

      <div className="ad-grid-2-even">
        <Panel title="Checkout and payments" id="payments">
          <dl className="ad-dl">
            <dt>Checkouts started</dt><dd>{checkout.started} sessions</dd>
            <dt>Payment attempts</dt><dd>{checkout.paymentStarted} · {checkout.paid} paid online · {checkout.failed} failed</dd>
            <dt>Completion</dt><dd>{pct(checkout.completion)} of checkouts became orders</dd>
            <dt>Refunds</dt><dd>{pay.refundPending} pending · {pay.refunded} done {pay.refundPending > 0 && <Link className="ad-link" href="/admin/orders?filter=REFUND_PENDING">Review</Link>}</dd>
            <dt>Cash due (COD)</dt><dd>{rupees(pay.codDue)} on active orders</dd>
          </dl>
          <div className="ad-section-title">By method</div>
          {pay.byMethod.length === 0 ? <p className="ad-muted small">No orders.</p> : <ul className="ad-lines">{pay.byMethod.map((m) => <li key={m.method}><span>{m.method === 'COD' ? 'Cash on delivery' : `${m.method} (simulated)`}</span><span className="ad-num">{m.orders} · {rupees(m.revenue)}</span></li>)}</ul>}
          {pay.failures.length > 0 && <><div className="ad-section-title">Failed attempts</div><ul className="ad-lines">{pay.failures.map((f) => <li key={f.reason}><span>{f.reason}</span><span className="ad-num">{f.count}</span></li>)}</ul></>}
          <p className="ad-muted small">Failed payments never create an order; they’re counted from payment events.</p>
        </Panel>
        <Panel title="Delivery">
          <table className="table ad-cards"><thead><tr><th>Step</th><th className="num">Median</th><th className="num">Slowest 10%</th><th className="num">Orders</th></tr></thead>
            <tbody>{stages.map((s) => <tr key={s.label}><td data-label="Step">{s.label}</td><td data-label="Median" className="num">{s.median === null ? '—' : `${s.median} min`}</td><td data-label="Slowest 10%" className="num">{s.p90 === null ? '—' : `${s.p90} min`}</td><td data-label="Orders" className="num">{s.count}</td></tr>)}</tbody></table>
          <p className="ad-muted small">From each order’s status history; custom cakes excluded (they run for hours by design).</p>
          <div className="ad-section-title">Notifications</div>
          {notes.length === 0 ? <p className="ad-muted small">No jobs in this period.</p> : <ul className="ad-lines">{notes.map((n) => <li key={n.kind}><span>{n.kind}</span><span className="ad-num">{n.succeeded}/{n.total} sent{n.failed ? ` · ${n.failed} failed` : ''}{n.retried ? ` · ${n.retried} retried` : ''}</span></li>)}</ul>}
        </Panel>
      </div>

      <div className="ad-grid-2-even">
        <Panel title="Search" id="search" actions={<span className="ad-muted small">{search.searches} searches · {pct(search.zeroResultRate)} found nothing</span>}>
          {search.searches === 0 ? <Empty>No searches yet.</Empty> : (
            <table className="table ad-cards"><thead><tr><th>What people typed</th><th className="num">Times</th><th className="num">Avg results</th></tr></thead>
              <tbody>{search.topQueries.map((q) => <tr key={q.query}><td data-label="Query">{q.query}</td><td data-label="Times" className="num">{q.count}</td><td data-label="Avg results" className="num">{q.avgResults}</td></tr>)}</tbody></table>
          )}
          {search.zeroResultQueries.length > 0 && <p className="small"><span className="ad-muted">Found nothing: </span>{search.zeroResultQueries.map((q) => `“${q.query}” × ${q.count}`).join(', ')}</p>}
        </Panel>
        <Panel title="Recommendations">
          {recs.length === 0 ? <Empty>No recommendation events yet.</Empty> : (
            <table className="table ad-cards"><thead><tr><th>Where</th><th className="num">Shown</th><th className="num">Clicked</th><th className="num">Click rate</th></tr></thead>
              <tbody>{recs.map((r) => <tr key={r.surface}><td data-label="Where">{r.surface}</td><td data-label="Shown" className="num">{r.shown}</td><td data-label="Clicked" className="num">{r.clicked}</td><td data-label="Click rate" className="num">{pct(r.ctr)}</td></tr>)}</tbody></table>
          )}
        </Panel>
      </div>

      <Panel title="Cake Playground" actions={<span className="ad-muted small">{cakes.opened} opened · {cakes.started} started · {cakes.added} added · {cakes.ordered} ordered · {pct(cakes.conversion)} add a cake</span>}>
        {cakes.opened === 0 ? <Empty>No one opened the playground in this period.</Empty> : (
          <div className="ad-grid-2-even" style={{ marginBottom: 0 }}>
            <div><div className="ad-section-title">Most chosen</div><ul className="ad-lines">{cakes.popular.map((x) => <li key={`${x.group}${x.optionId}`}><span>{x.group} · {x.optionId}</span><span className="ad-num">{x.count}</span></li>)}</ul></div>
            <div><div className="ad-section-title">Added to bag</div><ul className="ad-lines">{cakes.combos.map((x) => <li key={x.combo}><span>{x.combo}</span><span className="ad-num">{x.count}</span></li>)}</ul>
              <p className="ad-muted small">{pct(cakes.withMessage)} carry a message · {pct(cakes.withPrint)} have a photo print{cakes.abandonedAt.length > 0 && ` · left at: ${cakes.abandonedAt.map((a) => `${a.group} (${a.count})`).join(', ')}`}</p></div>
          </div>
        )}
      </Panel>

      <div className="ad-grid-2-even">
        <Panel title="Inventory" actions={<span className="ad-muted small">{confidenceLabel(outlook.confidence)} confidence</span>}>
          {outlook.result.length === 0 ? <Empty>No ingredient use recorded yet.</Empty> : (
            <table className="table ad-cards"><thead><tr><th>Ingredient</th><th className="num">Use / day</th><th className="num">Cover</th><th className="num">Restock</th></tr></thead>
              <tbody>{outlook.result.slice(0, 8).map((r) => <tr key={r.ingredientId}><td data-label="Ingredient"><Link className="ad-rowlink" href={`/admin/inventory?item=${r.ingredientId}` as Route}>{r.name}</Link></td><td data-label="Use / day" className="num">{r.forecastDaily} {r.unit}</td><td data-label="Cover" className="num">{r.daysOfCover ?? '—'} d</td><td data-label="Restock" className="num">{r.suggestedRestock ? `${r.suggestedRestock} ${r.unit}` : '—'}</td></tr>)}</tbody></table>
          )}
          {outlook.warnings[0] && <p className="ad-muted small">{outlook.warnings[0]}.</p>}
        </Panel>
        <Panel title="Campaigns">
          {admin.campaigns.filter((x) => !x.archived).length === 0 ? <Empty>No campaigns yet.</Empty> : (
            <table className="table ad-cards"><thead><tr><th>Campaign</th><th>Status</th><th className="num">Views / clicks</th><th className="num">Featured revenue</th></tr></thead>
              <tbody>{admin.campaigns.filter((x) => !x.archived).map((cmp2) => { const r = campaignPerformance(cmp2, events, orders); return <tr key={cmp2.id}><td data-label="Campaign"><Link className="ad-rowlink" href={`/admin/campaigns?c=${cmp2.id}` as Route}>{cmp2.name}</Link></td><td data-label="Status">{effectiveStatus(cmp2, now).toLowerCase()}</td><td data-label="Views / clicks" className="num">{r.views} / {r.clicks}</td><td data-label="Featured revenue" className="num">{rupees(r.featuredRevenue)}</td></tr>; })}</tbody></table>
          )}
        </Panel>
      </div>

      <Panel title="Engine health" actions={<span className="ad-muted small">Every search, recommendation, forecast and insight is logged with latency and fallbacks</span>}>
        {health.length === 0 ? <Empty>No engine calls in this browser yet.</Empty> : (
          <div className="ad-table-wrap"><table className="table ad-cards"><thead><tr><th>Operation</th><th className="num">Calls</th><th className="num">p50</th><th className="num">p95</th><th className="num">Fallback</th><th className="num">Errors</th><th className="num">Confidence</th></tr></thead>
            <tbody>{health.map(([op, s]) => <tr key={op}><td data-label="Operation" className="ad-mono">{op}</td><td data-label="Calls" className="num">{s.calls}</td><td data-label="p50" className="num">{s.p50.toFixed(1)} ms</td><td data-label="p95" className="num">{s.p95.toFixed(1)} ms</td><td data-label="Fallback" className="num">{pct(s.fallbackRate)}</td><td data-label="Errors" className="num">{pct(s.errorRate)}</td><td data-label="Confidence" className="num">{pct(s.avgConfidence)}</td></tr>)}</tbody></table></div>
        )}
      </Panel>
    </div>
  );
}
