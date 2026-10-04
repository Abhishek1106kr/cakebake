'use client';

import { useMemo } from 'react';
import { products } from '@/lib/data';
import { useStore } from '@/components/store-provider';
import { InsightList, useEvents } from '@/components/admin/insights';
import { rupees, useNow } from '@/components/admin/admin-utils';
import {
  confidenceLabel, funnel, operationStats, productPerformance, salesByDay, searchAnalytics, stockOutlook,
} from '@/engine/intelligence';

const STEP_LABEL = { product_view: 'Viewed a product', product_added: 'Added to bag', checkout_started: 'Started checkout', order_created: 'Placed an order' } as const;
const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`);

export default function AnalyticsPage() {
  const { orders, inventory, mounted } = useStore();
  const now = useNow();
  const events = useEvents();

  const days = useMemo(() => salesByDay(orders, now, 7), [orders, now]);
  const steps = useMemo(() => funnel(events), [events]);
  const searches = useMemo(() => searchAnalytics(events), [events]);
  const perf = useMemo(() => productPerformance(orders, events).slice(0, 8), [orders, events]);
  const outlook = useMemo(() => stockOutlook(inventory, orders, now), [inventory, orders, now]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const health = useMemo(() => Object.entries(operationStats()), [events, orders]);
  const name = (id: string) => products.find((p) => p.id === id)?.name ?? id;
  const maxRevenue = Math.max(1, ...days.map((d) => d.revenue));

  if (!mounted) return <div className="page-loader" />;

  return (
    <div>
      <div className="admin-top">
        <div>
          <div className="eyebrow">Analytics</div>
          <h1 className="display admin-title">How the bakery is doing.</h1>
          <div className="muted">From orders and visits recorded in this browser. Every number links back to the records it counts.</div>
        </div>
      </div>

      <section className="panel analytics-block">
        <div className="panel-head"><h2>Insights</h2></div>
        <InsightList now={now} />
      </section>

      <div className="analytics-grid">
        <section className="panel">
          <div className="panel-head"><h2>Last 7 days</h2></div>
          <div className="spark">
            {days.map((d) => (
              <div key={d.date} className="spark-col" title={`${d.date}: ${rupees(d.revenue)} from ${d.orders} orders`}>
                <span className="spark-bar" style={{ height: `${Math.max(3, (d.revenue / maxRevenue) * 100)}%` }} />
                <small>{new Date(`${d.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}</small>
              </div>
            ))}
          </div>
          <p className="small muted">{rupees(days.reduce((s, d) => s + d.revenue, 0))} from {days.reduce((s, d) => s + d.orders, 0)} orders, cancelled excluded.</p>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Customer journey</h2></div>
          {steps[0].sessions === 0 ? <p className="muted">No visits recorded yet. Browse the shop in another tab and this fills in.</p> : (
            <ol className="funnel">
              {steps.map((s) => (
                <li key={s.step}>
                  <div className="funnel-label"><span>{STEP_LABEL[s.step]}</span><strong>{s.sessions}</strong></div>
                  <div className="funnel-track"><span style={{ width: `${(s.rate ?? 0) * 100}%` }} /></div>
                  <small className="muted">{pct(s.rate)} of visitors who viewed a product</small>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="analytics-grid">
        <section className="panel">
          <div className="panel-head"><h2>Search</h2><span className="small muted">{searches.searches} searches · {pct(searches.zeroResultRate)} found nothing</span></div>
          {searches.searches === 0 ? <p className="muted">No searches yet.</p> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>What people typed</th><th>Times</th><th>Avg. results</th></tr></thead>
              <tbody>{searches.topQueries.map((q) => <tr key={q.query}><td>{q.query}</td><td>{q.count}</td><td>{q.avgResults}</td></tr>)}</tbody>
            </table></div>
          )}
          {searches.zeroResultQueries.length > 0 && (
            <div className="zero-queries"><span className="small muted">Found nothing:</span> {searches.zeroResultQueries.map((q) => <span key={q.query} className="chip">{q.query} × {q.count}</span>)}</div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Products</h2></div>
          {perf.length === 0 ? <p className="muted">No sales or views yet.</p> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Product</th><th>Sold</th><th>Revenue</th><th>Views</th><th>Add rate</th></tr></thead>
              <tbody>{perf.map((p) => <tr key={p.productId}><td>{name(p.productId)}</td><td>{p.units}</td><td>{rupees(p.revenue)}</td><td>{p.views}</td><td>{pct(p.addRate)}</td></tr>)}</tbody>
            </table></div>
          )}
        </section>
      </div>

      <section className="panel analytics-block">
        <div className="panel-head"><h2>Stock outlook</h2><span className="small muted">{confidenceLabel(outlook.confidence)} confidence · {outlook.warnings[0] ?? 'based on recent orders'}</span></div>
        {outlook.result.length === 0 ? <p className="muted">No ingredient use recorded yet.</p> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Ingredient</th><th>On hand</th><th>Use / day</th><th>Days of cover</th><th>Suggested restock</th><th>History</th><th>Backtest error</th></tr></thead>
            <tbody>{outlook.result.map((r) => (
              <tr key={r.ingredientId} className={r.daysOfCover !== null && r.daysOfCover < 1 ? 'row-alert' : ''}>
                <td>{r.name}</td><td>{r.onHand} {r.unit}</td><td>{r.forecastDaily} {r.unit}</td>
                <td>{r.daysOfCover ?? '—'}</td><td>{r.suggestedRestock ? `${r.suggestedRestock} ${r.unit}` : '—'}</td>
                <td>{r.historyDays} day{r.historyDays === 1 ? '' : 's'}</td><td>{r.mape === null ? 'needs 3+ days' : `${Math.round(r.mape * 100)}% MAPE`}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section className="panel analytics-block">
        <div className="panel-head"><h2>Engine health</h2><span className="small muted">Every search, recommendation and forecast is logged with its latency and fallbacks</span></div>
        {health.length === 0 ? <p className="muted">No engine calls yet in this browser.</p> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Operation</th><th>Calls</th><th>p50</th><th>p95</th><th>Fallback rate</th><th>Errors</th><th>Avg. confidence</th></tr></thead>
            <tbody>{health.map(([op, s]) => <tr key={op}><td>{op}</td><td>{s.calls}</td><td>{s.p50.toFixed(1)} ms</td><td>{s.p95.toFixed(1)} ms</td><td>{pct(s.fallbackRate)}</td><td>{pct(s.errorRate)}</td><td>{pct(s.avgConfidence)}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
