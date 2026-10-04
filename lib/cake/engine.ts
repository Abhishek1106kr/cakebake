// Cake Playground rules: availability, compatibility, validation, pricing,
// production time, slots, summaries and share codes. Pure functions over the
// configuration. This module is the single authority: the cart and checkout
// re-price custom cakes from their configuration and never trust a stored price.

import type { Ingredient } from '@/lib/inventory';
import * as C from './config';
import type { CakeConfiguration, CompatibilityRule, Issue, OptionBase, OptionGroupId, RuleScope, ShapeOption, SizeOption } from './types';

export type CakeContext = { inventory?: Ingredient[]; month?: number };

// ---------- Catalogue access ----------

const GROUPS = {
  size: C.sizes, shape: C.shapes, sponge: C.sponges, filling: C.fillings, frosting: C.frostings, finish: C.finishes, color: C.colors,
  toppings: C.toppings, decorations: C.decorations, topper: C.toppers, candles: C.candles, packaging: C.packaging,
} as const;
type CatalogueGroup = keyof typeof GROUPS;

export function options<G extends CatalogueGroup>(group: G): (typeof GROUPS)[G] { return GROUPS[group]; }
export function find<G extends CatalogueGroup>(group: G, id: string): (typeof GROUPS)[G][number] | undefined {
  return (GROUPS[group] as readonly OptionBase[]).find((o) => o.id === id) as (typeof GROUPS)[G][number] | undefined;
}
export const sizeOf = (c: CakeConfiguration) => find('size', c.size) as SizeOption;
export const shapeOf = (c: CakeConfiguration) => find('shape', c.shape) as ShapeOption;

export function defaultConfig(): CakeConfiguration {
  return {
    version: 1, size: '6in', shape: 'round', sponge: 'vanilla', filling: 'vanilla-cream', frosting: 'buttercream', finish: 'smooth', color: 'cream',
    toppings: [], decorations: [], topper: { id: 'none', text: '' }, candles: { id: 'none', text: '' }, packaging: 'standard',
    message: { text: '', font: 'serif', color: '#2B1D16', size: 0.1, align: 'center', y: 0.5, rotation: 0 },
    print: { enabled: false, assetId: null, sourceWidth: 0, sourceHeight: 0, x: 0.5, y: 0.5, scale: 0.7, rotation: 0 },
    notes: '',
  };
}

// ---------- Availability ----------

export type Availability = { ok: true } | { ok: false; reason: string };

export function availability(option: OptionBase, ctx: CakeContext = {}): Availability {
  if (!option.available) return { ok: false, reason: 'Currently unavailable' };
  if (option.seasonMonths && ctx.month && !option.seasonMonths.includes(ctx.month)) return { ok: false, reason: option.note ?? 'Out of season' };
  if (option.ingredients && ctx.inventory) {
    for (const [ingredient, need] of Object.entries(option.ingredients)) {
      const have = ctx.inventory.find((i) => i.id === ingredient)?.onHand ?? Infinity;
      if (have < need) return { ok: false, reason: 'Sold out for today' };
    }
  }
  return { ok: true };
}

// ---------- Compatibility ----------

function scopeMatches(scope: RuleScope, c: CakeConfiguration): boolean {
  return Object.entries(scope).every(([key, value]) => {
    if (key === 'print') return c.print.enabled === value;
    const ids = value as string[];
    if (key === 'topping') return c.toppings.some((t) => ids.includes(t.id));
    if (key === 'decoration') return c.decorations.some((d) => ids.includes(d));
    if (key === 'topper') return ids.includes(c.topper.id);
    if (key === 'candles') return ids.includes(c.candles.id);
    return ids.includes(String(c[key as keyof CakeConfiguration]));
  });
}

export function violations(c: CakeConfiguration, rules: CompatibilityRule[] = C.rules): CompatibilityRule[] {
  return rules.filter((r) => scopeMatches(r.when, c) && scopeMatches(r.block, c));
}

const SCOPE_KEY: Partial<Record<OptionGroupId, keyof RuleScope>> = { toppings: 'topping', decorations: 'decoration', topper: 'topper', candles: 'candles', print: 'print' };

function mentions(scope: RuleScope, group: OptionGroupId, id: string): boolean {
  const key = SCOPE_KEY[group] ?? (group as keyof RuleScope);
  const v = scope[key];
  if (key === 'print') return v === true;
  return Array.isArray(v) && v.includes(id);
}

/** What the configuration would look like with one option chosen (or toggled on). */
export function withOption(c: CakeConfiguration, group: OptionGroupId, id: string): CakeConfiguration {
  switch (group) {
    case 'toppings': return c.toppings.some((t) => t.id === id) ? c : { ...c, toppings: [...c.toppings, { id, qty: 1 }] };
    case 'decorations': return c.decorations.includes(id) ? c : { ...c, decorations: [...c.decorations, id] };
    case 'topper': return { ...c, topper: { ...c.topper, id } };
    case 'candles': return { ...c, candles: { ...c.candles, id } };
    case 'print': return { ...c, print: { ...c.print, enabled: true } };
    default: return { ...c, [group]: id };
  }
}

export type OptionState = { disabled: boolean; reason: string | null };

/** Whether an option can be chosen now, and why not. Considers stock, season and every rule. */
export function optionState(c: CakeConfiguration, group: OptionGroupId, id: string, ctx: CakeContext = {}): OptionState {
  if (group !== 'print') {
    const option = find(group as CatalogueGroup, id);
    if (!option) return { disabled: true, reason: 'Not on the menu' };
    const a = availability(option, ctx);
    if (!a.ok) return { disabled: true, reason: a.reason };
  }
  const clash = violations(withOption(c, group, id)).find((r) => mentions(r.when, group, id) || mentions(r.block, group, id));
  return clash ? { disabled: true, reason: clash.reason } : { disabled: false, reason: null };
}

// ---------- Printable area, message fit, print placement ----------

/** Printable area on the cake top, in cm, and its outline kind. */
export function printableArea(c: CakeConfiguration) {
  const size = sizeOf(c);
  const shape = shapeOf(c);
  const inset = 1 - 2 * C.printRules.printableInset;
  const width = size.diameterCm * inset * (shape.kind === 'rectangle' ? 1.4 : 1);
  const height = size.diameterCm * inset * (shape.kind === 'rectangle' ? 0.95 : 1);
  return { kind: shape.kind, widthCm: Math.round(width * 10) / 10, heightCm: Math.round(height * 10) / 10 };
}

/** Width of the printable outline (share of its box) at a vertical position 0–1. */
function chordAt(kind: ShapeOption['kind'], y: number): number {
  const dy = Math.abs(y - 0.5);
  if (kind === 'round') return 2 * Math.sqrt(Math.max(0, 0.25 - dy * dy));
  if (kind === 'heart') return y < 0.3 ? 0.55 : 2 * Math.sqrt(Math.max(0, 0.2 - (y - 0.45) ** 2)) * 0.95;
  return 1;
}

/** Is a normalized point inside the printable outline? */
export function insidePrintable(kind: ShapeOption['kind'], x: number, y: number): boolean {
  if (kind === 'round') return (x - 0.5) ** 2 + (y - 0.5) ** 2 <= 0.25 + 1e-9;
  if (kind === 'heart') {
    // Heart approximated by two lobes and a lower triangle.
    const lobe = (cx: number) => (x - cx) ** 2 + (y - 0.32) ** 2 <= 0.26 ** 2;
    const tri = y >= 0.32 && y <= 0.98 && Math.abs(x - 0.5) <= 0.5 * (0.98 - y) / 0.66 + 1e-9;
    return lobe(0.27) || lobe(0.73) || tri;
  }
  return x >= -1e-9 && x <= 1 + 1e-9 && y >= -1e-9 && y <= 1 + 1e-9;
}

export function messageLines(text: string): string[] {
  return text.split('\n').map((l) => l.trimEnd()).filter((l, i, all) => l.length > 0 || i < all.length - 1);
}

export type MessageFit = { maxChars: number; maxLines: number; chars: number; lines: number; overLength: boolean; overLines: boolean; overflow: boolean; fitChars: number };

/** Whether the message fits: character and line limits for the size, and the width of the printable outline. */
export function messageFit(c: CakeConfiguration): MessageFit {
  const limits = C.messageLimits[c.size] ?? { maxChars: 24, maxLines: 2 };
  const font = C.fonts.find((f) => f.id === c.message.font) ?? C.fonts[0];
  const lines = messageLines(c.message.text);
  const chars = lines.join('').length;
  const kind = shapeOf(c).kind;
  const lineH = c.message.size * font.lineHeight;
  const block = lineH * lines.length;
  let overflow = false;
  let fitChars = limits.maxChars;
  lines.forEach((line, i) => {
    const y = c.message.y - block / 2 + lineH * (i + 0.5);
    const available = Math.min(chordAt(kind, Math.max(0, Math.min(1, y - lineH / 2))), chordAt(kind, Math.max(0, Math.min(1, y + lineH / 2)))) * 0.92;
    const width = line.length * c.message.size * font.widthFactor;
    if (width > available || y - lineH / 2 < 0 || y + lineH / 2 > 1) overflow = true;
    fitChars = Math.min(fitChars, Math.floor(available / (c.message.size * font.widthFactor)) * Math.max(1, lines.length));
  });
  return { maxChars: limits.maxChars, maxLines: limits.maxLines, chars, lines: lines.length, overLength: chars > limits.maxChars, overLines: lines.length > limits.maxLines, overflow, fitChars: Math.max(4, fitChars) };
}

/** The largest scale at which the photo sits wholly inside the printable outline (for "Fit"). */
export function fitScale(c: CakeConfiguration, sourceWidth = c.print.sourceWidth, sourceHeight = c.print.sourceHeight): number {
  const area = printableArea(c);
  const a = sourceWidth && sourceHeight ? (sourceHeight / sourceWidth) * (area.widthCm / area.heightCm) : 1;
  const kind = shapeOf(c).kind;
  // Round: the photo's diagonal must fit the circle. Heart: the same, within its smaller lobe-to-point circle.
  if (kind === 'round') return Math.round((0.98 / Math.sqrt(1 + a * a)) * 1000) / 1000;
  if (kind === 'heart') return fitPlacement(c, sourceWidth, sourceHeight).scale;
  return Math.round(Math.min(0.98, 0.98 / a) * 1000) / 1000;
}

/** Scale and centre for "Fit". Hearts are narrow at the point, so the photo sits a little higher. */
export function fitPlacement(c: CakeConfiguration, sourceWidth = c.print.sourceWidth, sourceHeight = c.print.sourceHeight): { scale: number; x: number; y: number } {
  if (shapeOf(c).kind !== 'heart') return { scale: fitScale(c, sourceWidth, sourceHeight), x: 0.5, y: 0.5 };
  for (const y of [0.42, 0.45, 0.4, 0.48]) {
    for (let s = 0.9; s >= 0.2; s -= 0.01) {
      const probe = { ...c, print: { ...c.print, sourceWidth, sourceHeight, x: 0.5, y, scale: s, rotation: 0 } };
      if (printCorners(probe).every(([px, py]) => insidePrintable('heart', px, py))) return { scale: Math.round(s * 1000) / 1000, x: 0.5, y };
    }
  }
  return { scale: 0.3, x: 0.5, y: 0.45 };
}

/** Corners of the placed image (normalized to the printable box). */
export function printCorners(c: CakeConfiguration): [number, number][] {
  const { x, y, scale, rotation, sourceWidth, sourceHeight } = c.print;
  const area = printableArea(c);
  const aspect = sourceWidth && sourceHeight ? sourceHeight / sourceWidth : 1;
  const w = scale / 2;
  const h = (scale * aspect * (area.widthCm / area.heightCm)) / 2;
  const r = (rotation * Math.PI) / 180;
  return ([[-w, -h], [w, -h], [w, h], [-w, h]] as [number, number][]).map(([dx, dy]) => [x + dx * Math.cos(r) - dy * Math.sin(r), y + dx * Math.sin(r) + dy * Math.cos(r)]);
}

export type PrintCheck = { inside: boolean; dotsPerCm: number | null; printedWidthCm: number };

export function printCheck(c: CakeConfiguration): PrintCheck {
  const kind = shapeOf(c).kind;
  const area = printableArea(c);
  const printedWidthCm = Math.round(c.print.scale * area.widthCm * 10) / 10;
  return {
    inside: printCorners(c).every(([px, py]) => insidePrintable(kind, px, py)),
    dotsPerCm: c.print.sourceWidth ? Math.round(c.print.sourceWidth / Math.max(0.1, printedWidthCm)) : null,
    printedWidthCm,
  };
}

// ---------- Validation ----------

const LABEL: Record<CatalogueGroup, string> = { size: 'size', shape: 'shape', sponge: 'sponge', filling: 'filling', frosting: 'frosting', finish: 'finish', color: 'colour', toppings: 'topping', decorations: 'decoration', topper: 'topper', candles: 'candles', packaging: 'packaging' };

export function validate(c: CakeConfiguration, ctx: CakeContext = {}): Issue[] {
  const issues: Issue[] = [];
  const single: CatalogueGroup[] = ['size', 'shape', 'sponge', 'filling', 'frosting', 'finish', 'color', 'packaging'];
  for (const g of single) {
    const option = find(g, c[g as keyof CakeConfiguration] as string);
    if (!option) { issues.push({ field: g, level: 'error', message: `Choose a ${LABEL[g]}.` }); continue; }
    const a = availability(option, ctx);
    if (!a.ok) issues.push({ field: g, level: 'error', message: `${option.name}: ${a.reason.toLowerCase()}. Please choose another ${LABEL[g]}.` });
  }
  for (const t of c.toppings) {
    const option = find('toppings', t.id);
    if (!option) { issues.push({ field: 'toppings', level: 'error', message: 'A topping is no longer on the menu.' }); continue; }
    const a = availability(option, ctx);
    if (!a.ok) issues.push({ field: 'toppings', level: 'error', message: `${option.name}: ${a.reason.toLowerCase()}.` });
    if (t.qty < 1 || t.qty > option.maxQuantity) issues.push({ field: 'toppings', level: 'error', message: `${option.name} comes in 1 to ${option.maxQuantity} portions.` });
    if (option.compatibleShapes && !option.compatibleShapes.includes(shapeOf(c)?.kind)) issues.push({ field: 'toppings', level: 'error', message: `${option.name} doesn’t suit this shape.` });
  }
  for (const d of c.decorations) if (!find('decorations', d)) issues.push({ field: 'decorations', level: 'error', message: 'A decoration is no longer on the menu.' });
  for (const r of violations(c)) issues.push({ field: r.block.print ? 'print' : (Object.keys(r.block)[0] as Issue['field']), level: 'error', message: r.reason, ruleId: r.id });

  const topper = find('topper', c.topper.id) as import('./types').TopperOption | undefined;
  if (topper?.needsText && !c.topper.text.trim()) issues.push({ field: 'topper', level: 'error', message: `Tell us what the ${topper.name.toLowerCase()} topper should say.` });
  if (topper?.maxChars && c.topper.text.length > topper.maxChars) issues.push({ field: 'topper', level: 'error', message: `Toppers fit up to ${topper.maxChars} characters.` });
  if (c.candles.id === 'number' && !/^\d{1,3}$/.test(c.candles.text.trim())) issues.push({ field: 'candles', level: 'error', message: 'Add the number for the candles (up to 3 digits).' });

  if (c.message.text.trim()) {
    const fit = messageFit(c);
    if (fit.overLength) issues.push({ field: 'message', level: 'error', message: `Your message is too long for ${/^8/.test(sizeOf(c).name) ? 'an' : 'a'} ${sizeOf(c).name} cake. Try shortening it to ${fit.maxChars} characters.` });
    else if (fit.overLines) issues.push({ field: 'message', level: 'error', message: `${/^8/.test(sizeOf(c).name) ? 'An' : 'A'} ${sizeOf(c).name} cake fits ${fit.maxLines} line${fit.maxLines === 1 ? '' : 's'} of message.` });
    else if (fit.overflow) issues.push({ field: 'message', level: 'warning', message: `Your message runs past the printable edge. Try a smaller size or about ${fit.fitChars} characters.` });
  }

  if (c.print.enabled) {
    if (!c.print.assetId) issues.push({ field: 'print', level: 'error', message: 'Upload a photo for the edible print, or turn the print off.' });
    else {
      const check = printCheck(c);
      if (!check.inside) issues.push({ field: 'print', level: 'warning', message: 'Part of your photo falls outside the printable area and won’t print. Try zooming out or moving it in.' });
      if (check.dotsPerCm !== null && check.dotsPerCm < C.printRules.minDotsPerCm) issues.push({ field: 'print', level: 'warning', message: 'Your photo may print soft at this size. Try a smaller placement or a sharper photo.' });
    }
  }
  if (c.notes.length > 300) issues.push({ field: 'notes', level: 'error', message: 'Notes for the baker fit up to 300 characters.' });
  return issues;
}

export const hasErrors = (issues: Issue[]) => issues.some((i) => i.level === 'error');

// ---------- Pricing and production ----------

export type PriceLine = { label: string; amount: number };
export type PriceBreakdown = { lines: PriceLine[]; total: number; version: string };

export function price(c: CakeConfiguration): PriceBreakdown {
  const lines: PriceLine[] = [];
  const add = (label: string, amount: number) => { if (amount) lines.push({ label, amount }); };
  const size = sizeOf(c);
  lines.push({ label: `${size?.name ?? 'Cake'} base`, amount: size?.price ?? 0 });
  add(`${shapeOf(c)?.name} shape`, shapeOf(c)?.price ?? 0);
  for (const g of ['sponge', 'filling', 'frosting', 'finish', 'color', 'packaging'] as const) {
    const o = find(g, c[g]);
    if (o) add(o.name, o.price);
  }
  for (const t of c.toppings) {
    const o = find('toppings', t.id);
    if (o) add(`${o.name} × ${t.qty}`, o.perUnit * t.qty + o.price);
  }
  for (const d of c.decorations) { const o = find('decorations', d); if (o) add(o.name, o.price); }
  const topper = find('topper', c.topper.id); if (topper) add(`Topper: ${topper.name}`, topper.price);
  const candle = find('candles', c.candles.id); if (candle) add(candle.name, candle.price);
  if (c.print.enabled) add('Edible photo print', C.printRules.price);
  return { lines, total: lines.reduce((s, l) => s + l.amount, 0), version: C.CAKE_CONFIG_VERSION };
}

export function productionHours(c: CakeConfiguration): number {
  let h = C.BASE_PRODUCTION_HOURS;
  for (const g of ['size', 'shape', 'sponge', 'filling', 'frosting', 'finish'] as const) h += find(g, c[g])?.productionHours ?? 0;
  h += find('topper', c.topper.id)?.productionHours ?? 0;
  if (c.print.enabled) h += C.printRules.productionHours;
  return h;
}

export const SLOT_WINDOWS: [number, number][] = [[10, 12], [14, 16], [18, 20]];

/** Delivery or pickup slots no earlier than `hours` from now. Labels are local time. */
export function slotsAfter(now: Date, hours: number, count = 6): { id: string; label: string; start: Date }[] {
  const earliest = new Date(now.getTime() + hours * 3600000);
  const out: { id: string; label: string; start: Date }[] = [];
  const day = new Date(earliest); day.setHours(0, 0, 0, 0);
  for (let d = 0; out.length < count && d < 14; d += 1) {
    for (const [from, to] of SLOT_WINDOWS) {
      const start = new Date(day); start.setDate(day.getDate() + d); start.setHours(from, 0, 0, 0);
      if (start < earliest) continue;
      const label = `${start.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · ${String(from).padStart(2, '0')}:00–${to}:00`;
      out.push({ id: start.toISOString(), label, start });
      if (out.length >= count) break;
    }
  }
  return out;
}

/** Ingredients a configuration uses (inventory ids), so custom cakes draw on real stock. Scaled by size. */
export function ingredientsFor(c: CakeConfiguration): Record<string, number> {
  const scale = ((sizeOf(c)?.inches ?? 6) / 6) ** 2;
  const out: Record<string, number> = {};
  const add = (o: OptionBase | undefined, mult = 1) => { for (const [k, v] of Object.entries(o?.ingredients ?? {})) out[k] = Math.round(((out[k] ?? 0) + v * scale * mult) * 1000) / 1000; };
  for (const g of ['sponge', 'filling', 'frosting'] as const) add(find(g, c[g]));
  for (const t of c.toppings) add(find('toppings', t.id), t.qty);
  return out;
}

// ---------- Summary, identity, sharing ----------

export function summary(c: CakeConfiguration): { title: string; lines: string[] } {
  const sponge = find('sponge', c.sponge);
  const lines = [
    `${sizeOf(c)?.name} ${shapeOf(c)?.name.toLowerCase()} · serves ${sizeOf(c)?.servings}`,
    `${sponge?.name} sponge, ${find('filling', c.filling)?.name.toLowerCase()} filling`,
    `${find('frosting', c.frosting)?.name} · ${find('finish', c.finish)?.name.toLowerCase()} · ${find('color', c.color)?.name.toLowerCase()}`,
  ];
  if (c.toppings.length) lines.push(c.toppings.map((t) => `${find('toppings', t.id)?.name} ×${t.qty}`).join(', '));
  if (c.decorations.length) lines.push(c.decorations.map((d) => find('decorations', d)?.name).join(', '));
  if (c.topper.id !== 'none') lines.push(`Topper: ${find('topper', c.topper.id)?.name}${c.topper.text ? ` “${c.topper.text}”` : ''}`);
  if (c.candles.id !== 'none') lines.push(`${find('candles', c.candles.id)?.name}${c.candles.text ? ` ${c.candles.text}` : ''}`);
  if (c.message.text.trim()) lines.push(`Message: “${c.message.text.replace(/\n/g, ' / ')}”`);
  if (c.print.enabled) lines.push('Edible photo print');
  return { title: `Custom ${sponge?.name.toLowerCase().replace(/ bean$/, '') ?? ''} cake`.replace(/\s+/g, ' '), lines };
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36).toUpperCase();
}

/** Stable id for a design: same configuration, same id. */
export function designIdFor(c: CakeConfiguration): string {
  return `TC-${hash(JSON.stringify({ ...c, print: { ...c.print, assetId: c.print.assetId ? 'photo' : null } }))}`;
}

const toB64 = (s: string) => (typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, 'utf8').toString('base64')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (s: string) => {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  return typeof atob === 'function' ? decodeURIComponent(escape(atob(b))) : Buffer.from(b, 'base64').toString('utf8');
};

/** Share code: the whole design in the URL. The customer's photo is never shared. */
export function encodeDesign(c: CakeConfiguration): string {
  return toB64(JSON.stringify({ ...c, print: { ...c.print, enabled: false, assetId: null, sourceWidth: 0, sourceHeight: 0 } }));
}

export function decodeDesign(code: string): CakeConfiguration | null {
  try { return sanitize(JSON.parse(fromB64(code))); } catch { return null; }
}

const clamp = (n: unknown, lo: number, hi: number, fallback: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback);
const pick = (group: CatalogueGroup, v: unknown, fallback: string) => (typeof v === 'string' && find(group, v) ? v : fallback);

/** Accepts anything (autosave, share links, older versions) and returns a well-formed configuration. */
export function sanitize(raw: unknown): CakeConfiguration {
  const d = defaultConfig();
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<CakeConfiguration>;
  const m = (r.message ?? {}) as Partial<CakeConfiguration['message']>;
  const p = (r.print ?? {}) as Partial<CakeConfiguration['print']>;
  return {
    version: 1,
    size: pick('size', r.size, d.size), shape: pick('shape', r.shape, d.shape), sponge: pick('sponge', r.sponge, d.sponge),
    filling: pick('filling', r.filling, d.filling), frosting: pick('frosting', r.frosting, d.frosting), finish: pick('finish', r.finish, d.finish),
    color: pick('color', r.color, d.color), packaging: pick('packaging', r.packaging, d.packaging),
    toppings: Array.isArray(r.toppings) ? r.toppings.filter((t) => t && find('toppings', t.id)).map((t) => ({ id: t.id, qty: Math.round(clamp(t.qty, 1, find('toppings', t.id)!.maxQuantity, 1)) })) : [],
    decorations: Array.isArray(r.decorations) ? [...new Set(r.decorations.filter((x) => typeof x === 'string' && find('decorations', x)))] : [],
    topper: { id: pick('topper', r.topper?.id, 'none'), text: String(r.topper?.text ?? '').slice(0, 12) },
    candles: { id: pick('candles', r.candles?.id, 'none'), text: String(r.candles?.text ?? '').slice(0, 3) },
    message: {
      text: String(m.text ?? '').slice(0, 80), font: C.fonts.some((f) => f.id === m.font) ? m.font! : d.message.font,
      color: C.messageColors.some((x) => x.hex === m.color) ? m.color! : d.message.color, size: clamp(m.size, 0.06, 0.16, d.message.size),
      align: m.align === 'left' || m.align === 'right' ? m.align : 'center', y: clamp(m.y, 0.1, 0.9, d.message.y), rotation: clamp(m.rotation, -15, 15, 0),
    },
    print: {
      enabled: Boolean(p.enabled), assetId: typeof p.assetId === 'string' ? p.assetId : null,
      sourceWidth: clamp(p.sourceWidth, 0, 20000, 0), sourceHeight: clamp(p.sourceHeight, 0, 20000, 0),
      x: clamp(p.x, 0, 1, 0.5), y: clamp(p.y, 0, 1, 0.5), scale: clamp(p.scale, 0.2, 1.6, 0.7), rotation: clamp(p.rotation, -180, 180, 0),
    },
    notes: String(r.notes ?? '').slice(0, 300),
  };
}
