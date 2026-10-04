// Admin intelligence (Phase 6): turns orders, stock, events and forecasts into a
// short list of insights. Each one says what's happening, why it matters, the
// evidence behind it, how sure we are, and the next step. Insights only observe
// and recommend; nothing is changed without the owner acting on it.

import type { Product } from '@/lib/data';
import { recipes, stockState, type Ingredient } from '@/lib/inventory';
import { minutesSince, prepTarget, type Order } from '@/lib/orders';
import { runOperation, type Evidence, type IntelligenceResult } from '../core/contract';
import type { TresorEvent } from '../events/schema';
import { productPerformance, searchAnalytics } from '../analytics/metrics';
import { stockOutlook } from '../forecast/forecast';

export const INSIGHTS_VERSION = 'insights-v1';

export type Severity = 'act' | 'watch' | 'info';
export type Insight = {
  id: string;
  kind: 'stock' | 'kitchen' | 'search' | 'sales' | 'product' | 'custom' | 'automation' | 'payment' | 'demand';
  severity: Severity;
  title: string;
  detail: string;
  evidence: Evidence[];
  confidence: number;
  next: { label: string; href: string } | null;
};

export type InsightInput = { orders: Order[]; inventory: Ingredient[]; events: TresorEvent[]; products: Product[]; now: Date };

const SEVERITY_ORDER: Record<Severity, number> = { act: 0, watch: 1, info: 2 };
const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export function generateInsights(input: InsightInput): IntelligenceResult<Insight[]> {
  return runOperation('insights', () => {
    const { orders, inventory, events, products, now } = input;
    const out: Insight[] = [];
    const name = (id: string) => products.find((p) => p.id === id)?.name ?? id;
    const warnings: string[] = [];

    // ---- Stock: what's low, what it blocks, and how long it lasts ----
    const outlook = stockOutlook(inventory, orders, now);
    warnings.push(...outlook.warnings);
    const cover = new Map(outlook.result.map((r) => [r.ingredientId, r]));
    for (const item of inventory) {
      const state = stockState(item);
      const row = cover.get(item.id);
      const shortCover = row?.daysOfCover !== null && row?.daysOfCover !== undefined && row.daysOfCover < 1;
      if (state === 'Healthy' && !shortCover) continue;
      const blocks = Object.entries(recipes).filter(([, r]) => item.id in r).map(([pid]) => name(pid));
      out.push({
        id: `stock:${item.id}`,
        kind: 'stock',
        severity: state === 'Out' || shortCover ? 'act' : 'watch',
        title: state === 'Out' ? `${item.name} has run out` : shortCover ? `${item.name} won’t last the day` : `${item.name} is below its reorder point`,
        detail: `${blocks.length ? `Used in ${blocks.slice(0, 3).join(', ')}${blocks.length > 3 ? ` and ${blocks.length - 3} more` : ''}. ` : ''}${row?.suggestedRestock ? `Restock about ${row.suggestedRestock} ${item.unit} to cover three days.` : 'Restock to above the reorder point.'}`,
        evidence: [
          { kind: 'data', label: 'On hand', value: `${item.onHand} ${item.unit}` },
          { kind: 'rule', label: 'Reorder point', value: `${item.reorderPoint} ${item.unit}` },
          ...(row ? [{ kind: 'metric' as const, label: 'Forecast use / day', value: `${row.forecastDaily} ${item.unit}` }, { kind: 'metric' as const, label: 'Days of cover', value: row.daysOfCover ?? '—' }] : []),
        ],
        confidence: row ? Math.max(0.5, row.confidence) : 0.9, // the level itself is a fact; the forecast is what's uncertain
        next: { label: 'Open inventory', href: '/admin/inventory' },
      });
    }

    // ---- Kitchen: orders running well past their prep target ----
    for (const o of orders) {
      if (!['NEW', 'CONFIRMED', 'PREPARING'].includes(o.status)) continue;
      const waited = minutesSince(o.createdAt, now);
      const target = prepTarget(o);
      if (waited < target * 2 + 10) continue;
      out.push({
        id: `kitchen:${o.id}`,
        kind: 'kitchen',
        severity: 'act',
        title: `${o.id} has been waiting ${waited} min`,
        detail: `Its slowest item takes about ${target} min. Check on it or let the customer know.`,
        evidence: [{ kind: 'data', label: 'Placed', value: `${waited} min ago` }, { kind: 'rule', label: 'Prep target', value: `${target} min` }, { kind: 'data', label: 'Status', value: o.status }],
        confidence: 0.95,
        next: { label: 'Open kitchen', href: '/admin/kitchen' },
      });
    }

    // ---- Search: what customers ask for and don't find ----
    const search = searchAnalytics(events);
    for (const z of search.zeroResultQueries.filter((q) => q.count >= 2).slice(0, 3)) {
      out.push({
        id: `search:${z.query}`,
        kind: 'search',
        severity: 'watch',
        title: `“${z.query}” found nothing ${z.count} times`,
        detail: 'Customers are asking for something the menu doesn’t answer. Consider a product, or better search terms on an existing one.',
        evidence: [{ kind: 'metric', label: 'Zero-result searches', value: z.count }, { kind: 'metric', label: 'All searches', value: search.searches }],
        confidence: Math.min(0.9, 0.4 + z.count * 0.1),
        next: { label: 'See search analytics', href: '/admin/analytics' },
      });
    }

    // ---- Sales: today so far against the same hours on recent days ----
    const dayMs = 86400000;
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const sinceMidnight = now.getTime() - startOfToday.getTime();
    const revenueBetween = (from: number, to: number) => orders
      .filter((o) => o.status !== 'CANCELLED' && new Date(o.createdAt).getTime() >= from && new Date(o.createdAt).getTime() <= to)
      .reduce((sum, o) => sum + o.total, 0);
    const today = revenueBetween(startOfToday.getTime(), now.getTime());
    const prior = [1, 2, 3, 4, 5, 6, 7]
      .map((d) => ({ d, revenue: revenueBetween(startOfToday.getTime() - d * dayMs, startOfToday.getTime() - d * dayMs + sinceMidnight), any: revenueBetween(startOfToday.getTime() - d * dayMs, startOfToday.getTime() - (d - 1) * dayMs - 1) > 0 }))
      .filter((x) => x.any);
    if (prior.length >= 3) {
      const mean = prior.reduce((sum, x) => sum + x.revenue, 0) / prior.length;
      // Floor the spread at 10% of the mean so a perfectly steady week doesn't make every rupee an anomaly.
      const sd = Math.max(Math.sqrt(prior.reduce((sum, x) => sum + (x.revenue - mean) ** 2, 0) / prior.length), 0.1 * mean, 1);
      const z = (today - mean) / sd;
      if (Math.abs(z) >= 2) {
        out.push({
          id: `sales:${startOfToday.toISOString().slice(0, 10)}`,
          kind: 'sales',
          severity: z < 0 ? 'watch' : 'info',
          title: z < 0 ? 'Today is unusually quiet' : 'Today is unusually busy',
          detail: `${rupees(today)} so far, against a typical ${rupees(mean)} by this time of day.`,
          evidence: [{ kind: 'metric', label: 'Today so far', value: rupees(today) }, { kind: 'metric', label: `Same hours, ${prior.length}-day average`, value: rupees(mean) }, { kind: 'metric', label: 'z-score', value: Math.round(z * 10) / 10 }],
          confidence: Math.min(0.9, 0.5 + prior.length * 0.05),
          next: null,
        });
      }
    } else {
      warnings.push('fewer than 3 days of sales history; no sales anomaly check');
    }

    // ---- Products: best seller, and things people look at but don't add ----
    const perf = productPerformance(orders.filter((o) => new Date(o.createdAt).toDateString() === now.toDateString()), events);
    const best = perf.find((p) => p.units > 0);
    if (best) {
      out.push({
        id: `product:best:${best.productId}`,
        kind: 'product',
        severity: 'info',
        title: `${name(best.productId)} is today’s best seller`,
        detail: `${best.units} sold for ${rupees(best.revenue)}. Make sure there’s enough on the shelf for the evening.`,
        evidence: [{ kind: 'metric', label: 'Units today', value: best.units }, { kind: 'metric', label: 'Revenue today', value: rupees(best.revenue) }],
        confidence: 0.9,
        next: { label: 'Open products', href: '/admin/products' },
      });
    }
    for (const p of productPerformance([], events).filter((s) => s.views >= 5 && s.adds === 0).slice(0, 2)) {
      out.push({
        id: `product:lookers:${p.productId}`,
        kind: 'product',
        severity: 'watch',
        title: `People look at ${name(p.productId)} but don’t add it`,
        detail: `${p.views} views and no adds. The price, photo or description may need a look.`,
        evidence: [{ kind: 'metric', label: 'Views', value: p.views }, { kind: 'metric', label: 'Adds', value: 0 }],
        confidence: Math.min(0.85, 0.3 + p.views * 0.05),
        next: { label: 'Open products', href: '/admin/products' },
      });
    }

    out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.confidence - a.confidence);
    return {
      result: out,
      confidence: out.length ? out.reduce((s, i) => s + i.confidence, 0) / out.length : 1,
      evidence: [{ kind: 'data', label: 'Orders', value: orders.length }, { kind: 'data', label: 'Events', value: events.length }, { kind: 'data', label: 'Ingredients', value: inventory.length }],
      provider: 'rules',
      providerKind: 'deterministic',
      modelVersion: INSIGHTS_VERSION,
      rankingVersion: null,
      fallbackUsed: false,
      warnings,
    };
  });
}
