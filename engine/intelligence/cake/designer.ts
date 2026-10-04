// Cake designer intelligence: pairing suggestions, style presets and "surprise me".
// Every suggestion is built only from real, available catalogue options, is checked
// against the compatibility rules before it is offered, and carries its reasons.
// Nothing is applied without the customer choosing it.

import * as C from '@/lib/cake/config';
import { find, optionState, price, validate, type CakeContext } from '@/lib/cake/engine';
import type { CakeConfiguration, OptionGroupId } from '@/lib/cake/types';
import { runOperation, type Evidence, type IntelligenceResult } from '../core/contract';
import { parseIntent } from '../intent/intent';

export const DESIGNER_VERSION = 'cake-designer-v1';

/** A change the customer can accept with one tap. */
export type Patch =
  | { op: 'set'; group: Exclude<OptionGroupId, 'toppings' | 'decorations' | 'topper' | 'candles' | 'print'>; id: string }
  | { op: 'add-topping'; id: string; qty: number }
  | { op: 'add-decoration'; id: string }
  | { op: 'set-topper'; id: string }
  | { op: 'set-candles'; id: string }
  | { op: 'message-font'; id: string };

export type Suggestion = { id: string; line: string; action: string; patches: Patch[]; evidence: Evidence[] };

export function applyPatches(c: CakeConfiguration, patches: Patch[]): CakeConfiguration {
  let next = c;
  for (const p of patches) {
    if (p.op === 'set') next = { ...next, [p.group]: p.id };
    if (p.op === 'add-topping' && !next.toppings.some((t) => t.id === p.id)) next = { ...next, toppings: [...next.toppings, { id: p.id, qty: p.qty }] };
    if (p.op === 'add-decoration' && !next.decorations.includes(p.id)) next = { ...next, decorations: [...next.decorations, p.id] };
    if (p.op === 'set-topper') next = { ...next, topper: { ...next.topper, id: p.id } };
    if (p.op === 'set-candles') next = { ...next, candles: { ...next.candles, id: p.id } };
    if (p.op === 'message-font') next = { ...next, message: { ...next.message, font: p.id } };
  }
  return next;
}

const groupOf = (p: Patch): OptionGroupId | null =>
  p.op === 'set' ? p.group : p.op === 'add-topping' ? 'toppings' : p.op === 'add-decoration' ? 'decorations' : p.op === 'set-topper' ? 'topper' : p.op === 'set-candles' ? 'candles' : null;

/** A patch is offerable only if every option in it can be chosen right now. */
function allowed(c: CakeConfiguration, patches: Patch[], ctx: CakeContext): boolean {
  let probe = c;
  for (const p of patches) {
    const g = groupOf(p);
    if (g && 'id' in p && optionState(probe, g, p.id, ctx).disabled) return false;
    probe = applyPatches(probe, [p]);
  }
  return true;
}

type Pairing = { id: string; when: (c: CakeConfiguration) => boolean; patches: Patch[]; line: string; action: string };

/** Flavour knowledge, as data. */
const PAIRINGS: Pairing[] = [
  { id: 'choc-hazelnut-ganache', when: (c) => c.sponge === 'chocolate' && c.filling === 'hazelnut' && c.frosting !== 'ganache', patches: [{ op: 'set', group: 'frosting', id: 'ganache' }], line: 'These pair well with a dark chocolate finish.', action: 'Use ganache' },
  { id: 'hazelnut-topping', when: (c) => c.filling === 'hazelnut' && !c.toppings.some((t) => t.id === 'hazelnuts'), patches: [{ op: 'add-topping', id: 'hazelnuts', qty: 4 }], line: 'Add roasted hazelnuts on top, to echo the praline inside?', action: 'Add hazelnuts' },
  { id: 'pistachio-topping', when: (c) => c.sponge === 'pistachio' && !c.toppings.some((t) => t.id === 'pistachios'), patches: [{ op: 'add-topping', id: 'pistachios', qty: 4 }], line: 'Crushed pistachio on top tells people what’s inside.', action: 'Add pistachio' },
  { id: 'berry-topping', when: (c) => c.filling === 'berry' && !c.toppings.some((t) => t.id === 'berries'), patches: [{ op: 'add-topping', id: 'berries', qty: 6 }], line: 'Fresh berries on top echo the compote inside.', action: 'Add berries' },
  { id: 'red-velvet-cream-cheese', when: (c) => c.sponge === 'red-velvet' && c.frosting !== 'cream-cheese', patches: [{ op: 'set', group: 'frosting', id: 'cream-cheese' }], line: 'Red velvet is classically finished with cream cheese frosting.', action: 'Use cream cheese' },
  { id: 'coffee-caramel', when: (c) => c.sponge === 'coffee' && c.filling !== 'salted-caramel', patches: [{ op: 'set', group: 'filling', id: 'salted-caramel' }], line: 'Coffee and salted caramel are a quiet classic.', action: 'Try salted caramel' },
  { id: 'chocolate-gold', when: (c) => c.color === 'chocolate' && !c.decorations.includes('gold-leaf') && !c.toppings.some((t) => t.id === 'gold'), patches: [{ op: 'add-topping', id: 'gold', qty: 2 }], line: 'A little gold lifts a dark cake for an occasion.', action: 'Add gold flakes' },
  { id: 'birthday-candles', when: (c) => /birthday|bday/i.test(c.message.text) && c.candles.id === 'none', patches: [{ op: 'set-candles', id: 'thin' }], line: 'It’s a birthday: add candles?', action: 'Add candles' },
  { id: 'anniversary-flowers', when: (c) => /anniversary|love/i.test(c.message.text) && !c.toppings.some((t) => t.id === 'flowers'), patches: [{ op: 'add-topping', id: 'flowers', qty: 4 }], line: 'Edible flowers suit an anniversary message.', action: 'Add flowers' },
  { id: 'script-for-names', when: (c) => c.message.text.trim().length > 0 && c.message.font === 'sans' && /birthday|anniversary|congrat/i.test(c.message.text), patches: [{ op: 'message-font', id: 'script' }], line: 'Celebration messages read beautifully in script.', action: 'Use script' },
];

type CustomOrderLine = { custom?: { config: CakeConfiguration } };
type OrderLike = { status: string; items: CustomOrderLine[] };

/** How often each sponge+filling pairing appears in past custom cake orders. */
export function comboCounts(orders: OrderLike[] = []): Map<string, number> {
  const counts = new Map<string, number>();
  for (const o of orders) {
    if (o.status === 'CANCELLED') continue;
    for (const l of o.items) if (l.custom) { const k = `${l.custom.config.sponge}+${l.custom.config.filling}`; counts.set(k, (counts.get(k) ?? 0) + 1); }
  }
  return counts;
}

/** Up to `limit` suggestions for the current design. Never more than one per area. */
export function suggest(c: CakeConfiguration, opts: { ctx?: CakeContext; orders?: OrderLike[]; dismissed?: string[]; limit?: number } = {}): IntelligenceResult<Suggestion[]> {
  return runOperation('cake.suggest', () => {
    const ctx = opts.ctx ?? {};
    const dismissed = new Set(opts.dismissed ?? []);
    const out: Suggestion[] = [];
    for (const p of PAIRINGS) {
      if (dismissed.has(p.id) || !p.when(c) || !allowed(c, p.patches, ctx)) continue;
      out.push({ id: p.id, line: p.line, action: p.action, patches: p.patches, evidence: [{ kind: 'rule', label: 'Pairing', value: p.id, source: DESIGNER_VERSION }] });
    }
    // What other customers paired with this sponge, from real orders.
    const counts = comboCounts(opts.orders);
    const best = [...counts.entries()].filter(([k]) => k.startsWith(`${c.sponge}+`) && !k.endsWith(`+${c.filling}`)).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= 2 && !dismissed.has('popular-filling')) {
      const filling = best[0].split('+')[1];
      const patches: Patch[] = [{ op: 'set', group: 'filling', id: filling }];
      if (allowed(c, patches, ctx)) out.push({ id: 'popular-filling', line: `Customers often pair this sponge with ${find('filling', filling)?.name.toLowerCase()}.`, action: 'Try it', patches, evidence: [{ kind: 'metric', label: 'Custom orders with this pairing', value: best[1] }] });
    }
    const list = out.slice(0, opts.limit ?? 2);
    return { result: list, confidence: list.length ? 0.75 : 1, evidence: [{ kind: 'data', label: 'Pairings checked', value: PAIRINGS.length }], provider: 'rules', providerKind: 'deterministic', modelVersion: DESIGNER_VERSION, rankingVersion: null, fallbackUsed: false, warnings: [] };
  });
}

// ---------- Style presets ----------

export type StyleId = 'elegant' | 'minimal' | 'birthday' | 'anniversary' | 'chocolate' | 'festive' | 'kids' | 'luxury';

export const STYLES: { id: StyleId; name: string; line: string; patches: Patch[] }[] = [
  { id: 'elegant', name: 'Elegant', line: 'Cream, dark chocolate details, a touch of gold, a serif message.', patches: [{ op: 'set', group: 'color', id: 'cream' }, { op: 'set', group: 'finish', id: 'smooth' }, { op: 'add-decoration', id: 'piped-border' }, { op: 'add-topping', id: 'gold', qty: 2 }, { op: 'add-topping', id: 'curls', qty: 3 }, { op: 'message-font', id: 'serif' }] },
  { id: 'minimal', name: 'Minimal', line: 'One colour, a clean finish, nothing extra.', patches: [{ op: 'set', group: 'finish', id: 'smooth' }, { op: 'set', group: 'color', id: 'vanilla' }, { op: 'message-font', id: 'sans' }] },
  { id: 'birthday', name: 'Birthday', line: 'Colour, candles and room for a message.', patches: [{ op: 'set', group: 'color', id: 'blush' }, { op: 'add-topping', id: 'macarons', qty: 3 }, { op: 'add-decoration', id: 'pearls' }, { op: 'set-candles', id: 'thin' }, { op: 'message-font', id: 'script' }] },
  { id: 'anniversary', name: 'Anniversary', line: 'Berry and blush, flowers, a script message.', patches: [{ op: 'set', group: 'filling', id: 'berry' }, { op: 'set', group: 'color', id: 'blush' }, { op: 'set', group: 'finish', id: 'ruffled' }, { op: 'add-topping', id: 'flowers', qty: 5 }, { op: 'message-font', id: 'script' }] },
  { id: 'chocolate', name: 'Chocolate lover', line: 'Chocolate through and through.', patches: [{ op: 'set', group: 'sponge', id: 'chocolate' }, { op: 'set', group: 'filling', id: 'ganache' }, { op: 'set', group: 'frosting', id: 'ganache' }, { op: 'set', group: 'color', id: 'chocolate' }, { op: 'add-topping', id: 'curls', qty: 6 }, { op: 'add-decoration', id: 'shards' }] },
  { id: 'festive', name: 'Festive', line: 'Drip, gold and something to light.', patches: [{ op: 'add-decoration', id: 'drip' }, { op: 'add-topping', id: 'gold', qty: 3 }, { op: 'add-topping', id: 'berries', qty: 5 }, { op: 'set-candles', id: 'sparkler' }] },
  { id: 'kids', name: 'Kids', line: 'Soft colours, cookies, a number on top.', patches: [{ op: 'set', group: 'color', id: 'pistachio' }, { op: 'add-topping', id: 'cookies', qty: 4 }, { op: 'add-topping', id: 'macarons', qty: 3 }, { op: 'set-topper', id: 'number' }, { op: 'message-font', id: 'sans' }] },
  { id: 'luxury', name: 'Luxury', line: 'Ganache, gold leaf, pearls, a gift box.', patches: [{ op: 'set', group: 'frosting', id: 'ganache' }, { op: 'set', group: 'color', id: 'chocolate' }, { op: 'add-decoration', id: 'gold-leaf' }, { op: 'add-decoration', id: 'pearls' }, { op: 'set', group: 'packaging', id: 'gift' }] },
];

/** Applies a style, skipping (and naming) any part the current cake can't take. The customer can still change anything. */
export function applyStyle(c: CakeConfiguration, style: StyleId, ctx: CakeContext = {}): { config: CakeConfiguration; skipped: string[] } {
  const preset = STYLES.find((s) => s.id === style);
  if (!preset) return { config: c, skipped: [] };
  let next = c;
  const skipped: string[] = [];
  for (const p of preset.patches) {
    const g = groupOf(p);
    const state = g && 'id' in p ? optionState(next, g, p.id, ctx) : { disabled: false, reason: null };
    if (state.disabled) { skipped.push(state.reason ?? 'not available'); continue; }
    next = applyPatches(next, [p]);
  }
  return { config: next, skipped };
}

// ---------- Surprise me ----------

/** Small seeded generator, so a surprise can be reproduced and "regenerate" is just a new seed. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

export type SurpriseRequest = { text?: string; style?: StyleId; budget?: number | null; avoidNuts?: boolean; seed?: number };

const OCCASION_STYLE: Record<string, StyleId> = { birthday: 'birthday', anniversary: 'anniversary', celebration: 'festive', gift: 'luxury', 'dinner party': 'elegant' };

/**
 * Generates a valid cake from the catalogue for an occasion, budget and diet. It keeps the
 * customer's message and photo. Returns nothing (with a reason) rather than inventing options.
 */
export function surprise(base: CakeConfiguration, req: SurpriseRequest, ctx: CakeContext = {}): IntelligenceResult<{ config: CakeConfiguration; style: StyleId; total: number } | null> {
  return runOperation('cake.surprise', () => {
    const intent = req.text ? parseIntent(req.text) : null;
    const budget = req.budget ?? intent?.priceMax ?? null;
    const avoidNuts = req.avoidNuts ?? intent?.excludeNuts ?? false;
    const wantsChocolate = intent?.flavours.includes('chocolate') ?? false;
    const style: StyleId = req.style ?? (intent?.occasions.map((o) => OCCASION_STYLE[o]).find(Boolean)) ?? (/\belegant|classy|simple\b/.test(intent?.normalized ?? '') ? 'elegant' : /\bluxur|premium|fancy\b/.test(intent?.normalized ?? '') ? 'luxury' : /\bkid|child\b/.test(intent?.normalized ?? '') ? 'kids' : wantsChocolate ? 'chocolate' : 'elegant');
    const random = rng(req.seed ?? Date.now());
    const pickFrom = <T extends { id: string; allergens?: string[] }>(list: T[], group: OptionGroupId, c: CakeConfiguration) => {
      const ok = list.filter((o) => !optionState(c, group, o.id, ctx).disabled && !(avoidNuts && o.allergens?.includes('nuts')));
      return ok.length ? ok[Math.floor(random() * ok.length)] : null;
    };
    let best: { config: CakeConfiguration; total: number; score: number } | null = null;
    for (let i = 0; i < 80; i += 1) {
      let c: CakeConfiguration = { ...base, toppings: [], decorations: [], topper: { id: 'none', text: '' }, candles: { id: 'none', text: '' } };
      for (const [group, list] of [['sponge', C.sponges], ['filling', C.fillings], ['frosting', C.frostings], ['finish', C.finishes], ['color', C.colors]] as const) {
        const o = pickFrom(list as unknown as { id: string; allergens?: string[] }[], group, c);
        if (o) c = { ...c, [group]: o.id };
      }
      if (wantsChocolate) c = applyPatches(c, [{ op: 'set', group: 'sponge', id: 'chocolate' }]);
      c = applyStyle(c, style, ctx).config;
      if (avoidNuts) c = { ...c, toppings: c.toppings.filter((t) => !find('toppings', t.id)?.allergens?.includes('nuts')) };
      // Shrink the cake until it fits the budget.
      // Keep the customer's size when it fits; otherwise step down until it does.
      const baseInches = find('size', base.size)?.inches ?? 6;
      const sizes = budget === null ? [base.size] : [base.size, ...C.sizes.filter((x) => x.inches < baseInches).map((x) => x.id).reverse()];
      for (const size of sizes) {
        const sized = { ...c, size };
        if (optionState(sized, 'size', sized.size, ctx).disabled) continue;
        const total = price(sized).total;
        if (budget !== null && total > budget) continue;
        if (validate(sized, ctx).some((x) => x.level === 'error' && x.field !== 'message' && x.field !== 'print' && x.field !== 'topper')) continue;
        const pairs = PAIRINGS.filter((p) => !p.when(sized)).length; // fewer open suggestions = better-matched cake
        const score = pairs + (budget ? total / budget : 0) + random() * 0.5;
        if (!best || score > best.score) best = { config: sized, total, score };
        break;
      }
    }
    const evidence: Evidence[] = [{ kind: 'rule', label: 'Style', value: style }, ...(budget ? [{ kind: 'business' as const, label: 'Budget', value: `₹${budget}` }] : []), ...(avoidNuts ? [{ kind: 'rule' as const, label: 'Diet', value: 'no nuts' }] : [])];
    return {
      result: best ? { config: best.config, style, total: best.total } : null,
      confidence: best ? 0.7 : 0,
      evidence,
      provider: 'rules', providerKind: 'deterministic', modelVersion: DESIGNER_VERSION, rankingVersion: null,
      fallbackUsed: !best,
      warnings: best ? [] : [budget ? `Nothing on the menu fits ₹${budget}. The smallest cake starts at ₹${C.sizes[0].price}.` : 'No valid cake could be made from what’s available.'],
    };
  });
}
