// Cake Builder management: the bakery's changes to the Cake Playground catalogue,
// stored as overrides on the code defaults (lib/cake/config.ts) and assembled into
// the live catalogue the studio, pricing, rules and production sheets read.
//
// Current price = this catalogue. Historical price = the order's own snapshot
// (unitPrice + custom.snapshot), which no change here can touch.

import { DEFAULT_CAKE_CATALOG, type CakeCatalog } from '@/lib/cake/config';
import type { CatalogueGroup } from '@/lib/cake/engine';
import type { CompatibilityRule, OptionBase, OptionStatus, PrintRules, RuleScope, ShapeOption } from '@/lib/cake/types';

export const GROUP_KEY: Record<CatalogueGroup, keyof CakeCatalog> = {
  size: 'sizes', shape: 'shapes', sponge: 'sponges', filling: 'fillings', frosting: 'frostings', finish: 'finishes', color: 'colors',
  toppings: 'toppings', decorations: 'decorations', topper: 'toppers', candles: 'candles', packaging: 'packaging',
};

export const GROUP_LABEL: Record<CatalogueGroup, string> = {
  size: 'Sizes', shape: 'Shapes', sponge: 'Sponges', filling: 'Fillings', frosting: 'Frostings', finish: 'Finishes', color: 'Colours',
  toppings: 'Toppings', decorations: 'Decorations', topper: 'Toppers', candles: 'Candles', packaging: 'Packaging',
};

/** Any option, with the group-specific fields it may carry. */
export type AnyOption = OptionBase & Record<string, unknown> & { maxQuantity?: number; perUnit?: number; compatibleShapes?: ShapeOption['kind'][] };
export type OptionOverride = Partial<AnyOption> & { createdInAdmin?: boolean };

export type CakeOverrides = {
  revision: number;
  options: Partial<Record<CatalogueGroup, Record<string, OptionOverride>>>;
  fonts: Record<string, { status: OptionStatus }>;
  messageColors: Record<string, { status?: OptionStatus; name?: string; hex?: string; createdInAdmin?: boolean }>;
  printRules: Partial<PrintRules>;
  rules: Record<string, { enabled?: boolean; reason?: string }>;
  createdRules: CompatibilityRule[];
  baseProductionHours: number | null;
};

export const EMPTY_OVERRIDES: CakeOverrides = { revision: 0, options: {}, fonts: {}, messageColors: {}, printRules: {}, rules: {}, createdRules: [], baseProductionHours: null };

export function normalizeOverrides(raw: unknown): CakeOverrides {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<CakeOverrides>;
  return {
    revision: Number.isInteger(r.revision) ? r.revision! : 0,
    options: r.options && typeof r.options === 'object' ? r.options : {},
    fonts: r.fonts && typeof r.fonts === 'object' ? r.fonts : {},
    messageColors: r.messageColors && typeof r.messageColors === 'object' ? r.messageColors : {},
    printRules: r.printRules && typeof r.printRules === 'object' ? r.printRules : {},
    rules: r.rules && typeof r.rules === 'object' ? r.rules : {},
    createdRules: Array.isArray(r.createdRules) ? r.createdRules : [],
    baseProductionHours: typeof r.baseProductionHours === 'number' ? r.baseProductionHours : null,
  };
}

function mergeList<T extends { id: string }>(base: T[], over: Record<string, OptionOverride> | undefined): T[] {
  const o = over ?? {};
  const merged = base.map((b) => (o[b.id] ? ({ ...b, ...o[b.id] } as T) : b));
  const created = Object.entries(o).filter(([id, v]) => v.createdInAdmin && !base.some((b) => b.id === id)).map(([, v]) => v as unknown as T);
  return [...merged, ...created];
}

/** The live catalogue: defaults + overrides. Pure. */
export function buildCakeCatalog(overrides: CakeOverrides, defaults: Readonly<CakeCatalog> = DEFAULT_CAKE_CATALOG): CakeCatalog {
  const c: CakeCatalog = { ...defaults } as CakeCatalog;
  for (const [group, key] of Object.entries(GROUP_KEY) as [CatalogueGroup, keyof CakeCatalog][]) {
    (c as Record<string, unknown>)[key] = mergeList(defaults[key] as unknown as { id: string }[], overrides.options[group]);
  }
  c.fonts = defaults.fonts.map((f) => (overrides.fonts[f.id] ? { ...f, ...overrides.fonts[f.id] } : f));
  c.messageColors = [
    ...defaults.messageColors.map((m) => (overrides.messageColors[m.id] ? { ...m, ...overrides.messageColors[m.id] } : m)),
    ...Object.entries(overrides.messageColors).filter(([id, v]) => v.createdInAdmin && v.name && v.hex && !defaults.messageColors.some((m) => m.id === id)).map(([id, v]) => ({ id, name: v.name!, hex: v.hex!, status: v.status })),
  ];
  c.printRules = { ...defaults.printRules, ...overrides.printRules };
  const minInches = c.printRules.minSizeInches;
  c.rules = [...defaults.rules, ...overrides.createdRules].map((r) => {
    let rule: CompatibilityRule = overrides.rules[r.id] ? { ...r, ...overrides.rules[r.id] } : r;
    // The print minimum size is a setting, so its rule follows it.
    if (r.id === 'print-min-size' && typeof minInches === 'number') {
      const small = c.sizes.filter((s) => s.inches < minInches).map((s) => s.id);
      rule = { ...rule, when: { size: small }, reason: `Photo prints need at least a ${minInches}-inch top.`, enabled: rule.enabled !== false && small.length > 0 };
    }
    return rule;
  });
  c.baseProductionHours = overrides.baseProductionHours ?? defaults.baseProductionHours;
  c.version = overrides.revision > 0 ? `${defaults.version}+r${overrides.revision}` : defaults.version;
  return c;
}

export const groupOptions = (catalog: CakeCatalog, group: CatalogueGroup) => catalog[GROUP_KEY[group]] as unknown as AnyOption[];

export type FieldErrors = Record<string, string>;

export function validateOption(group: CatalogueGroup, o: AnyOption, all: AnyOption[]): FieldErrors {
  const e: FieldErrors = {};
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(o.id)) e.id = 'Use lowercase letters, numbers and hyphens.';
  else if (all.some((x) => x !== o && x.id === o.id)) e.id = 'Another option already uses this id.';
  if (String(o.name ?? '').trim().length < 2) e.name = 'Give it a name.';
  if (!Number.isInteger(o.price) || o.price < 0 || o.price > 50000) e.price = 'Whole rupees, 0 to 50,000.';
  if (o.productionHours !== undefined && (!Number.isInteger(o.productionHours) || o.productionHours < 0 || o.productionHours > 72)) e.productionHours = 'Whole hours, 0 to 72.';
  if (o.seasonMonths && (o.seasonMonths.length === 0 || o.seasonMonths.some((m) => m < 1 || m > 12))) e.seasonMonths = 'Pick at least one month, or make it all year.';
  if (group === 'toppings') {
    if (!Number.isInteger(o.maxQuantity) || o.maxQuantity! < 1 || o.maxQuantity! > 30) e.maxQuantity = 'Between 1 and 30 portions.';
    if (!Number.isInteger(o.perUnit) || o.perUnit! < 0) e.perUnit = 'Whole rupees per portion.';
  }
  if (group === 'color') {
    if (!/^#[0-9a-f]{6}$/i.test(String(o.hex ?? ''))) e.hex = 'A colour like #A9B7B6.';
    if (!/^#[0-9a-f]{6}$/i.test(String(o.shade ?? ''))) e.shade = 'A shade like #7E9291.';
  }
  if (group === 'size') {
    const inches = Number(o.inches);
    if (!Number.isInteger(inches) || inches < 3 || inches > 16) e.inches = 'Between 3 and 16 inches.';
    if (!Number.isInteger(Number(o.layers)) || Number(o.layers) < 1 || Number(o.layers) > 6) e.layers = '1 to 6 layers.';
  }
  for (const [k, v] of Object.entries(o.ingredients ?? {})) if (!(typeof v === 'number' && v >= 0 && v < 100)) e.ingredients = `Amount for ${k} must be a number.`;
  return e;
}

/** A copy with a free id, inactive until the bakery turns it on. Render fields (kind, colour) come along so the preview works. */
export function duplicateOption(o: AnyOption, all: AnyOption[]): AnyOption {
  let n = 2;
  while (all.some((x) => x.id === `${o.id}-${n}`)) n += 1;
  return { ...o, id: `${o.id}-${n}`, name: `${o.name} (copy)`, status: 'INACTIVE' };
}

/** Writes one option's changes into the overrides (only fields that differ from the default are kept). */
export function withOptionChange(over: CakeOverrides, group: CatalogueGroup, next: AnyOption, defaults: Readonly<CakeCatalog> = DEFAULT_CAKE_CATALOG): CakeOverrides {
  const base = (defaults[GROUP_KEY[group]] as unknown as AnyOption[]).find((b) => b.id === next.id);
  const groupOver = { ...(over.options[group] ?? {}) };
  if (!base) groupOver[next.id] = { ...next, createdInAdmin: true };
  else {
    const delta: OptionOverride = {};
    for (const [k, v] of Object.entries(next)) if (JSON.stringify(v) !== JSON.stringify((base as Record<string, unknown>)[k])) (delta as Record<string, unknown>)[k] = v;
    if (Object.keys(delta).length) groupOver[next.id] = delta; else delete groupOver[next.id];
  }
  return { ...over, revision: over.revision + 1, options: { ...over.options, [group]: groupOver } };
}

/** How many orders chose an option (shown before archiving or disabling it). */
export function optionUsage(group: CatalogueGroup, id: string, orders: { items: { custom?: { config: Record<string, unknown> & { toppings: { id: string }[]; decorations: string[]; topper: { id: string }; candles: { id: string } } } }[] }[]): number {
  return orders.filter((o) => o.items.some((l) => {
    const c = l.custom?.config;
    if (!c) return false;
    if (group === 'toppings') return c.toppings.some((t) => t.id === id);
    if (group === 'decorations') return c.decorations.includes(id);
    if (group === 'topper') return c.topper.id === id;
    if (group === 'candles') return c.candles.id === id;
    return c[group] === id;
  })).length;
}

export function validateRule(r: CompatibilityRule, all: CompatibilityRule[]): FieldErrors {
  const e: FieldErrors = {};
  const hasAny = (s: RuleScope) => Object.values(s).some((v) => v === true || (Array.isArray(v) && v.length > 0));
  if (!/^[a-z0-9-]+$/.test(r.id)) e.id = 'Lowercase letters, numbers and hyphens.';
  else if (all.some((x) => x !== r && x.id === r.id)) e.id = 'Another rule uses this id.';
  if (!hasAny(r.when)) e.when = 'Choose what triggers the rule.';
  if (!hasAny(r.block)) e.block = 'Choose what it rules out.';
  if (r.reason.trim().length < 8) e.reason = 'Explain the reason the customer will see.';
  return e;
}

export function validatePrintRules(p: PrintRules): FieldErrors {
  const e: FieldErrors = {};
  if (!Number.isInteger(p.price) || p.price < 0) e.price = 'Whole rupees.';
  if (!Number.isInteger(p.productionHours) || p.productionHours < 0 || p.productionHours > 72) e.productionHours = '0 to 72 hours.';
  if (!(p.minDotsPerCm >= 10 && p.minDotsPerCm <= 200)) e.minDotsPerCm = '10 to 200 dots per cm (about 25–500 DPI).';
  if (!(p.maxUploadBytes >= 512 * 1024 && p.maxUploadBytes <= 25 * 1024 * 1024)) e.maxUploadBytes = 'Between 0.5 and 25 MB.';
  if (!(p.printableInset >= 0.02 && p.printableInset <= 0.3)) e.printableInset = 'Safe margin between 2% and 30%.';
  if (!p.acceptedTypes.length || p.acceptedTypes.some((t) => !/^image\/(jpeg|png|webp)$/.test(t))) e.acceptedTypes = 'JPEG, PNG and/or WebP.';
  if (p.minSizeInches !== undefined && !(p.minSizeInches >= 4 && p.minSizeInches <= 12)) e.minSizeInches = '4 to 12 inches.';
  return e;
}

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dpi = (dotsPerCm: number) => Math.round(dotsPerCm * 2.54);
