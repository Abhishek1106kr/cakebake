'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { useAdmin } from '@/components/admin/admin-provider';
import { useInsights } from '@/components/admin/insights';
import { ActionRow, CopilotPanel, LEVEL_LABEL } from '@/components/admin/copilot';
import { Badge, Empty, Guard, Kpi, PageHeader, Panel, Tabs, dateTime } from '@/components/admin/ui';
import { browserDecisionStore, confidenceLabel, operationStats, stockOutlook, type DecisionRecord, type Insight } from '@/engine/intelligence';

type Tab = 'insights' | 'anomalies' | 'forecasts' | 'recommendations' | 'decisions' | 'health';
const SEV = { act: ['bad', 'Act now'], watch: ['warn', 'Keep an eye'], info: ['info', 'Good to know'] } as const;
const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`);

export default function IntelligencePage() {
  return <Guard permission="intelligence.view"><Intelligence /></Guard>;
}

function useDecisionLog() {
  const [log, setLog] = useState<DecisionRecord[]>([]);
  useEffect(() => {
    const store = browserDecisionStore();
    const load = () => setLog(store.load());
    load();
    const onStorage = (e: StorageEvent) => { if (e.key === 'tresor-decisions') load(); };
    window.addEventListener('tresor-decision', load);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('tresor-decision', load); window.removeEventListener('storage', onStorage); };
  }, []);
  return log;
}

function Intelligence() {
  const { orders, inventory } = useStore();
  const admin = useAdmin();
  const { now } = admin;
  const { insights, visible, actionFor } = useInsights(now);
  const [tab, setTab] = useState<Tab>('insights');
  const log = useDecisionLog();
  const outlook = useMemo(() => stockOutlook(inventory, orders, now), [inventory, orders, now]);
  const health = useMemo(() => Object.entries(operationStats()), [admin.events, orders]); // eslint-disable-line react-hooks/exhaustive-deps
  const anomalies = visible.filter((i) => i.kind === 'sales' || i.kind === 'payment' || i.kind === 'automation' || (i.kind === 'kitchen' && i.severity === 'act'));
  const recommendations = visible.map((i) => actionFor.get(i.id)).filter((a): a is NonNullable<typeof a> => Boolean(a) && a!.level !== 'OBSERVE');

  return (
    <div>
      <PageHeader eyebrow="Insight" title="Intelligence" description="What the engine notices, why, the evidence, how sure it is, and what it suggests. It observes and drafts; anything that changes stock, money, prices, campaigns or customer messages waits for a person." />
      <div className="ad-kpis">
        <Kpi label="Act now" value={visible.filter((i) => i.severity === 'act').length} tone={visible.some((i) => i.severity === 'act') ? 'bad' : undefined} />
        <Kpi label="Keep an eye" value={visible.filter((i) => i.severity === 'watch').length} />
        <Kpi label="Awaiting approval" value={recommendations.filter((a) => a.level === 'APPROVAL_REQUIRED').length} />
        <Kpi label="Decisions logged" value={log.length} />
        <Kpi label="Forecast confidence" value={confidenceLabel(outlook.confidence)} meta={outlook.warnings[0] ?? 'Based on recent orders'} />
      </div>
      <div className="ad-grid-2">
        <div>
          <Tabs label="Intelligence sections" value={tab} onChange={setTab} items={[
            { id: 'insights', label: 'Insights', count: visible.length }, { id: 'anomalies', label: 'Anomalies', count: anomalies.length }, { id: 'forecasts', label: 'Forecasts', count: outlook.result.length },
            { id: 'recommendations', label: 'Recommendations', count: recommendations.length }, { id: 'decisions', label: 'Decisions', count: log.length }, { id: 'health', label: 'Engine health' },
          ]} />
          {tab === 'insights' && <InsightList list={visible} now={now} actionFor={actionFor} warnings={insights.warnings} />}
          {tab === 'anomalies' && <InsightList list={anomalies} now={now} actionFor={actionFor} empty="No anomalies: sales, payments, automations and the kitchen look normal." />}
          {tab === 'forecasts' && (
            <Panel>
              {outlook.result.length === 0 ? <Empty>No ingredient use recorded yet, so there’s nothing to forecast.</Empty> : (
                <div className="ad-table-wrap"><table className="table ad-cards"><thead><tr><th>Ingredient</th><th className="num">On hand</th><th className="num">Use / day</th><th className="num">Cover</th><th className="num">Suggested restock</th><th className="num">History</th><th className="num">Backtest error</th></tr></thead>
                  <tbody>{outlook.result.map((r) => <tr key={r.ingredientId} className={r.daysOfCover !== null && r.daysOfCover < 1 ? 'is-urgent' : ''}><td data-label="Ingredient"><Link className="ad-rowlink" href={`/admin/inventory?item=${r.ingredientId}` as Route}>{r.name}</Link></td><td data-label="On hand" className="num">{r.onHand} {r.unit}</td><td data-label="Use / day" className="num">{r.forecastDaily} {r.unit}</td><td data-label="Cover" className="num">{r.daysOfCover ?? '—'} d</td><td data-label="Restock" className="num">{r.suggestedRestock ? `${r.suggestedRestock} ${r.unit}` : '—'}</td><td data-label="History" className="num">{r.historyDays} d</td><td data-label="Error" className="num">{r.mape === null ? 'needs 3+ days' : `${Math.round(r.mape * 100)}% MAPE`}</td></tr>)}</tbody></table></div>
              )}
              <p className="ad-muted small">Simple exponential smoothing over daily ingredient use from orders (model {outlook.modelVersion}); backtested on the same history. Restock covers 3 days plus the reorder point.</p>
            </Panel>
          )}
          {tab === 'recommendations' && (
            <Panel>
              {recommendations.length === 0 ? <Empty>No open recommendations.</Empty> : recommendations.map((a) => <ActionRow key={a.id} action={a} now={now} />)}
              <p className="ad-muted small">Levels: {Object.values(LEVEL_LABEL).join(' · ')}. Nothing is executed automatically today.</p>
            </Panel>
          )}
          {tab === 'decisions' && (
            <Panel>
              {log.length === 0 ? <Empty>No decisions yet. Approvals and dismissals are logged here and in the audit log.</Empty> : (
                <table className="table ad-cards"><thead><tr><th>When</th><th>Action</th><th>Kind</th><th>Level</th><th>Verdict</th></tr></thead>
                  <tbody>{[...log].reverse().slice(0, 100).map((d) => <tr key={d.id}><td data-label="When">{dateTime(d.at)}</td><td data-label="Action" className="ad-mono">{d.actionId}</td><td data-label="Kind">{d.kind}</td><td data-label="Level">{LEVEL_LABEL[d.level]}</td><td data-label="Verdict"><Badge tone={d.verdict === 'rejected' ? 'muted' : 'ok'}>{d.verdict}</Badge></td></tr>)}</tbody></table>
              )}
            </Panel>
          )}
          {tab === 'health' && (
            <Panel>
              {health.length === 0 ? <Empty>No engine calls in this browser yet.</Empty> : (
                <div className="ad-table-wrap"><table className="table ad-cards"><thead><tr><th>Operation</th><th className="num">Calls</th><th className="num">p50</th><th className="num">p95</th><th className="num">Fallback</th><th className="num">Errors</th><th className="num">Confidence</th></tr></thead>
                  <tbody>{health.map(([op, s]) => <tr key={op}><td data-label="Operation" className="ad-mono">{op}</td><td data-label="Calls" className="num">{s.calls}</td><td data-label="p50" className="num">{s.p50.toFixed(1)} ms</td><td data-label="p95" className="num">{s.p95.toFixed(1)} ms</td><td data-label="Fallback" className="num">{pct(s.fallbackRate)}</td><td data-label="Errors" className="num">{pct(s.errorRate)}</td><td data-label="Confidence" className="num">{pct(s.avgConfidence)}</td></tr>)}</tbody></table></div>
              )}
            </Panel>
          )}
        </div>
        <CopilotPanel now={now} />
      </div>
    </div>
  );
}

function InsightList({ list, now, actionFor, warnings, empty = 'Nothing needs attention right now.' }: { list: Insight[]; now: Date; actionFor: Map<string, import('@/engine/intelligence').ProposedAction>; warnings?: string[]; empty?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Panel>
      {list.length === 0 ? <Empty>{empty}</Empty> : (
        <ul className="ad-insight-list">
          {list.map((i) => {
            const [tone, label] = SEV[i.severity];
            const action = actionFor.get(i.id);
            return (
              <li key={i.id} className={`ad-insight ad-insight-${i.severity}`}>
                <div className="ad-between"><Badge tone={tone}>{label}</Badge><span className="ad-muted small" title={`${Math.round(i.confidence * 100)}%`}>{confidenceLabel(i.confidence)} confidence</span></div>
                <strong>{i.title}</strong>
                <p><span className="ad-muted">Why: </span>{i.detail}</p>
                <div className="ad-row">
                  {i.next && <Link className="ad-link" href={i.next.href as Route}>{i.next.label} →</Link>}
                  <button type="button" className="ad-link" aria-expanded={open === i.id} onClick={() => setOpen(open === i.id ? null : i.id)}>Evidence <ChevronDown size={12} style={{ transform: open === i.id ? 'rotate(180deg)' : 'none' }} /></button>
                </div>
                {open === i.id && <dl className="ad-dl ad-evidence">{i.evidence.map((e) => <div key={e.label} style={{ display: 'contents' }}><dt>{e.label}</dt><dd>{String(e.value ?? '—')} <span className="ad-muted small">({e.kind})</span></dd></div>)}</dl>}
                {action && action.level !== 'OBSERVE' && <ActionRow action={action} now={now} />}
              </li>
            );
          })}
        </ul>
      )}
      {warnings && warnings.length > 0 && <p className="ad-muted small">Note: {warnings.slice(0, 2).join('; ')}.</p>}
    </Panel>
  );
}
