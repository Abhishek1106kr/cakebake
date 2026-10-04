// Admin copilot (Phase 10): a plain-language way into the engine's structured
// outputs. It routes a question to the right operation (sales, orders, stock,
// forecasts, search gaps, products, insights), answers with the numbers and the
// evidence behind them, and can only *draft* actions, which still need approval.
// No language model is involved; a GenerationProvider could rephrase answers later
// without changing the facts.

import type { Product } from '@/lib/data';
import { availableUnits, stockState, type Ingredient } from '@/lib/inventory';
import { isActive, isSameDay, orderStats, type Order } from '@/lib/orders';
import { dueState, hasCustom, requiredBy } from '@/lib/admin/order-ops';
import { runOperation, type Evidence, type IntelligenceResult } from '../core/contract';
import type { TresorEvent } from '../events/schema';
import { productPerformance, searchAnalytics } from '../analytics/metrics';
import { stockOutlook } from '../forecast/forecast';
import { generateInsights } from '../insights/insights';
import { proposeActions, type ProposedAction } from '../decisions/decisions';
import { normalizeQuery } from '../intent/intent';
import { correct } from '../search/fuzzy';

export const COPILOT_VERSION = 'copilot-v1';

export type CopilotTopic = 'priorities' | 'sales' | 'orders' | 'stock' | 'ingredient' | 'forecast' | 'best_sellers' | 'product' | 'search_gaps' | 'help'
  | 'automations' | 'custom_cakes' | 'at_risk' | 'revenue_compare' | 'feature' | 'cakes';
export type CopilotAnswer = { topic: CopilotTopic; answer: string; facts: { label: string; value: string }[]; actions: ProposedAction[]; followUps: string[] };
export type JobSummary = { id: string; kind: 'invoice' | 'whatsapp'; orderId: string; topic: string; status: string; attempts: number; lastError: string | null };
export type CopilotData = { orders: Order[]; inventory: Ingredient[]; events: TresorEvent[]; products: Product[]; now: Date; jobs?: JobSummary[] };

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

const TOPIC_WORDS: [CopilotTopic, RegExp][] = [
  ['revenue_compare', /\b(than|vs|versus|compared (to|with)) yesterday\b|\bwhy\b.*\b(revenue|sales)\b.*\b(lower|higher|down|up|less|more)\b/],
  ['at_risk', /\b(at risk|miss(ing)? (their|the|its) slots?|running late|late orders?|behind schedule)\b/],
  ['custom_cakes', /\bcustom\b.*\b(due|tomorrow|today|this week|pending|how many)\b|\b(due|tomorrow)\b.*\bcustom\b/],
  ['automations', /\b(automations?|failed (jobs?|messages?|whatsapp|invoices?)|whatsapp|invoices? failed|messages? failed)\b/],
  ['feature', /\b(feature|promote|highlight|put on the (home|front))\b/],
  ['cakes', /\bhow are (the )?cakes\b|\bcakes? (doing|selling)\b/],
  ['search_gaps', /\b(search|searched|searching|looking for|can'?t find|not find|couldn'?t find|missing from the menu)\b/],
  ['forecast', /\b(forecast|tomorrow|how long|last us|run out|stock out|days of cover|predict)\b/],
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
        case 'automations': {
          const jobs = data.jobs ?? [];
          const failed = jobs.filter((j) => j.status === 'failed');
          const retrying = jobs.filter((j) => j.status === 'retrying' || j.status === 'requested');
          const label = (j: JobSummary) => `${j.kind === 'invoice' ? 'invoice' : `WhatsApp ${j.topic === 'confirmation' ? 'confirmation' : j.topic.replace('status:', '').toLowerCase().replace(/_/g, ' ')}`} for ${j.orderId}`;
          return {
            topic,
            answer: !jobs.length ? 'No automation jobs recorded yet.' : failed.length ? `${failed.length} failed: ${list(failed.slice(0, 4).map(label))}${failed.length > 4 ? ' and more' : ''}. Orders are unaffected; retry them from Automations.` : `All ${jobs.length} jobs went through${retrying.length ? `; ${retrying.length} still running` : ''}.`,
            facts: [{ label: 'Jobs', value: String(jobs.length) }, { label: 'Failed', value: String(failed.length) }, { label: 'Running or retrying', value: String(retrying.length) }, ...failed.slice(0, 4).map((j) => ({ label: j.id, value: j.lastError ?? 'error' }))],
            actions: actions.filter((a) => a.kind === 'investigate'),
            followUps: ['What needs my attention?', 'Which orders are at risk of missing their slot?'],
          };
        }
        case 'custom_cakes': {
          const day = new Date(now);
          if (/\btomorrow\b/.test(q)) day.setDate(day.getDate() + 1);
          const cakes = orders.filter((o) => hasCustom(o) && o.status !== 'CANCELLED' && requiredBy(o).toDateString() === day.toDateString());
          const notStarted = cakes.filter((o) => o.status === 'NEW' || o.status === 'CONFIRMED');
          const when = /\btomorrow\b/.test(q) ? 'tomorrow' : 'today';
          return {
            topic,
            answer: cakes.length ? `${cakes.length} custom cake order${cakes.length === 1 ? '' : 's'} due ${when}: ${list(cakes.map((o) => o.id))}. ${notStarted.length} not started yet.` : `No custom cake orders due ${when}.`,
            facts: cakes.map((o) => ({ label: o.id, value: `${o.status.toLowerCase().replace(/_/g, ' ')} · slot ${o.slot}` })),
            actions: actions.filter((a) => a.kind === 'adjust_preparation'),
            followUps: ['Which orders are at risk of missing their slot?', 'What’s running low?'],
          };
        }
        case 'at_risk': {
          const risky = orders.filter((o) => isActive(o) && ['late', 'at-risk'].includes(dueState(o, now))).sort((a, b) => requiredBy(a).getTime() - requiredBy(b).getTime());
          return {
            topic,
            answer: risky.length ? `${risky.length} order${risky.length === 1 ? ' is' : 's are'} late or close to missing the slot: ${list(risky.slice(0, 5).map((o) => `${o.id} (${dueState(o, now) === 'late' ? 'late' : 'at risk'}, ${o.status.toLowerCase().replace(/_/g, ' ')})`))}.` : 'Every active order is on track for its slot.',
            facts: risky.slice(0, 8).map((o) => ({ label: o.id, value: `${dueState(o, now)} · due ${requiredBy(o).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · ${o.status.toLowerCase()}` })),
            actions: actions.filter((a) => a.kind === 'check_order' || a.kind === 'adjust_preparation'),
            followUps: ['Which orders are in the kitchen?', 'How many custom cake orders are due tomorrow?'],
          };
        }
        case 'revenue_compare': {
          const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
          const sinceMidnight = now.getTime() - startToday.getTime();
          const window = (from: number, to: number) => orders.filter((o) => o.status !== 'CANCELLED' && Date.parse(o.createdAt) >= from && Date.parse(o.createdAt) < to);
          const today = window(startToday.getTime(), now.getTime() + 1);
          const ySame = window(startToday.getTime() - 86400000, startToday.getTime() - 86400000 + sinceMidnight);
          const yAll = window(startToday.getTime() - 86400000, startToday.getTime());
          const sum = (xs: Order[]) => xs.reduce((s, o) => s + o.total, 0);
          const aov = (xs: Order[]) => (xs.length ? Math.round(sum(xs) / xs.length) : 0);
          const diff = sum(today) - sum(ySame);
          const why: string[] = [];
          if (today.length !== ySame.length) why.push(`${Math.abs(today.length - ySame.length)} ${today.length < ySame.length ? 'fewer' : 'more'} orders (${today.length} vs ${ySame.length})`);
          if (today.length && ySame.length && Math.abs(aov(today) - aov(ySame)) >= 50) why.push(`average order ${rupees(aov(today))} vs ${rupees(aov(ySame))}`);
          const cakesToday = today.filter(hasCustom).length; const cakesY = ySame.filter(hasCustom).length;
          if (cakesToday !== cakesY) why.push(`${cakesToday} custom cake orders vs ${cakesY}`);
          return {
            topic,
            answer: !yAll.length ? 'There are no orders from yesterday to compare with.' : `${rupees(sum(today))} so far today against ${rupees(sum(ySame))} by this time yesterday (${diff >= 0 ? 'up' : 'down'} ${rupees(Math.abs(diff))}). ${why.length ? `The difference: ${list(why)}.` : 'Order count and size are about the same.'} Yesterday finished at ${rupees(sum(yAll))}.`,
            facts: [{ label: 'Today so far', value: `${rupees(sum(today))} · ${today.length} orders` }, { label: 'Yesterday, same time', value: `${rupees(sum(ySame))} · ${ySame.length} orders` }, { label: 'Yesterday, full day', value: `${rupees(sum(yAll))} · ${yAll.length} orders` }],
            actions: [],
            followUps: ['What’s selling best?', 'What needs my attention?'],
          };
        }
        case 'feature': {
          const week = orders.filter((o) => o.status !== 'CANCELLED' && now.getTime() - Date.parse(o.createdAt) <= 7 * 86400000);
          const perf = productPerformance(week, events);
          const candidates = products.filter((p) => p.cake && p.available !== false).map((p) => {
            const s = perf.find((x) => x.productId === p.id);
            return { p, units: s?.units ?? 0, views: s?.views ?? 0, score: (s?.units ?? 0) * 3 + (s?.views ?? 0) * 0.5 + (p.featured ? 0.5 : 0) };
          }).sort((a, b) => b.score - a.score);
          const pick = candidates[0];
          return {
            topic,
            answer: !pick ? 'No whole cakes are available to feature.' : pick.units + pick.views === 0 ? `There isn’t enough sales or view history to choose on evidence yet. ${pick.p.name} is your signature; start there and let the numbers decide next week.` : `${pick.p.name}: ${pick.units} sold and ${pick.views} views in the last 7 days, the strongest whole cake. Featuring is a draft for you to approve in Content or Campaigns; nothing changes on the site by itself.`,
            facts: candidates.slice(0, 4).map((c) => ({ label: c.p.name, value: `${c.units} sold · ${c.views} views` })),
            actions: actions.filter((a) => a.kind === 'feature'),
            followUps: ['How are cakes doing today?', 'What’s selling best?'],
          };
        }
        case 'cakes': {
          const today = orders.filter((o) => o.status !== 'CANCELLED' && isSameDay(o.createdAt, now));
          let units = 0; let revenue = 0; let custom = 0;
          const by = new Map<string, number>();
          for (const o of today) for (const l of o.items) {
            if (l.custom) { custom += l.qty; revenue += l.unitPrice * l.qty; continue; }
            const p = products.find((x) => x.id === l.product.id);
            if (l.product.category === 'Cake' || p?.cake) { units += l.qty; revenue += l.unitPrice * l.qty; by.set(l.product.name, (by.get(l.product.name) ?? 0) + l.qty); }
          }
          const top = [...by.entries()].sort((a, b) => b[1] - a[1])[0];
          return {
            topic,
            answer: units + custom === 0 ? 'No cakes sold yet today.' : `${units} cake${units === 1 ? '' : 's'} from the menu and ${custom} custom cake${custom === 1 ? '' : 's'} today, ${rupees(revenue)} in all.${top ? ` ${top[0]} leads with ${top[1]}.` : ''}`,
            facts: [{ label: 'Menu cakes', value: String(units) }, { label: 'Custom cakes', value: String(custom) }, { label: 'Cake revenue', value: rupees(revenue) }, ...[...by.entries()].slice(0, 3).map(([n, c]) => ({ label: n, value: String(c) }))],
            actions: [],
            followUps: ['Which cake should we feature?', 'How many custom cake orders are due tomorrow?'],
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
            answer: 'I can answer from today’s records: sales and how they compare with yesterday, orders in the kitchen and which are at risk, custom cakes due, stock and how long it lasts, failed automations, best sellers and cakes, a specific product, what to feature, and what customers searched for.',
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
