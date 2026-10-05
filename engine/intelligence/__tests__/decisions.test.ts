import { describe, expect, it } from 'vitest';
import { products } from '@/lib/data';
import { applyMovement, initialInventory } from '@/lib/inventory';
import { createOrder, makeLine, seedOrders, type CheckoutDetails } from '@/lib/orders';
import '../index';
import { moodsFor, orderShowcase, selectRendition } from '../content/content';
import { approveAndApply, memoryDecisionStore, pending, POLICY, proposeActions, reject, type ExecutionPlan } from '../decisions/decisions';
import { askCopilot } from '../copilot/copilot';
import { generateInsights } from '../insights/insights';
import { stockOutlook } from '../forecast/forecast';
import { search } from '../search/pipeline';
import { createEvent } from '../events/schema';
import type { MediaAsset } from '@/lib/media';

const now = new Date('2026-10-04T12:00:00+05:30');
const p = (id: string) => products.find((x) => x.id === id)!;
const details: CheckoutDetails = { customer: { name: 'T', phone: '9845012345', email: '' }, address: '12 Test Road, Indiranagar', city: 'Bengaluru', pin: '560038', slot: 'ASAP', paymentMethod: 'UPI' };

describe('content selection', () => {
  it('leads with breakfast things in the morning and desserts in the evening', () => {
    const morning = orderShowcase({ timeOfDay: 'morning', season: 'post-monsoon' }, { products }).result.slice(0, 3);
    expect(morning.every((i) => ['Pastry', 'Coffee'].includes(i.product.category))).toBe(true);
    const evening = orderShowcase({ timeOfDay: 'evening', season: 'post-monsoon' }, { products }).result.slice(0, 4);
    expect(evening.every((i) => ['Cake', 'Dessert'].includes(i.product.category))).toBe(true);
  });

  it('leans cold in summer and warm in the monsoon', () => {
    const summer = orderShowcase({ timeOfDay: 'afternoon', season: 'summer' }, { products }).result;
    const monsoon = orderShowcase({ timeOfDay: 'afternoon', season: 'monsoon' }, { products }).result;
    // Scores, not positions: positions depend on how many other items tie.
    const score = (list: typeof summer, id: string) => list.find((i) => i.product.id === id)!.score;
    expect(score(summer, 'cold-brew')).toBeGreaterThan(score(monsoon, 'cold-brew'));
    expect(score(monsoon, 'tresor-latte')).toBeGreaterThan(score(summer, 'tresor-latte'));
    // An iced drink is never "warm for the rain".
    expect(monsoon.find((i) => i.product.id === 'cold-brew')!.reasons).not.toContain('warm for the rain');
  });

  it('leaves out sold-out items and lowers nearly-gone ones', () => {
    const items = orderShowcase({ timeOfDay: 'morning', season: 'winter' }, { products, availability: (x) => (x.id === 'almond-croissant' ? 0 : x.id === 'pain-au-chocolat' ? 2 : 20) });
    expect(items.result.map((i) => i.product.id)).not.toContain('almond-croissant');
    const pain = items.result.find((i) => i.product.id === 'pain-au-chocolat')!;
    expect(pain.reasons).toContain('only a few left');
    // The croissant, plus anything off the menu (seasonal items out of season).
    expect(items.evidence.find((e) => e.label === 'Hidden (sold out)')?.value).toBe(1 + products.filter((p) => p.available === false).length);
  });

  it('only suggests moods the search engine actually answers', () => {
    for (const timeOfDay of ['morning', 'afternoon', 'evening', 'night'] as const) {
      for (const season of ['summer', 'monsoon', 'post-monsoon', 'winter'] as const) {
        for (const mood of moodsFor({ timeOfDay, season })) {
          const r = search(mood, { products });
          expect(r.result.relaxed, `${mood} (${timeOfDay}, ${season})`).not.toContain('everything');
          expect(r.result.hits.length, mood).toBeGreaterThan(0);
        }
      }
    }
  });

  it('serves a still poster instead of video on slow connections or with reduced motion', () => {
    const video: MediaAsset = { id: 'v', type: 'video', src: '/v.mp4', poster: '/v.jpg', alt: '', aspect: '16 / 9', priority: 'high', motionRole: 'hero', tone: ['#fff', '#000'] };
    expect(selectRendition(video, { network: 'fast', reducedMotion: false, device: 'desktop' }).mode).toBe('video');
    expect(selectRendition(video, { network: 'slow', reducedMotion: false, device: 'desktop' })).toMatchObject({ mode: 'image', src: '/v.jpg' });
    expect(selectRendition(video, { network: 'fast', reducedMotion: true, device: 'desktop' }).mode).toBe('image');
    const img: MediaAsset = { ...video, type: 'image', src: '/a.jpg', mobile: '/a-m.jpg', priority: 'normal', motionRole: 'product' };
    expect(selectRendition(img, { network: 'fast', reducedMotion: false, device: 'mobile' })).toMatchObject({ src: '/a-m.jpg', loading: 'lazy' });
  });
});

describe('decision engine', () => {
  const orders = Array.from({ length: 4 }, (_, i) => createOrder(details, [makeLine(p('matcha-cloud'), 'Regular', 5)], [], new Date(now.getTime() - i * 86400000)));
  const inventory = applyMovement(initialInventory, 'matcha', -0.1); // 0.02 kg left
  const insights = generateInsights({ orders, inventory, events: [], products, now }).result;
  const outlook = stockOutlook(inventory, orders, now).result;
  const actions = proposeActions(insights, outlook);
  const restock = actions.find((a) => a.kind === 'restock' && a.insightId === 'stock:matcha')!;

  it('proposes a restock that needs approval, with an exact plan', () => {
    expect(restock.level).toBe('APPROVAL_REQUIRED');
    expect(restock.plan).toMatchObject({ type: 'inventory_movement', ingredientId: 'matcha', reason: 'Restock' });
    expect((restock.plan as { delta: number }).delta).toBeGreaterThan(0);
    expect(restock.evidence.length).toBeGreaterThan(0);
  });

  it('never auto-executes anything that changes data', () => {
    expect(Object.values(POLICY).some((p) => p.level === 'EXECUTE')).toBe(false);
    for (const a of actions.filter((x) => x.plan.type !== 'none')) expect(a.level).toBe('APPROVAL_REQUIRED');
  });

  it('applies an approved action once, logging approval and execution', () => {
    const store = memoryDecisionStore();
    const applied: ExecutionPlan[] = [];
    const r = approveAndApply(store, restock, (plan) => applied.push(plan), now);
    expect(r.ok).toBe(true);
    expect(applied).toHaveLength(1);
    expect(store.load().map((x) => x.verdict)).toEqual(['approved', 'executed']);
    expect(approveAndApply(store, restock, (plan) => applied.push(plan), now)).toEqual({ ok: false, reason: 'already applied' });
    expect(applied).toHaveLength(1);
  });

  it('refuses to apply recommendations', () => {
    const store = memoryDecisionStore();
    const rec = { ...restock, level: 'RECOMMEND' as const };
    expect(approveAndApply(store, rec, () => { throw new Error('must not run'); }, now).ok).toBe(false);
    expect(store.load()).toHaveLength(0);
  });

  it('hides rejected actions for a day, then brings them back', () => {
    const store = memoryDecisionStore();
    reject(store, restock, now);
    expect(pending(actions, store, now).map((a) => a.id)).not.toContain(restock.id);
    expect(pending(actions, store, new Date(now.getTime() + 25 * 3600000)).map((a) => a.id)).toContain(restock.id);
  });
});

describe('copilot', () => {
  const data = { orders: seedOrders(now), inventory: initialInventory, events: [createEvent('search_completed', { query: 'eggless', resultCount: 0, zeroResult: true }, { sessionId: 's', at: now })], products, now };
  const ask = (q: string) => askCopilot(q, data).result;

  it('answers sales questions with real numbers', () => {
    const a = ask('How are sales today?');
    expect(a.topic).toBe('sales');
    expect(a.answer).toMatch(/₹[\d,]+ from 6 orders today/);
    expect(a.facts.find((f) => f.label === 'Orders today')?.value).toBe('6');
  });

  it('lists low stock and drafts restocks that still need approval', () => {
    const a = ask("what's running low?");
    expect(a.topic).toBe('stock');
    expect(a.answer).toMatch(/ceremonial matcha/);
    expect(a.actions.length).toBeGreaterThan(0);
    expect(a.actions.every((x) => x.level === 'APPROVAL_REQUIRED' || x.level === 'DRAFT')).toBe(true);
  });

  it('understands a named ingredient, even misspelled', () => {
    expect(ask('how long will the milk last').topic).toBe('forecast');
    expect(ask('tell me about the pistachio paste').topic).toBe('ingredient');
    expect(ask('how much vanila syrup is left').answer).toMatch(/vanilla syrup/i);
  });

  it('prefers a product named in full over the ingredient inside it', () => {
    const a = ask('how is the dark chocolate brownie doing');
    expect(a.topic).toBe('product');
    expect(a.answer).toMatch(/Dark Chocolate Brownie: 2 sold today/);
  });

  it('does not mistake the bakery name for the Tresor Latte', () => {
    expect(ask('how is tresor doing today').topic).not.toBe('product');
  });

  it('reports search gaps, orders and best sellers', () => {
    expect(ask('what did people search for and not find').answer).toMatch(/eggless/);
    expect(ask('which orders are in the kitchen').answer).toMatch(/in the kitchen/);
    expect(ask('what is selling best').topic).toBe('best_sellers');
  });

  it('gives priorities for an empty or open question, and help when lost', () => {
    expect(ask('').topic).toBe('priorities');
    expect(ask('what needs my attention').topic).toBe('priorities');
    const help = askCopilot('sing me a song', data);
    expect(help.result.topic).toBe('help');
    expect(help.fallbackUsed).toBe(true);
    expect(help.result.followUps.length).toBeGreaterThan(0);
  });
});
