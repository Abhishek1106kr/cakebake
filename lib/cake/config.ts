// Cake Playground catalogue: every option, price, rule and production time.
// Components never hardcode options; admin tooling can later edit this data.
//
// ⚠ SAMPLE VALUES. Prices, servings, production times and availability below are
// placeholders in line with the menu's existing draft cake prices. Confirm every
// number with the bakery before launch.

import type {
  CandleOption, ColorOption, CompatibilityRule, DecorationOption, FillingOption, FinishOption, FontOption, FrostingOption,
  MessageColorOption, PackagingOption, ShapeOption, SizeOption, SpongeOption, ToppingOption, TopperOption,
} from './types';

export const CAKE_CONFIG_VERSION = 'cake-config-sample-v1';

/** Base production time for any custom cake, in hours. */
export const BASE_PRODUCTION_HOURS = 24;
export const MAX_CUSTOM_CAKES_PER_ORDER = 3;

export const sizes: SizeOption[] = [
  { id: '4in', name: '4 inch', inches: 4, servings: '2–4', diameterCm: 10, layers: 2, price: 950, available: true },
  { id: '6in', name: '6 inch', inches: 6, servings: '6–8', diameterCm: 15, layers: 3, price: 1450, available: true },
  { id: '8in', name: '8 inch', inches: 8, servings: '10–12', diameterCm: 20, layers: 3, price: 2150, available: true },
  { id: '10in', name: '10 inch', inches: 10, servings: '16–20', diameterCm: 25, layers: 4, price: 2950, available: true, productionHours: 12 },
  { id: '12in', name: '12 inch', inches: 12, servings: '24–30', diameterCm: 30, layers: 4, price: 3950, available: true, productionHours: 12 },
];

export const shapes: ShapeOption[] = [
  { id: 'round', name: 'Round', kind: 'round', price: 0, available: true },
  { id: 'square', name: 'Square', kind: 'square', price: 150, available: true },
  { id: 'heart', name: 'Heart', kind: 'heart', price: 250, available: true },
  { id: 'rectangle', name: 'Rectangle', kind: 'rectangle', price: 200, available: true },
];

export const sponges: SpongeOption[] = [
  { id: 'vanilla', name: 'Vanilla bean', flavor: 'Vanilla', color: '#F2DFAE', crumb: 'Light, buttery', price: 0, available: true, allergens: ['gluten', 'egg', 'dairy'], ingredients: { flour: 0.25, eggs: 4, butter: 0.15 } },
  { id: 'chocolate', name: 'Dark chocolate', flavor: 'Chocolate', color: '#5A3626', crumb: 'Moist, deep', price: 0, available: true, allergens: ['gluten', 'egg', 'dairy'], ingredients: { flour: 0.2, eggs: 4, chocolate: 0.15 } },
  { id: 'red-velvet', name: 'Red velvet', flavor: 'Cocoa & buttermilk', color: '#9E2B2F', crumb: 'Soft, tender', price: 150, available: true, allergens: ['gluten', 'egg', 'dairy'], ingredients: { flour: 0.25, eggs: 4 } },
  { id: 'coffee', name: 'Coffee', flavor: 'Espresso', color: '#A47551', crumb: 'Fine, aromatic', price: 100, available: true, allergens: ['gluten', 'egg', 'dairy'], ingredients: { flour: 0.25, eggs: 4, beans: 0.03 } },
  { id: 'pistachio', name: 'Pistachio', flavor: 'Roasted pistachio', color: '#B9C27C', crumb: 'Dense, nutty', price: 300, available: true, productionHours: 12, allergens: ['gluten', 'egg', 'dairy', 'nuts'], ingredients: { flour: 0.2, eggs: 4, pistachio: 0.15 } },
];

export const fillings: FillingOption[] = [
  { id: 'vanilla-cream', name: 'Vanilla cream', color: '#F6EEDA', price: 0, available: true, allergens: ['dairy'] },
  { id: 'ganache', name: 'Chocolate ganache', color: '#3B2218', price: 100, available: true, allergens: ['dairy'], ingredients: { chocolate: 0.12 } },
  { id: 'hazelnut', name: 'Hazelnut praline', color: '#9A6B42', price: 200, available: true, allergens: ['dairy', 'nuts'] },
  { id: 'berry', name: 'Berry compote', color: '#8E2A45', price: 150, available: true, ingredients: { berries: 0.15 } },
  { id: 'salted-caramel', name: 'Salted caramel', color: '#B9783A', price: 150, available: true, allergens: ['dairy'] },
  { id: 'mango', name: 'Alphonso mango', color: '#F0A93B', price: 200, available: true, seasonMonths: [3, 4, 5, 6], note: 'In season March to June' },
];

export const frostings: FrostingOption[] = [
  { id: 'buttercream', name: 'Swiss buttercream', sheen: 0.35, soft: false, price: 0, available: true, allergens: ['dairy', 'egg'], ingredients: { butter: 0.25 } },
  { id: 'whipped', name: 'Whipped cream', sheen: 0.15, soft: true, price: 0, available: true, allergens: ['dairy'] },
  { id: 'ganache', name: 'Chocolate ganache', sheen: 0.7, soft: false, price: 200, available: true, allergens: ['dairy'], ingredients: { chocolate: 0.2 } },
  { id: 'cream-cheese', name: 'Cream cheese', sheen: 0.25, soft: false, price: 150, available: true, allergens: ['dairy'], ingredients: { 'cream-cheese': 0.2 } },
];

export const finishes: FinishOption[] = [
  { id: 'smooth', name: 'Smooth', kind: 'smooth', price: 0, available: true },
  { id: 'ruffled', name: 'Ruffled', kind: 'ruffled', price: 250, available: true, productionHours: 6 },
  { id: 'textured', name: 'Palette-textured', kind: 'textured', price: 100, available: true },
  { id: 'semi-naked', name: 'Semi-naked', kind: 'semi-naked', price: 0, available: true },
];

/** Tresor-approved frosting colours. Every one maps to a natural colouring the kitchen uses. */
export const colors: ColorOption[] = [
  { id: 'cream', name: 'Cream', hex: '#F4EBDD', shade: '#D9CBB4', price: 0, available: true },
  { id: 'vanilla', name: 'Vanilla', hex: '#F3E3B8', shade: '#D8C38E', price: 0, available: true },
  { id: 'sage', name: 'Sage', hex: '#A9B7B6', shade: '#7E9291', price: 50, available: true },
  { id: 'pistachio', name: 'Pistachio', hex: '#C9D3A2', shade: '#A3AF73', price: 50, available: true },
  { id: 'blush', name: 'Blush', hex: '#EDC7C2', shade: '#CF9F98', price: 50, available: true },
  { id: 'berry', name: 'Berry', hex: '#B04A64', shade: '#82304A', price: 80, available: true },
  { id: 'caramel', name: 'Caramel', hex: '#D9A46B', shade: '#B27C45', price: 50, available: true },
  { id: 'chocolate', name: 'Chocolate', hex: '#5B3A2A', shade: '#3B2318', price: 0, available: true },
];

export const toppings: ToppingOption[] = [
  { id: 'berries', name: 'Fresh berries', kind: 'berry', color: '#A3233A', perUnit: 60, maxQuantity: 12, price: 0, available: true, ingredients: { berries: 0.015 } },
  { id: 'curls', name: 'Chocolate curls', kind: 'curl', color: '#4A2C1F', perUnit: 40, maxQuantity: 12, price: 0, available: true, allergens: ['dairy'] },
  { id: 'pistachios', name: 'Crushed pistachio', kind: 'nut', color: '#8FA35A', perUnit: 30, maxQuantity: 10, price: 0, available: true, allergens: ['nuts'], ingredients: { pistachio: 0.01 } },
  { id: 'hazelnuts', name: 'Roasted hazelnuts', kind: 'nut', color: '#A0703F', perUnit: 30, maxQuantity: 10, price: 0, available: true, allergens: ['nuts'] },
  { id: 'macarons', name: 'Macarons', kind: 'macaron', color: '#E7B9C0', perUnit: 90, maxQuantity: 6, price: 0, available: true, allergens: ['nuts', 'egg'], compatibleShapes: ['round', 'square', 'rectangle', 'heart'] },
  { id: 'flowers', name: 'Edible flowers', kind: 'flower', color: '#E9A6B5', perUnit: 70, maxQuantity: 8, price: 0, available: true },
  { id: 'gold', name: 'Gold flakes', kind: 'gold', color: '#D4AF5A', perUnit: 50, maxQuantity: 6, price: 0, available: true },
  { id: 'cookies', name: 'Butter cookies', kind: 'cookie', color: '#C99A5B', perUnit: 40, maxQuantity: 8, price: 0, available: true, allergens: ['gluten', 'dairy'] },
  { id: 'mango-cubes', name: 'Mango cubes', kind: 'fruit', color: '#F0A93B', perUnit: 50, maxQuantity: 10, price: 0, available: true, seasonMonths: [3, 4, 5, 6], note: 'In season March to June' },
];

export const decorations: DecorationOption[] = [
  { id: 'drip', name: 'Ganache drip', kind: 'drip', price: 200, available: true, allergens: ['dairy'] },
  { id: 'gold-leaf', name: 'Gold leaf', kind: 'gold-leaf', price: 350, available: true },
  { id: 'pearls', name: 'Sugar pearls', kind: 'pearls', price: 120, available: true },
  { id: 'piped-border', name: 'Piped border', kind: 'piped-border', price: 100, available: true },
  { id: 'ribbon', name: 'Satin ribbon (remove before eating)', kind: 'ribbon', price: 80, available: true },
  { id: 'shards', name: 'Chocolate shards', kind: 'shards', price: 180, available: true, allergens: ['dairy'] },
];

export const toppers: TopperOption[] = [
  { id: 'none', name: 'No topper', kind: 'none', price: 0, available: true },
  { id: 'birthday', name: '“Happy Birthday” script', kind: 'birthday', price: 250, available: true },
  { id: 'number', name: 'Number', kind: 'number', price: 200, available: true, needsText: true, maxChars: 3 },
  { id: 'name', name: 'Custom name', kind: 'name', price: 400, available: true, needsText: true, maxChars: 10, productionHours: 24 },
];

export const candles: CandleOption[] = [
  { id: 'none', name: 'No candles', kind: 'none', price: 0, available: true },
  { id: 'thin', name: 'Six tall candles', kind: 'thin', price: 60, available: true },
  { id: 'number', name: 'Number candles', kind: 'number', price: 80, available: true, needsText: true },
  { id: 'sparkler', name: 'Sparkler', kind: 'sparkler', price: 120, available: true },
];

export const packaging: PackagingOption[] = [
  { id: 'standard', name: 'Tresor box', price: 0, available: true },
  { id: 'window', name: 'Window box', price: 80, available: true },
  { id: 'gift', name: 'Gift box with ribbon', price: 150, available: true },
];

/** Approved message fonts: piped or printed in these styles only. */
export const fonts: FontOption[] = [
  { id: 'serif', name: 'Classic serif', family: 'Georgia, "Times New Roman", serif', note: 'Piped or printed', lineHeight: 1.1, widthFactor: 0.52 },
  { id: 'script', name: 'Script', family: 'var(--font-cake-script), "Brush Script MT", cursive', note: 'Piped by hand', lineHeight: 1.15, widthFactor: 0.44 },
  { id: 'sans', name: 'Modern sans', family: 'Inter, system-ui, sans-serif', note: 'Printed', lineHeight: 1.1, widthFactor: 0.56 },
];

export const messageColors: MessageColorOption[] = [
  { id: 'ink', name: 'Dark chocolate', hex: '#2B1D16' },
  { id: 'white', name: 'White chocolate', hex: '#FBF7EF' },
  { id: 'gold', name: 'Gold', hex: '#B8913F' },
  { id: 'berry', name: 'Berry', hex: '#8E2A45' },
  { id: 'sage', name: 'Sage', hex: '#4A5957' },
];

/** Message limits per cake size. */
export const messageLimits: Record<string, { maxChars: number; maxLines: number }> = {
  '4in': { maxChars: 16, maxLines: 1 },
  '6in': { maxChars: 26, maxLines: 2 },
  '8in': { maxChars: 34, maxLines: 2 },
  '10in': { maxChars: 42, maxLines: 3 },
  '12in': { maxChars: 50, maxLines: 3 },
};

/** Edible print: price, extra production time, and the minimum source resolution (dots per cm). */
export const printRules = { price: 350, productionHours: 12, minDotsPerCm: 45, maxUploadBytes: 8 * 1024 * 1024, minSourcePx: 600, acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'], printableInset: 0.12 };

/** Compatibility rules, as data. `block` lists what the `when` condition rules out. */
export const rules: CompatibilityRule[] = [
  { id: 'whipped-no-ruffles', when: { frosting: ['whipped'] }, block: { finish: ['ruffled'] }, reason: 'Whipped cream is too soft to hold ruffles.' },
  { id: 'heart-sizes', when: { shape: ['heart'] }, block: { size: ['4in', '12in'] }, reason: 'Heart tins come in 6 to 10 inch.' },
  { id: 'rectangle-sizes', when: { shape: ['rectangle'] }, block: { size: ['4in', '6in'] }, reason: 'Rectangles start at 8 inch.' },
  { id: 'print-min-size', when: { size: ['4in'] }, block: { print: true }, reason: 'Photo prints need at least a 6-inch top.' },
  { id: 'print-needs-frosted-top', when: { finish: ['semi-naked'] }, block: { print: true }, reason: 'Prints need a fully frosted top.' },
  { id: 'small-no-topper', when: { size: ['4in'] }, block: { topper: ['number', 'name', 'birthday'] }, reason: 'A 4-inch cake is too small for a topper.' },
  { id: 'small-no-macarons', when: { size: ['4in'] }, block: { topping: ['macarons'] }, reason: 'Macarons need at least a 6-inch top.' },
  { id: 'ganache-drip-dark', when: { frosting: ['ganache'] }, block: { decoration: ['drip'] }, reason: 'A ganache cake already has the drip’s finish.' },
  { id: 'semi-naked-no-ribbon', when: { finish: ['semi-naked'] }, block: { decoration: ['ribbon'] }, reason: 'Ribbon needs a frosted side to sit against.' },
];
