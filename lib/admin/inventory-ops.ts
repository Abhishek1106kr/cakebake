// Inventory explanations: who uses an ingredient, how use is changing, and a plain
// "why is this low?" built only from the order records and stock levels.

import { availableQty, needsFor, stockLevel, type Ingredient } from '@/lib/inventory';
import type { Order } from '@/lib/orders';
import type { StockOutlook } from '@/engine/intelligence';

const DAY = 86400000;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export type UsageBreakdown = { thisWeek: number; lastWeek: number; changePct: number | null; byProduct: { key: string; name: string; amount: number; share: number }[]; customShare: number };

/** Use of one ingredient in the last 7 days against the 7 before, split by what consumed it. */
export function usageBreakdown(ingredientId: string, orders: Order[], now: Date): UsageBreakdown {
  const t = now.getTime();
  let thisWeek = 0; let lastWeek = 0;
  const by = new Map<string, { name: string; amount: number }>();
  for (const o of orders) {
    if (o.status === 'CANCELLED') continue;
    const at = Date.parse(o.createdAt);
    const recent = at >= t - 7 * DAY && at <= t;
    const prior = at >= t - 14 * DAY && at < t - 7 * DAY;
    if (!recent && !prior) continue;
    for (const l of o.items) {
      const amount = needsFor([l])[ingredientId] ?? 0;
      if (!amount) continue;
      if (recent) {
        thisWeek += amount;
        const key = l.custom ? 'custom-cake' : l.product.id;
        const cur = by.get(key) ?? { name: l.custom ? 'Custom cakes' : l.product.name, amount: 0 };
        by.set(key, { ...cur, amount: cur.amount + amount });
      } else lastWeek += amount;
    }
  }
  const byProduct = [...by.entries()].map(([key, v]) => ({ key, name: v.name, amount: r3(v.amount), share: thisWeek ? v.amount / thisWeek : 0 })).sort((a, b) => b.amount - a.amount);
  return { thisWeek: r3(thisWeek), lastWeek: r3(lastWeek), changePct: lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null, byProduct, customShare: byProduct.find((b) => b.key === 'custom-cake')?.share ?? 0 };
}

/** Sentences explaining a low level, each traceable to a number shown beside it. */
export function whyLow(item: Ingredient, usage: UsageBreakdown, outlook: StockOutlook | undefined): string[] {
  const level = stockLevel(item);
  const out: string[] = [];
  if (level === 'HEALTHY') return ['Above its reorder point.'];
  const avail = availableQty(item);
  out.push(`${avail} ${item.unit} available against a reorder point of ${item.reorderPoint} ${item.unit}${item.reserved ? ` (${item.reserved} ${item.unit} reserved)` : ''}.`);
  if (usage.changePct !== null && usage.changePct >= 15) {
    const top = usage.byProduct[0];
    out.push(`Use rose ${usage.changePct}% this week (${usage.thisWeek} vs ${usage.lastWeek} ${item.unit})${top ? `, mostly from ${top.name.toLowerCase()} (${Math.round(top.share * 100)}%)` : ''}.`);
  } else if (usage.thisWeek > 0) {
    const top = usage.byProduct[0];
    out.push(`${usage.thisWeek} ${item.unit} used in the last 7 days${top ? `, ${Math.round(top.share * 100)}% by ${top.name.toLowerCase()}` : ''}.`);
  } else {
    out.push('No orders used it in the last 7 days: the level is low from the starting stock or manual movements, not demand.');
  }
  if (outlook?.daysOfCover !== null && outlook?.daysOfCover !== undefined) out.push(`At about ${outlook.forecastDaily} ${item.unit} a day, it lasts ${outlook.daysOfCover} days.`);
  if (item.reserved && item.reserved >= item.onHand / 2) out.push('More than half of what’s on hand is reserved.');
  return out;
}

export function ordersConsuming(ingredientId: string, orders: Order[], limit = 12): { order: Order; amount: number }[] {
  return orders
    .filter((o) => o.status !== 'CANCELLED')
    .map((order) => ({ order, amount: r3(needsFor(order.items)[ingredientId] ?? 0) }))
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.order.createdAt.localeCompare(a.order.createdAt))
    .slice(0, limit);
}

export function inventoryCsvRows(items: Ingredient[], outlook: Map<string, StockOutlook>): (string | number | null)[][] {
  return [
    ['Ingredient', 'Area', 'Unit', 'On hand', 'Reserved', 'Available', 'Reorder point', 'Use per day', 'Days of cover', 'Status'],
    ...items.map((i) => { const o = outlook.get(i.id); return [i.name, i.area, i.unit, i.onHand, i.reserved ?? 0, availableQty(i), i.reorderPoint, o?.forecastDaily ?? null, o?.daysOfCover ?? null, stockLevel(i)]; }),
  ];
}
