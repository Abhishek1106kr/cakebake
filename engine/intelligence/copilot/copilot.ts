// Admin copilot (Phase 10): a plain-language way into the engine's structured
// outputs. It routes a question to the right operation (sales, orders, stock,
// forecasts, search gaps, products, insights), answers with the numbers and the
// evidence behind them, and can only *draft* actions, which still need approval.
// No language model is involved; a GenerationProvider could rephrase answers later
// without changing the facts.

import type { Product } from '@/lib/data';
import { availableUnits, stockState, type Ingredient } from '@/lib/inventory';
import { isSameDay, orderStats, type Order } from '@/lib/orders';
import { runOperation, type Evidence, type IntelligenceResult } from '../core/contract';
import type { TresorEvent } from '../events/schema';
import { productPerformance, searchAnalytics } from '../analytics/metrics';
import { stockOutlook } from '../forecast/forecast';
import { generateInsights } from '../insights/insights';
import { proposeActions, type ProposedAction } from '../decisions/decisions';
import { normalizeQuery } from '../intent/intent';
import { correct } from '../search/fuzzy';

export const COPILOT_VERSION = 'copilot-v1';

export type CopilotTopic = 'priorities' | 'sales' | 'orders' | 'stock' | 'ingredient' | 'forecast' | 'best_sellers' | 'product' | 'search_gaps' | 'help';
export type CopilotAnswer = { topic: CopilotTopic; answer: string; facts: { label: string; value: string }[]; actions: ProposedAction[]; followUps: string[] };
export type CopilotData = { orders: Order[]; inventory: Ingredient[]; events: TresorEvent[]; products: Product[]; now: Date };

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

const TOPIC_WORDS: [CopilotTopic, RegExp][] = [
  ['search_gaps', /\b(search|searched|searching|looking for|can'?t find|not find|couldn'?t find|missing from the menu)\b/],
  ['forecast', /\b(forecast|tomorrow|how long|last us|run out|days of cover|predict)\b/],
  ['best_sellers', /\b(best|top|popular|selling|seller|sellers|most sold)\b/],
  ['sales', /\b(sales|revenue|earn|earned|made|money|takings|turnover|aov|average order)\b/],
  ['orders', /\b(orders?|kitchen|pending|preparing|ready|on the way|delivery|deliveries|late|waiting)\b/],
  ['stock', /\b(stock|low|running out|restock|reorder|inventory|shelf|ingredients?)\b/],
  ['priorities', /\b(what should|attention|priorit|focus|urgent|needs me|need me|today'?s plan|anything wrong|problems?)\b/],
];

// "Tresor" names the bakery, not the latte.
const words = (s: string) => (s.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w !== 'tresor');

/** Finds an ingredient or product the question names, allowing small typos. */
function mentioned<T extends { id: string; name: string }>(question: string, items: T[]): T | null {
  const q = ` ${question} `;
  const full = items.find((i) => q.includes(` ${i.name.toLowerCase()} `));
  if (full) return full;
  const direct = items.find((i) => words(i.name).filter((w) => w.length > 3).some((w) => q.includes(` ${w} `)));
  if (direct) return direct;
  const vocab = new Map<string, T>();
  for (const i of items) for (const w of words(i.name)) if (w.length > 4) vocab.set(w, i);
  for (const w of words(question).filter((x) => x.length >= 6)) {
    const c = correct(w, vocab.keys());
    if (c) return vocab.get(c.to) ?? null;
  }
  return null;
}

export function askCopilot(question: string, data: CopilotData): IntelligenceResult<CopilotAnswer> {
  return runOperation('copilot', () => {
    const q = normalizeQuery(question);
    const { orders, inventory, events, products, now } = data;
    const evidence: Evidence[] = [];
    const outlook = stockOutlook(inventory, orders, now);
    const insights = generateInsights({ orders, inventory, events, products, now });
    const actions = proposeActions(insights.result, outlook.result);
    // When a product and an ingredient are both named, the longer full name wins:
    // "dark chocolate brownie" is the product, "pistachio paste" is the ingredient.
    const named = (name: string) => ` ${q} `.includes(` ${name.toLowerCase()} `);
    const product = mentioned(q, products);
    const ingredientHit = mentioned(q, inventory);
    const productFull = product !== null && named(product.name);
    const ingredientFull = ingredientHit !== null && named(ingredientHit.name);
    const ingredient = ingredientHit && productFull && (!ingredientFull || product!.name.length >= ingredientHit.name.length) ? null : ingredientHit;
    const topic: CopilotTopic = ingredient && !/\b(best|top|sales|revenue)\b/.test(q)
      ? (/\b(forecast|how long|last|run out)\b/.test(q) ? 'forecast' : 'ingredient')
      : product && !/\b(best|top|sales|revenue|stock)\b/.test(q) ? 'product'
        : TOPIC_WORDS.find(([, re]) => re.test(q))?.[0] ?? (q ? 'help' : 'priorities');
    evidence.push({ kind: 'rule', label: 'Topic', value: topic, source: COPILOT_VERSION });

    const answer = ((): CopilotAnswer => {
      switch (topic) {
        case 'priorities': {
          const top = insights.result.slice(0, 3);
          return {
            topic,
            answer: top.length ? `${top.length === 1 ? 'One thing' : `${top.length} things`} to look at: ${list(top.map((i) => i.title.charAt(0).toLowerCase() + i.title.slice(1)))}.` : 'Nothing needs you right now.',
            facts: top.map((i) => ({ label: i.severity === 'act' ? 'Act now' : i.severity === 'watch' ? 'Keep an eye' : 'Good to know', value: i.title })),
            actions: actions.filter((a) => top.some((i) => i.id === a.insightId) && a.level !== 'OBSERVE'),
            followUps: ['What’s running low?', 'How are sales today?', 'What did people search for and not find?'],
          };
        }
        case 'sales': {
          const s = orderStats(orders, now);
          return {
            topic,
            answer: s.count ? `${rupees(s.revenue)} from ${s.count} orders today, ${rupees(s.averageValue)} on average.${s.cancelledToday ? ` ${s.cancelledToday} cancelled, not counted.` : ''}` : 'No orders yet today.',
            facts: [{ label: 'Revenue today', value: rupees(s.revenue) }, { label: 'Orders today', value: String(s.count) }, { label: 'Average order', value: rupees(s.averageValue) }, { label: 'Cancelled today', value: String(s.cancelledToday) }],
            actions: [],
            followUps: ['What’s selling best?', 'Which orders are in the kitchen?'],
          };
        }
        case 'orders': {
          const s = orderStats(orders, now);
          const late = insights.result.filter((i) => i.kind === 'kitchen');
          return {
            topic,
            answer: `${s.inKitchen} in the kitchen, ${s.ready} ready, ${s.onTheWay} on the way.${late.length ? ` ${list(late.map((i) => i.title))}.` : ' Nothing is running late.'}`,
            facts: [{ label: 'In the kitchen', value: String(s.inKitchen) }, { label: 'Ready', value: String(s.ready) }, { label: 'On the way', value: String(s.onTheWay) }, { label: 'Running late', value: String(late.length) }],
            actions: actions.filter((a) => a.kind === 'check_order'),
            followUps: ['How are sales today?', 'What needs my attention?'],
          };
        }
        case 'stock': {
          const low = inventory.filter((i) => stockState(i) !== 'Healthy');
          return {
            topic,
            answer: low.length ? `${low.length} ingredient${low.length === 1 ? ' is' : 's are'} low: ${list(low.map((i) => `${i.name.toLowerCase()} (${i.onHand} ${i.unit})`))}.` : 'Every ingredient is above its reorder point.',
            facts: low.map((i) => ({ label: i.name, value: `${i.onHand} ${i.unit} · reorder at ${i.reorderPoint}` })),
            actions: actions.filter((a) => a.kind === 'restock'),
            followUps: ['How long will the beans last?', 'What should I restock?'],
          };
        }
        case 'ingredient':
        case 'forecast': {
          const target = ingredient ?? null;
          const rows = target ? outlook.result.filter((r) => r.ingredientId === target.id) : outlook.result.slice(0, 4);
          if (target && rows.length === 0) {
            return { topic, answer: `${target.name}: ${target.onHand} ${target.unit} on hand (${stockState(target).toLowerCase()}). No recent orders use it, so there’s nothing to forecast yet.`, facts: [{ label: 'On hand', value: `${target.onHand} ${target.unit}` }], actions: [], followUps: ['What’s running low?'] };
          }
          const row = rows[0];
          const describe = (r: typeof row) => `${r.name.toLowerCase()}: about ${r.daysOfCover ?? '—'} days left at ${r.forecastDaily} ${r.unit} a day`;
          return {
            topic,
            answer: rows.length
              ? `${target ? describe(row).charAt(0).toUpperCase() + describe(row).slice(1) : `Shortest cover: ${list(rows.map(describe))}`}.${outlook.warnings.length ? ` (${outlook.warnings[0]}.)` : ''}`
              : 'No ingredient use recorded yet, so there’s nothing to forecast.',
            facts: rows.flatMap((r) => [{ label: `${r.name}: on hand`, value: `${r.onHand} ${r.unit}` }, { label: `${r.name}: days of cover`, value: String(r.daysOfCover ?? '—') }, ...(r.suggestedRestock ? [{ label: `${r.name}: suggested restock`, value: `${r.suggestedRestock} ${r.unit}` }] : [])]),
            actions: actions.filter((a) => a.kind === 'restock' && (!target || a.insightId === `stock:${target.id}`)),
            followUps: ['What’s running low?', 'What needs my attention?'],
          };
        }
        case 'best_sellers': {
          const perf = productPerformance(orders.filter((o) => isSameDay(o.createdAt, now)), events).filter((p) => p.units > 0).slice(0, 3);
          const name = (id: string) => products.find((p) => p.id === id)?.name ?? id;
          return {
            topic,
            answer: perf.length ? `Today: ${list(perf.map((p) => `${name(p.productId)} (${p.units} sold, ${rupees(p.revenue)})`))}.` : 'Nothing sold yet today.',
            facts: perf.map((p) => ({ label: name(p.productId), value: `${p.units} sold · ${rupees(p.revenue)}` })),
            actions: [],
            followUps: ['How are sales today?', 'What’s running low?'],
          };
        }
        case 'product': {
          const p = product!;
          const perf = productPerformance(orders.filter((o) => isSameDay(o.createdAt, now)), events).find((x) => x.productId === p.id);
          const allViews = productPerformance([], events).find((x) => x.productId === p.id);
          const units = availableUnits(inventory, [], p.id, 'Regular');
          return {
            topic,
            answer: `${p.name}: ${perf?.units ?? 0} sold today, ${allViews?.views ?? 0} views recorded, ${p.cake ? 'made to order' : units >= 99 ? 'no stock limit' : `${units} more can be made from current stock`}.`,
            facts: [{ label: 'Price', value: rupees(p.price) }, { label: 'Sold today', value: String(perf?.units ?? 0) }, { label: 'Views', value: String(allViews?.views ?? 0) }, { label: 'Add rate', value: allViews?.addRate === null || allViews?.addRate === undefined ? '—' : `${Math.round(allViews.addRate * 100)}%` }],
            actions: [],
            followUps: ['What’s selling best?', 'What’s running low?'],
          };
        }
        case 'search_gaps': {
          const s = searchAnalytics(events);
          return {
            topic,
            answer: s.searches === 0 ? 'No searches recorded yet.' : s.zeroResultQueries.length ? `${s.searches} searches; these found nothing: ${list(s.zeroResultQueries.slice(0, 4).map((z) => `“${z.query}” (${z.count}×)`))}.` : `${s.searches} searches, and every one found something.`,
            facts: [{ label: 'Searches', value: String(s.searches) }, { label: 'Found nothing', value: s.zeroResultRate === null ? '—' : `${Math.round(s.zeroResultRate * 100)}%` }, ...s.topQueries.slice(0, 3).map((t) => ({ label: `“${t.query}”`, value: `${t.count}×` }))],
            actions: actions.filter((a) => a.kind === 'review_search_gap'),
            followUps: ['What’s selling best?', 'What needs my attention?'],
          };
        }
        default:
          return {
            topic: 'help',
            answer: 'I can answer questions about today’s sales, orders in the kitchen, stock and how long it will last, best sellers, a specific product, and what customers searched for.',
            facts: [],
            actions: [],
            followUps: ['What needs my attention?', 'How are sales today?', 'What’s running low?', 'How long will the milk last?'],
          };
      }
    })();

    return {
      result: answer,
      confidence: answer.topic === 'help' ? 0.2 : answer.topic === 'forecast' || answer.topic === 'ingredient' ? Math.max(0.3, outlook.confidence) : 0.9,
      evidence: [...evidence, ...(ingredient ? [{ kind: 'match' as const, label: 'Ingredient', value: ingredient.name }] : []), ...(product ? [{ kind: 'match' as const, label: 'Product', value: product.name }] : [])],
      provider: 'rules',
      providerKind: 'deterministic',
      modelVersion: COPILOT_VERSION,
      rankingVersion: null,
      fallbackUsed: answer.topic === 'help',
      warnings: answer.topic === 'forecast' || answer.topic === 'ingredient' ? outlook.warnings : [],
    };
  });
}
