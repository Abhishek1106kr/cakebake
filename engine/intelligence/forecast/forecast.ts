// Inventory intelligence (Phase 7): ingredient velocity from real orders, a
// simple exponential-smoothing forecast with a one-step-ahead backtest (MAE,
// MAPE), days of cover and a restock suggestion. Confidence reflects how much
// history there actually is.

import { needsFor, type Ingredient } from '@/lib/inventory';
import type { Product } from '@/lib/data';
import type { Size } from '@/lib/orders';
import { runOperation, type IntelligenceResult } from '../core/contract';
import { withFallback, type ForecastProvider } from '../providers/types';

export const FORECAST_VERSION = 'ses-v1';

type OrderForStock = { status: string; createdAt: string; items: { product: Product; size: Size; qty: number }[] };

/** Simple exponential smoothing. Returns a flat forecast for `horizon` days. */
export function ses(series: number[], alpha = 0.4, horizon = 1): number[] {
  if (!series.length) return new Array(horizon).fill(0);
  let level = series[0];
  for (let i = 1; i < series.length; i += 1) level = alpha * series[i] + (1 - alpha) * level;
  return new Array(horizon).fill(Math.max(0, level));
}

/** One-step-ahead backtest. MAPE skips zero actuals; both are null without enough history. */
export function backtest(series: number[], forecastFn: (history: number[]) => number = (h) => ses(h)[0]): { mae: number | null; mape: number | null; points: number } {
  const errs: number[] = [];
  const pct: number[] = [];
  for (let i = 2; i < series.length; i += 1) {
    const f = forecastFn(series.slice(0, i));
    errs.push(Math.abs(series[i] - f));
    if (series[i] !== 0) pct.push(Math.abs(series[i] - f) / series[i]);
  }
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 1000) / 1000 : null);
  return { mae: avg(errs), mape: avg(pct), points: errs.length };
}

export const localForecast: ForecastProvider = {
  id: 'local-ses',
  kind: 'statistical',
  version: FORECAST_VERSION,
  available: () => true,
  forecast: (series, horizon) => ({ point: ses(series, 0.4, horizon) }),
};

/** Ingredient use per day for the last `days` days (oldest first), from orders that weren't cancelled. */
export function dailyConsumption(orders: OrderForStock[], now: Date, days = 14): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  const start = new Date(now.getTime() - (days - 1) * 86400000);
  start.setHours(0, 0, 0, 0);
  for (const o of orders) {
    if (o.status === 'CANCELLED') continue;
    const idx = Math.floor((new Date(o.createdAt).getTime() - start.getTime()) / 86400000);
    if (idx < 0 || idx >= days) continue;
    for (const [ingredient, amount] of Object.entries(needsFor(o.items))) {
      (out[ingredient] ??= new Array(days).fill(0))[idx] += amount;
    }
  }
  return out;
}

export type StockOutlook = {
  ingredientId: string;
  name: string;
  unit: Ingredient['unit'];
  onHand: number;
  forecastDaily: number;
  daysOfCover: number | null;
  suggestedRestock: number;
  historyDays: number;
  mae: number | null;
  mape: number | null;
  confidence: number;
};

const roundUp = (n: number, unit: Ingredient['unit']) => (unit === 'pcs' ? Math.ceil(n / 6) * 6 : Math.ceil(n * 10) / 10);

/** Days of cover and a restock suggestion for every ingredient that's being used. */
export function stockOutlook(inventory: Ingredient[], orders: OrderForStock[], now: Date, coverDays = 3): IntelligenceResult<StockOutlook[]> {
  return runOperation('forecast.stock', () => {
    const usage = dailyConsumption(orders, now);
    const warnings: string[] = [];
    const rows: StockOutlook[] = [];
    let fallbackUsed = false;
    let provider = 'none';
    for (const item of inventory) {
      const series = usage[item.id];
      if (!series) continue;
      // Start the series at the first day with any activity, so a new shop isn't averaged with empty days.
      const first = series.findIndex((x) => x > 0);
      const active = series.slice(first);
      const out = withFallback('forecast', (p: ForecastProvider) => ({ value: p.forecast(active, 1).point[0], id: p.id }));
      const forecastDaily = out.ok ? out.value.value : active.reduce((a, b) => a + b, 0) / active.length;
      if (!out.ok) fallbackUsed = true; else { provider = out.value.id; fallbackUsed ||= out.fallbackUsed; }
      const bt = backtest(active);
      const cover = forecastDaily > 0 ? Math.round((item.onHand / forecastDaily) * 10) / 10 : null;
      const need = forecastDaily * coverDays + item.reorderPoint - item.onHand;
      rows.push({
        ingredientId: item.id, name: item.name, unit: item.unit, onHand: item.onHand,
        forecastDaily: Math.round(forecastDaily * 1000) / 1000, daysOfCover: cover,
        suggestedRestock: need > 0 ? roundUp(need, item.unit) : 0,
        historyDays: active.length, mae: bt.mae, mape: bt.mape,
        // A week of history earns full confidence; one day of data is a guess.
        confidence: Math.round(Math.min(1, active.length / 7) * 100) / 100,
      });
    }
    const historyDays = Math.max(0, ...rows.map((r) => r.historyDays));
    if (historyDays < 3) warnings.push(`only ${historyDays} day(s) of order history; forecasts are rough`);
    rows.sort((a, b) => (a.daysOfCover ?? Infinity) - (b.daysOfCover ?? Infinity));
    return {
      result: rows,
      confidence: Math.min(1, historyDays / 7),
      evidence: [{ kind: 'data', label: 'Order history', value: `${historyDays} day(s)` }, { kind: 'rule', label: 'Cover target', value: `${coverDays} days + reorder point` }],
      provider,
      providerKind: 'statistical',
      modelVersion: FORECAST_VERSION,
      rankingVersion: null,
      fallbackUsed,
      warnings,
    };
  });
}
