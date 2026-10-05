/**
 * Generates the shipped demo dataset (public/mock-data/*.json): exactly 1,000 orders over about
 * fifteen months, the customers who placed them, payments, refunds, invoices, custom cakes,
 * support issues, automation jobs, notifications, stock movements, daily analytics, campaigns and
 * staff. Deterministic: the same seed and anchor always produce byte-identical files.
 *
 * Everything is computed with the app's own code (pricing, cake engine, recipes, invoice builder,
 * slot parsing), so the records agree with what the shop and admin calculate.
 *
 *   npm run mock:generate          (then npm run mock:validate)
 *
 * All data is fictional demo data: synthetic phone numbers (5550…), example.* email addresses,
 * real Bengaluru localities with fictional streets.
 */
process.env.TZ = 'Asia/Kolkata';

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { baseProducts, type Product } from '../lib/data';
import { calcTotals, makeCustomLine, makeLine, prepTarget, type CartLine, type Order, type OrderStatus, type PaymentMethod, type PaymentStatus, type Size } from '../lib/orders';
import { initialInventory, needsFor, type Ingredient } from '../lib/inventory';
import { defaultConfig, slotsAfter, validate as validateCake } from '../lib/cake/engine';
import { messageLimitsFor } from '../lib/cake/config';
import type { CakeConfiguration } from '../lib/cake/types';
import { buildInvoice, maskPhone, newJob, NOTIFY_STATUSES, whatsappMessage, type AutomationEvent, type Invoice, type Job } from '../lib/automation/automation';
import { deliverBy, requiredBy } from '../lib/admin/order-ops';
import { BUILDINGS, EMAIL_DOMAINS, FIRST_NAMES, LAST_NAMES, LOCALITIES, MESSAGE_NAMES } from './mock-data/pools';
import type { AuditRecord } from '../lib/admin/audit';
import type {
  IssueCategory, IssuePriority, IssueStatus, MockDataset, NotificationType, SeedAnalyticsDay, SeedCampaign, SeedCustomCake, SeedCustomer,
  SeedIssue, SeedMovement, SeedNotification, SeedOrder, SeedPayment, SeedRefund, SeedStaff,
} from '../lib/mock-data/types';

// ───────────────────────────── Settings ─────────────────────────────

const SEED = 20261005;
const VERSION = 'demo-2026-10-05.1';
const IST = 330; // minutes ahead of UTC
const ist = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(Date.UTC(y, m, d, h, mi) - IST * 60000);
const ANCHOR = ist(2026, 9, 5, 16, 0); // Mon 5 Oct 2026, 4 pm: "now" for the dataset
const START = ist(2025, 7, 1); // Fri 1 Aug 2025
const ORDER_TOTAL = 1000;
const LIVE_COUNT = 8;
const CUSTOMER_COUNT = 640;
const MIN = 60000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// ───────────────────────────── Deterministic randomness ─────────────────────────────

function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rnd = mulberry32(SEED);
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const chance = (p: number) => rnd() < p;
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
function weighted<T>(items: readonly T[], weight: (x: T) => number): T {
  const total = items.reduce((s, x) => s + Math.max(0, weight(x)), 0);
  let r = rnd() * total;
  for (const x of items) { r -= Math.max(0, weight(x)); if (r <= 0) return x; }
  return items[items.length - 1];
}
const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const pad = (n: number, w: number) => String(n).padStart(w, '0');

// ───────────────────────────── Calendar (IST) ─────────────────────────────

const parts = (d: Date) => { const t = new Date(d.getTime() + IST * MIN); return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes(), dow: t.getUTCDay() }; };
const dayKey = (d: Date) => { const p = parts(d); return `${p.y}-${pad(p.m + 1, 2)}-${pad(p.d, 2)}`; };
const startOfDay = (d: Date) => { const p = parts(d); return ist(p.y, p.m, p.d); };
const iso = (d: Date) => d.toISOString();
const inRange = (d: Date, from: Date, to: Date) => d >= from && d <= to;

const DAYS: Date[] = [];
for (let t = START.getTime(); t <= startOfDay(ANCHOR).getTime(); t += DAY) DAYS.push(new Date(t));
const ANCHOR_DAY = startOfDay(ANCHOR);
const HISTORY_DAYS = DAYS.filter((d) => d < ANCHOR_DAY);

type Occasion = { tag: string; from: Date; to: Date; mult: number };
const OCCASIONS: Occasion[] = [
  { tag: 'diwali', from: ist(2025, 9, 14), to: ist(2025, 9, 21, 23, 59), mult: 2.2 },
  { tag: 'christmas', from: ist(2025, 11, 19), to: ist(2025, 11, 25, 23, 59), mult: 2.8 },
  { tag: 'newyear', from: ist(2025, 11, 31), to: ist(2025, 11, 31, 23, 59), mult: 2.0 },
  { tag: 'valentine', from: ist(2026, 1, 10), to: ist(2026, 1, 14, 23, 59), mult: 2.0 },
  { tag: 'eid', from: ist(2026, 2, 19), to: ist(2026, 2, 21, 23, 59), mult: 1.3 },
  { tag: 'mothers', from: ist(2026, 4, 8), to: ist(2026, 4, 10, 23, 59), mult: 1.9 },
  { tag: 'onam', from: ist(2026, 7, 25), to: ist(2026, 7, 28, 23, 59), mult: 1.35 },
  { tag: 'ganesha', from: ist(2026, 8, 13), to: ist(2026, 8, 14, 23, 59), mult: 1.2 },
];
const occasionOn = (d: Date) => OCCASIONS.find((o) => inRange(d, o.from, o.to)) ?? null;
const DOW = [1.55, 0.8, 0.85, 0.9, 0.95, 1.15, 1.45]; // Sun..Sat
const inSeason = (id: string, d: Date) => {
  const p = parts(d);
  if (id === 'mango-danish' || id === 'mango-passion') return p.m >= 3 && p.m <= 5; // Apr–Jun
  if (id === 'plum-cake') return (p.m === 10 && p.d >= 20) || p.m === 11 || (p.m === 0 && p.d <= 6);
  if (id === 'festive-gift-box') return (p.m === 9) || (p.m === 10 && p.d <= 15) || p.m === 11;
  return true;
};
function dayWeight(d: Date, i: number, n: number) {
  const growth = 0.6 + 0.65 * (i / n);
  const occ = occasionOn(d);
  const monsoonDip = [6, 7].includes(parts(d).m) ? 0.95 : 1;
  return growth * DOW[parts(d).dow] * (occ ? occ.mult : 1) * monsoonDip;
}

// ───────────────────────────── Staff ─────────────────────────────

const STAFF: SeedStaff[] = [
  ['staff-owner', 'Owner (demo)', 'OWNER'], ['staff-admin', 'Admin (demo)', 'ADMIN'], ['staff-manager', 'Manager (demo)', 'MANAGER'],
  ['staff-kitchen', 'Kitchen (demo)', 'KITCHEN'], ['staff-baker', 'Baker (demo)', 'BAKER'], ['staff-delivery', 'Delivery (demo)', 'DELIVERY'],
  ['staff-support', 'Support (demo)', 'SUPPORT'], ['staff-kitchen-am', 'Kitchen · morning shift (demo)', 'KITCHEN'],
  ['staff-baker-cakes', 'Baker · custom cakes (demo)', 'BAKER'], ['staff-rider-2', 'Delivery · second rider (demo)', 'DELIVERY'],
].map(([id, name, role]) => ({ id, name, role: role as SeedStaff['role'], active: true, createdAt: iso(ist(2025, 5, 2, 10)), email: `${id.replace('staff-', '')}.demo@example.com` }));

// ───────────────────────────── Customers ─────────────────────────────

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
const usedNames = new Set<string>();
const usedPhones = new Set<string>();
function makeCustomer(i: number): SeedCustomer {
  let name = '';
  for (let tries = 0; tries < 50; tries += 1) {
    name = `${weighted(FIRST_NAMES, (x) => x.w).name} ${weighted(LAST_NAMES, (x) => x.w).name}`;
    if (!usedNames.has(name)) break;
  }
  usedNames.add(name);
  let phone = '';
  do { phone = `5550${pad(int(0, 999999), 6)}`; } while (usedPhones.has(phone));
  usedPhones.add(phone);
  const loc = weighted(LOCALITIES, (x) => x.w);
  const apartment = chance(0.62);
  const address = apartment
    ? `Flat ${pick(['A', 'B', 'C', 'D'])}-${int(1, 14)}${pad(int(1, 8), 2)}, ${pick(BUILDINGS)}, ${pick(loc.roads)}, ${loc.name}`
    : `#${int(3, 980)}, ${ordinal(int(1, 18))} Cross, ${pick(loc.roads)}, ${loc.name}`;
  const [first, last] = name.toLowerCase().replace(/[^a-z ]/g, '').split(' ');
  const email = chance(0.72) ? `${first}.${last}${chance(0.3) ? int(1, 99) : ''}@${pick(EMAIL_DOMAINS)}` : '';
  return {
    id: `CUS-${pad(i + 1, 5)}`, name, phone, email, address, locality: loc.name, pin: loc.pin, createdAt: '', marketingOptIn: chance(0.31),
    preferredMethod: weighted(['UPI', 'Card', 'COD'] as PaymentMethod[], (m) => (m === 'UPI' ? 55 : m === 'Card' ? 20 : 25)),
    tags: [], notes: '', orderIds: [], orderCount: 0, totalSpend: 0, refunded: 0, firstOrderAt: null, lastOrderAt: null, customCakeIds: [], issueIds: [],
  };
}
const customers = Array.from({ length: CUSTOMER_COUNT }, (_, i) => makeCustomer(i));

// Order quotas: most people order once or twice; a loyal few order often. Sum is exactly ORDER_TOTAL.
const quota = new Map<string, number>();
for (const c of customers) {
  const r = rnd();
  quota.set(c.id, r < 0.62 ? 1 : r < 0.84 ? 2 : r < 0.93 ? int(3, 4) : r < 0.985 ? int(5, 8) : int(10, 16));
}
let quotaSum = [...quota.values()].reduce((a, b) => a + b, 0);
while (quotaSum > ORDER_TOTAL) { const c = pick(customers); const q = quota.get(c.id)!; if (q > 1) { quota.set(c.id, q - 1); quotaSum -= 1; } }
while (quotaSum < ORDER_TOTAL) { const c = pick(customers); quota.set(c.id, quota.get(c.id)! + 1); quotaSum += 1; }

// ───────────────────────────── When orders happen ─────────────────────────────

const weights = HISTORY_DAYS.map((d, i) => dayWeight(d, i, HISTORY_DAYS.length));
const cumulative: number[] = []; weights.reduce((s, w, i) => (cumulative[i] = s + w), 0);
const totalWeight = cumulative[cumulative.length - 1];
const sampleDay = () => { const r = rnd() * totalWeight; let lo = 0, hi = cumulative.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (cumulative[mid] < r) lo = mid + 1; else hi = mid; } return HISTORY_DAYS[lo]; };

type Basket = 'breakfast' | 'cafe' | 'treats' | 'bread' | 'wholecake' | 'custom' | 'gift';
function timeOfDay(day: Date, basket: Basket): Date {
  // Minutes after midnight, IST: morning pastries and coffee, a lunch bump, an evening cake peak.
  const slots: [number, number, number][] = basket === 'breakfast' ? [[480, 660, 8], [660, 780, 2]]
    : basket === 'cafe' ? [[690, 870, 6], [870, 1080, 3]]
    : basket === 'bread' ? [[480, 720, 5], [1020, 1200, 3]]
    : basket === 'custom' || basket === 'wholecake' ? [[600, 900, 3], [900, 1290, 6]]
    : [[600, 840, 3], [840, 1080, 4], [1080, 1290, 4]];
  const [from, to] = weighted(slots, (s) => s[2]);
  return new Date(day.getTime() + int(from, to) * MIN);
}

// ───────────────────────────── Baskets and cakes ─────────────────────────────

const P = new Map(baseProducts.map((p) => [p.id, p]));
const byCat = (cat: string) => baseProducts.filter((p) => p.category === cat);
const WHOLE_CAKES = baseProducts.filter((p) => p.cake);
const SLICES = baseProducts.filter((p) => p.category === 'Cake' && !p.cake && p.id !== 'plum-cake');
const sizeFor = (p: Product): Size => ((p.category === 'Coffee' || p.category === 'Drinks') && chance(0.3) ? 'Large' : 'Regular');
const POPULAR: Record<string, number> = { 'almond-croissant': 9, 'butter-croissant': 7, 'pain-au-chocolat': 7, 'tresor-latte': 9, 'filter-coffee': 8, 'cappuccino': 6, 'cold-brew': 5, 'paneer-tikka-puff': 8, 'chocolate-brownie': 7, 'basque-cheesecake': 6, 'country-sourdough': 5, 'masala-chai': 6, 'choc-chip-cookie': 6 };
const pop = (p: Product) => POPULAR[p.id] ?? 3;

function pickFrom(list: Product[], day: Date) {
  const ok = list.filter((p) => inSeason(p.id, day));
  return weighted(ok.length ? ok : list, pop);
}

function basketFor(day: Date): Basket {
  const occ = occasionOn(day);
  const custom = occ?.tag === 'valentine' || occ?.tag === 'mothers' ? 18 : 10.5;
  const gift = occ && ['diwali', 'christmas', 'newyear'].includes(occ.tag) ? 22 : 2.5;
  return weighted(['breakfast', 'cafe', 'treats', 'bread', 'wholecake', 'custom', 'gift'] as Basket[], (b) => ({ breakfast: 28, cafe: 15, treats: 19, bread: 9, wholecake: 11, custom, gift }[b]));
}

function addLine(lines: CartLine[], p: Product, qty: number) {
  const size = sizeFor(p);
  const existing = lines.find((l) => l.lineId === `${p.id}:${size}`);
  if (existing) existing.qty = Math.min(10, existing.qty + qty);
  else lines.push(makeLine(p, size, qty));
}

const OCCASION_TYPES = ['birthday', 'birthday', 'birthday', 'birthday', 'birthday', 'birthday', 'anniversary', 'anniversary', 'celebration', 'baby', 'farewell'];
function customCakeConfig(day: Date, occasion: string): { config: CakeConfiguration; message: string } {
  const month = parts(day).m + 1;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const c = defaultConfig();
    const guests = weighted([6, 8, 12, 20, 30], (g) => ({ 6: 3, 8: 5, 12: 4, 20: 2, 30: 1 }[g] ?? 1));
    c.size = guests <= 6 ? '6in' : guests <= 8 ? pick(['6in', '8in']) : guests <= 12 ? '8in' : guests <= 20 ? '10in' : '12in';
    c.shape = occasion === 'anniversary' || occasion === 'valentine' ? weighted(['heart', 'round'], (s) => (s === 'heart' ? 6 : 4)) : weighted(['round', 'square', 'rectangle'], (s) => (s === 'round' ? 7 : s === 'square' ? 2 : 1));
    c.sponge = weighted(['vanilla', 'chocolate', 'red-velvet', 'coffee', 'pistachio'], (s) => ({ vanilla: 4, chocolate: 5, 'red-velvet': 3, coffee: 1, pistachio: 2 }[s] ?? 1));
    c.filling = weighted(['vanilla-cream', 'ganache', 'hazelnut', 'berry', 'salted-caramel', 'mango'], (s) => (s === 'mango' ? (month >= 4 && month <= 6 ? 4 : 0.01) : { 'vanilla-cream': 3, ganache: 5, hazelnut: 2, berry: 3, 'salted-caramel': 2 }[s] ?? 1));
    c.frosting = weighted(['buttercream', 'whipped', 'ganache', 'cream-cheese'], (s) => ({ buttercream: 5, whipped: 3, ganache: 3, 'cream-cheese': 2 }[s] ?? 1));
    c.finish = weighted(['smooth', 'ruffled', 'textured', 'semi-naked'], (s) => ({ smooth: 5, ruffled: 2, textured: 3, 'semi-naked': 2 }[s] ?? 1));
    c.color = occasion === 'anniversary' || occasion === 'valentine' ? pick(['blush', 'berry', 'cream']) : occasion === 'baby' ? pick(['blush', 'sage', 'vanilla']) : pick(['cream', 'vanilla', 'sage', 'pistachio', 'blush', 'berry', 'caramel', 'chocolate']);
    const toppings = ['berries', 'curls', 'pistachios', 'hazelnuts', 'macarons', 'flowers', 'gold', 'cookies', 'mango-cubes'].filter((t) => t !== 'mango-cubes' || (month >= 4 && month <= 6));
    c.toppings = [...new Set(Array.from({ length: weighted([0, 1, 2, 3], (n) => [2, 4, 3, 1][n]) }, () => pick(toppings)))].map((id) => ({ id, qty: 1 }));
    c.decorations = [...new Set(Array.from({ length: weighted([0, 1, 2], (n) => [3, 4, 2][n]) }, () => pick(['drip', 'gold-leaf', 'pearls', 'piped-border', 'ribbon', 'shards'])))];
    const name = pick(MESSAGE_NAMES);
    const age = int(1, 12) <= 6 ? int(1, 10) : int(16, 60);
    if (occasion === 'birthday') { c.topper = chance(0.5) ? { id: 'birthday', text: '' } : chance(0.5) ? { id: 'number', text: String(age) } : { id: 'name', text: name }; c.candles = chance(0.6) ? { id: 'number', text: String(age) } : { id: pick(['thin', 'sparkler']), text: '' }; }
    if (occasion === 'anniversary') c.topper = chance(0.4) ? { id: 'number', text: String(pick([1, 5, 10, 25])) } : { id: 'none', text: '' };
    c.packaging = weighted(['standard', 'window', 'gift'], (p) => ({ standard: 5, window: 3, gift: 2 }[p] ?? 1));
    const message = {
      birthday: pick([`Happy Birthday ${name}!`, `Happy ${age}th, ${name}`, `${name} turns ${age}`, `Happy Birthday ${name}`]),
      anniversary: pick(['Happy Anniversary', `Happy ${pick([1, 5, 10, 25])} years`, 'Forever & always']),
      valentine: pick(['Be mine', 'Love you always', 'Happy Valentine’s']),
      celebration: pick(['Congratulations!', 'Well done!', 'Cheers to you', 'Congratulations Dr. ' + name]),
      baby: pick([`Welcome baby ${name}`, 'Welcome little one', 'Oh baby!']),
      farewell: pick(['We will miss you', `Good luck ${name}`, 'Farewell & thank you']),
    }[occasion] ?? '';
    const limits = messageLimitsFor(c.size);
    c.message = { ...c.message, text: message.slice(0, limits.maxChars), font: pick(['serif', 'script', 'sans']) };
    const errors = validateCake(c, { month }).filter((x) => x.level === 'error');
    if (!errors.length) return { config: c, message: c.message.text };
  }
  return { config: defaultConfig(), message: '' };
}

function makeBasket(day: Date, basket: Basket): { lines: CartLine[]; occasion: string | null } {
  const lines: CartLine[] = [];
  let occasion: string | null = null;
  switch (basket) {
    case 'breakfast': {
      const n = weighted([1, 2, 3], (k) => [4, 4, 2][k - 1]);
      for (let i = 0; i < n; i += 1) addLine(lines, pickFrom(byCat('Pastry'), day), weighted([1, 2, 3, 4], (k) => [4, 3, 1, 1][k - 1]));
      const drinks = weighted([0, 1, 2], (k) => [2, 5, 3][k]);
      for (let i = 0; i < drinks; i += 1) addLine(lines, pickFrom([...byCat('Coffee'), ...byCat('Drinks')], day), 1);
      break;
    }
    case 'cafe': {
      addLine(lines, pickFrom(byCat('Savoury'), day), weighted([1, 2, 3], (k) => [5, 3, 1][k - 1]));
      if (chance(0.5)) addLine(lines, pickFrom(byCat('Savoury'), day), 1);
      addLine(lines, pickFrom([...byCat('Coffee'), ...byCat('Drinks')], day), weighted([1, 2], (k) => [3, 2][k - 1]));
      if (chance(0.35)) addLine(lines, pickFrom(byCat('Dessert').filter((p) => p.price < 400), day), 1);
      break;
    }
    case 'treats': {
      const n = weighted([1, 2, 3], (k) => [3, 4, 2][k - 1]);
      for (let i = 0; i < n; i += 1) addLine(lines, pickFrom([...byCat('Dessert').filter((p) => p.price < 800), ...SLICES], day), weighted([1, 2, 4, 6], (k) => ({ 1: 4, 2: 4, 4: 2, 6: 1 }[k] ?? 1)));
      if (chance(0.4)) addLine(lines, pickFrom(byCat('Coffee'), day), weighted([1, 2], (k) => [3, 1][k - 1]));
      break;
    }
    case 'bread': {
      addLine(lines, pickFrom(byCat('Bread'), day), weighted([1, 2], (k) => [4, 2][k - 1]));
      if (chance(0.45)) addLine(lines, pickFrom(byCat('Pastry'), day), weighted([2, 4, 6], (k) => ({ 2: 4, 4: 2, 6: 1 }[k] ?? 1)));
      if (chance(0.3)) addLine(lines, pickFrom(byCat('Bread'), day), 1);
      break;
    }
    case 'wholecake': {
      addLine(lines, pickFrom(WHOLE_CAKES.filter((p) => inSeason(p.id, day)), day), 1);
      if (chance(0.3)) addLine(lines, pickFrom(byCat('Dessert').filter((p) => p.price < 800), day), weighted([2, 4, 6], (k) => ({ 2: 3, 4: 2, 6: 1 }[k] ?? 1)));
      occasion = pick(['birthday', 'birthday', 'anniversary', 'celebration']);
      break;
    }
    case 'custom': {
      const occ = occasionOn(day)?.tag === 'valentine' ? 'valentine' : pick(OCCASION_TYPES);
      const { config } = customCakeConfig(day, occ);
      lines.push(makeCustomLine(config, 1));
      if (chance(0.25)) addLine(lines, pickFrom([...byCat('Dessert').filter((p) => p.price < 800)], day), weighted([2, 4, 6], (k) => ({ 2: 3, 4: 2, 6: 1 }[k] ?? 1)));
      occasion = occ;
      break;
    }
    case 'gift': {
      const tag = occasionOn(day)?.tag;
      const gifts = baseProducts.filter((p) => (p.tag === 'Gift' || p.id === 'plum-cake') && inSeason(p.id, day));
      const g = tag === 'christmas' || tag === 'newyear' ? (inSeason('plum-cake', day) ? P.get('plum-cake')! : pick(gifts)) : weighted(gifts, (p) => (p.id === 'festive-gift-box' && tag === 'diwali' ? 6 : 2));
      addLine(lines, g, weighted([1, 2, 3, 5], (k) => ({ 1: 5, 2: 3, 3: 1, 5: 1 }[k] ?? 1)));
      if (chance(0.3)) addLine(lines, pick(gifts), 1);
      occasion = tag ?? 'gifting';
      break;
    }
  }
  return { lines, occasion };
}

// ───────────────────────────── Orders ─────────────────────────────

type Draft = { at: Date; basket: Basket; live: boolean; customerId?: string };
const drafts: Draft[] = [];
for (let i = 0; i < ORDER_TOTAL - LIVE_COUNT; i += 1) { const day = sampleDay(); const basket = basketFor(day); drafts.push({ at: timeOfDay(day, basket), basket, live: false }); }
// Today, relative to the anchor: three delivered this morning, the rest on the board now.
const LIVE_PLAN: { minutesAgo: number; status: OrderStatus; basket: Basket }[] = [
  { minutesAgo: 388, status: 'DELIVERED', basket: 'breakfast' }, { minutesAgo: 241, status: 'DELIVERED', basket: 'cafe' },
  { minutesAgo: 68, status: 'OUT_FOR_DELIVERY', basket: 'treats' }, { minutesAgo: 47, status: 'READY', basket: 'breakfast' },
  { minutesAgo: 31, status: 'PREPARING', basket: 'wholecake' }, { minutesAgo: 17, status: 'PREPARING', basket: 'cafe' },
  { minutesAgo: 7, status: 'CONFIRMED', basket: 'treats' }, { minutesAgo: 2, status: 'CONFIRMED', basket: 'custom' },
];
for (const l of LIVE_PLAN) drafts.push({ at: new Date(ANCHOR.getTime() - l.minutesAgo * MIN), basket: l.basket, live: true });
drafts.sort((a, b) => a.at.getTime() - b.at.getTime());

// Who placed each order: new and returning customers interleaved; big-quota customers start early.
const placed = new Map<string, number>();
const lastAt = new Map<string, number>();
const notStarted = new Set(customers.map((c) => c.id));
const started = new Set<string>();
const remaining = (id: string) => quota.get(id)! - (placed.get(id) ?? 0);
for (const [i, d] of drafts.entries()) {
  const progress = i / drafts.length;
  const returning = [...started].filter((id) => remaining(id) > 0);
  const R = returning.reduce((s, id) => s + remaining(id), 0);
  const N = notStarted.size;
  const useNew = N > 0 && (returning.length === 0 || rnd() < N / (N + R * 0.9));
  let id: string;
  if (useNew) {
    id = weighted([...notStarted], (c) => quota.get(c)! ** (1.6 * (1 - progress)));
    notStarted.delete(id); started.add(id);
  } else {
    const daysLeft = Math.max(1, (ANCHOR.getTime() - d.at.getTime()) / DAY);
    id = weighted(returning, (c) => {
      const gap = (d.at.getTime() - (lastAt.get(c) ?? 0)) / DAY;
      const expected = daysLeft / (remaining(c) + 1);
      return remaining(c) * Math.min(1, Math.max(0.02, gap / Math.max(3, expected)));
    });
  }
  placed.set(id, (placed.get(id) ?? 0) + 1);
  lastAt.set(id, d.at.getTime());
  d.customerId = id;
}
const C = new Map(customers.map((c) => [c.id, c]));

const CANCEL_REASONS = ['Customer changed plans', 'Ordered by mistake', 'Address outside the delivery area', 'Customer asked to cancel: guests postponed', 'Duplicate order'];
const FAIL_REASONS = ['Declined by the bank', 'UPI request expired', 'Payment cancelled by the customer', 'Card authentication failed'];

const orders: SeedOrder[] = [];
const payments: SeedPayment[] = [];
const refunds: SeedRefund[] = [];
const customCakes: SeedCustomCake[] = [];
const cancelReasonByOrder = new Map<string, string>();
const lateByOrder = new Map<string, number>();
let paySeq = 0, refundSeq = 0;
const ref = (n: number) => `SIM-${(n * 7919 + 104729).toString(36).toUpperCase()}`;

drafts.forEach((d, index) => {
  const id = `TRS-${pad(8142 + index, 5)}`;
  const cust = C.get(d.customerId!)!;
  const { lines } = makeBasket(startOfDay(d.at), d.basket);
  const hasCustom = lines.some((l) => l.custom);
  const totals = calcTotals(lines);
  let method: PaymentMethod = chance(0.8) ? cust.preferredMethod : weighted(['UPI', 'Card', 'COD'] as PaymentMethod[], (m) => (m === 'UPI' ? 55 : m === 'Card' ? 20 : 25));
  if (hasCustom && method === 'COD') method = 'UPI'; // custom cakes are paid for when ordered
  // Slot: ASAP, a window today (or tomorrow if it has passed), or a dated slot for custom cakes.
  let slot = 'As soon as possible';
  if (hasCustom) {
    const lead = Math.max(...lines.map((l) => l.custom?.productionHours ?? 0));
    const options = slotsAfter(d.at, lead, 6);
    const recent = ANCHOR.getTime() - d.at.getTime() < 5 * DAY;
    slot = options[Math.min(options.length - 1, recent ? int(2, 5) : weighted([0, 1, 2, 3, 4, 5], (k) => [4, 3, 2, 2, 1, 1][k]))].label;
  } else if (!d.live ? chance(0.4) : chance(0.25)) {
    const minutes = parts(d.at).h * 60 + parts(d.at).mi;
    const windows = ['10:00–12:00', '14:00–16:00', '18:00–20:00'];
    const later = windows.filter((w) => Number(w.slice(0, 2)) * 60 > minutes + 45);
    slot = later.length ? pick(later) : pick(windows);
  }
  const live = d.live ? LIVE_PLAN.find((l) => Math.abs(ANCHOR.getTime() - l.minutesAgo * MIN - d.at.getTime()) < MIN)! : null;
  const base: Order = {
    id, createdAt: iso(d.at), customer: { name: cust.name, phone: cust.phone, email: cust.email },
    address: cust.address, city: 'Bengaluru', pin: cust.pin, slot, paymentMethod: method,
    paymentStatus: method === 'COD' ? 'DUE' : 'PAID', subtotal: totals.subtotal, delivery: totals.delivery, total: totals.total,
    status: 'CONFIRMED', history: [{ status: 'NEW', at: iso(d.at) }, { status: 'CONFIRMED', at: iso(d.at) }], items: lines, source: 'sample',
    ...(method !== 'COD' ? { paymentReference: ref(index + 1) } : {}),
    ...(chance(0.12) ? { instructions: pick(['Please call on arrival', 'Leave with security at the gate', 'Ring the bell twice, baby sleeping', 'Deliver to the back entrance', 'Gate code at the lobby, please call']) } : {}),
  };

  // Timeline: when each step happened, using the app's own slot and prep rules.
  const prep = prepTarget(base);
  const start = requiredBy(base);
  const prepStart = hasCustom ? new Date(Math.max(d.at.getTime() + 30 * MIN, start.getTime() - prep * MIN + int(-30, 20) * MIN))
    : slot === 'As soon as possible' ? new Date(d.at.getTime() + int(2, 14) * MIN) : new Date(Math.max(d.at.getTime() + 2 * MIN, start.getTime() - (prep + int(10, 30)) * MIN));
  const ready = new Date(prepStart.getTime() + (hasCustom ? prep - int(10, 40) : prep + int(-2, 8)) * MIN);
  const out = new Date(ready.getTime() + int(4, 22) * MIN);
  const late = !d.live && chance(0.05) ? int(25, 80) : 0;
  const delivered = new Date(Math.max(out.getTime() + int(18, 38) * MIN, slot.includes('–') ? Math.min(deliverBy(base).getTime() - 5 * MIN, out.getTime() + 38 * MIN) : 0) + late * MIN);
  if (late) lateByOrder.set(id, late);
  const steps: [OrderStatus, Date][] = [['PREPARING', prepStart], ['READY', ready], ['OUT_FOR_DELIVERY', out], ['DELIVERED', delivered]];

  let status: OrderStatus = 'CONFIRMED';
  const history = [...base.history];
  if (live) {
    // Live board: steps squeezed into the time since the order was placed.
    const target = live.status;
    const reached = ['CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'].indexOf(target);
    const span = live.minutesAgo;
    for (let s = 1; s <= reached; s += 1) history.push({ status: (['CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'] as OrderStatus[])[s], at: iso(new Date(d.at.getTime() + Math.round((span * s) / (reached + 1)) * MIN)) });
    status = target;
  } else {
    for (const [s, at] of steps) { if (at <= ANCHOR) { history.push({ status: s, at: iso(at) }); status = s; } }
  }

  // Cancellations: about 4.5% of past orders, before they leave with the rider.
  const cancellable = !live && status === 'DELIVERED' && chance(0.045);
  if (cancellable) {
    const stage = chance(0.6) ? 'CONFIRMED' : 'PREPARING';
    const at = stage === 'CONFIRMED' ? new Date(d.at.getTime() + int(5, 40) * MIN) : new Date(prepStart.getTime() + int(3, 12) * MIN);
    history.splice(stage === 'CONFIRMED' ? 2 : 3);
    history.push({ status: 'CANCELLED', at: iso(at) });
    status = 'CANCELLED';
    cancelReasonByOrder.set(id, pick(CANCEL_REASONS));
  }

  let paymentStatus: PaymentStatus = base.paymentStatus;
  if (status === 'DELIVERED' && method === 'COD') paymentStatus = 'PAID';
  if (status === 'CANCELLED') paymentStatus = method === 'COD' ? 'VOID' : 'REFUNDED';
  const order: SeedOrder = { ...base, status, history, paymentStatus, customerId: cust.id, ...(live ? { liveOffsetMin: live.minutesAgo } : {}) };

  // Payments: an occasional failed first attempt, then the one that went through.
  const failures = method !== 'COD' && chance(0.045) ? (chance(0.2) ? 2 : 1) : 0;
  for (let f = 0; f < failures; f += 1) {
    paySeq += 1;
    const at = new Date(d.at.getTime() - (failures - f) * int(2, 6) * MIN);
    payments.push({ id: `PAY-${pad(paySeq, 6)}`, orderId: id, customerId: cust.id, provider: 'simulated', method, status: 'FAILED', amount: order.total, attempt: f + 1, reference: null, failureReason: pick(FAIL_REASONS), createdAt: iso(at), capturedAt: null, refundedAmount: 0, refunds: [] });
  }
  paySeq += 1;
  const deliveredAt = history.find((h) => h.status === 'DELIVERED')?.at ?? null;
  const pay: SeedPayment = {
    id: `PAY-${pad(paySeq, 6)}`, orderId: id, customerId: cust.id, provider: method === 'COD' ? 'cod' : 'simulated', method,
    status: method === 'COD' ? (status === 'DELIVERED' ? 'CAPTURED' : status === 'CANCELLED' ? 'CANCELLED' : 'CREATED') : 'CAPTURED',
    amount: order.total, attempt: failures + 1, reference: order.paymentReference ?? null, failureReason: null, createdAt: iso(d.at),
    capturedAt: method === 'COD' ? (status === 'DELIVERED' ? deliveredAt : null) : iso(new Date(d.at.getTime() + int(5, 40) * 1000)), refundedAmount: 0, refunds: [],
  };
  if (status === 'CANCELLED' && method !== 'COD') {
    const cancelAt = new Date(history[history.length - 1].at);
    const recent = ANCHOR.getTime() - cancelAt.getTime() < 2 * DAY;
    refundSeq += 1;
    const r: SeedRefund = { id: `RFD-${pad(refundSeq, 4)}`, paymentId: pay.id, orderId: id, amount: order.total, reason: `Order cancelled: ${cancelReasonByOrder.get(id)}`, status: recent ? 'PENDING' : 'PROCESSED', issueId: null, by: pick(['staff-manager', 'staff-owner', 'staff-admin']), createdAt: iso(new Date(cancelAt.getTime() + int(10, 90) * MIN)), processedAt: recent ? null : iso(new Date(cancelAt.getTime() + int(1, 4) * DAY)) };
    pay.refunds.push(r); refunds.push(r);
    pay.refundedAmount = r.status === 'PROCESSED' ? r.amount : 0;
    pay.status = r.status === 'PROCESSED' ? 'REFUNDED' : 'REFUND_PENDING';
    order.paymentStatus = r.status === 'PROCESSED' ? 'REFUNDED' : 'REFUND_PENDING';
  }
  payments.push(pay);
  orders.push(order);

  for (const l of lines) if (l.custom) {
    const occ = d.basket === 'custom' ? (occasionOn(d.at)?.tag === 'valentine' ? 'valentine' : 'celebration') : 'celebration';
    customCakes.push({ id: l.custom.designId, orderId: id, customerId: cust.id, lineId: l.lineId, occasion: occ, title: l.custom.title, message: l.custom.config.message.text, config: l.custom.config, lines: l.custom.lines, productionHours: l.custom.productionHours, price: l.unitPrice, priceVersion: l.custom.priceVersion, slot, createdAt: iso(d.at) });
  }
});

// Custom cake occasions from their messages (kept with the design record for the admin).
for (const cc of customCakes) {
  const m = cc.message.toLowerCase();
  cc.occasion = /birthday|turns|th,/.test(m) ? 'Birthday' : /anniversary|years|forever/.test(m) ? 'Anniversary' : /mine|love|valentine/.test(m) ? 'Valentine’s' : /baby|little one/.test(m) ? 'New baby' : /miss|luck|farewell/.test(m) ? 'Farewell' : /congrat|well done|cheers/.test(m) ? 'Celebration' : 'Celebration';
}
// A design id is unique per configuration; two orders of the exact same design share it. Keep one record per design.
const designs = new Map<string, SeedCustomCake>();
for (const cc of customCakes) if (!designs.has(cc.id)) designs.set(cc.id, cc);

// ───────────────────────────── Customers: reconcile from their orders ─────────────────────────────

const refundsByOrder = new Map<string, number>();
for (const r of refunds) if (r.status === 'PROCESSED') refundsByOrder.set(r.orderId, (refundsByOrder.get(r.orderId) ?? 0) + r.amount);
function reconcileCustomers() {
  for (const c of customers) {
    const mine = orders.filter((o) => o.customerId === c.id);
    c.orderIds = mine.map((o) => o.id);
    const kept = mine.filter((o) => o.status !== 'CANCELLED');
    c.orderCount = kept.length;
    c.totalSpend = kept.reduce((s, o) => s + o.total, 0);
    c.refunded = mine.reduce((s, o) => s + (refundsByOrder.get(o.id) ?? 0), 0);
    c.firstOrderAt = mine[0]?.createdAt ?? null;
    c.lastOrderAt = mine[mine.length - 1]?.createdAt ?? null;
    c.createdAt = c.firstOrderAt ? iso(new Date(new Date(c.firstOrderAt).getTime() - int(1, 20) * MIN)) : iso(ANCHOR);
    c.customCakeIds = [...new Set(mine.flatMap((o) => o.items.filter((l) => l.custom).map((l) => l.custom!.designId)))];
    c.tags = [
      ...(c.orderCount >= 5 ? ['Regular'] : []), ...(c.customCakeIds.length ? ['Custom cakes'] : []),
      ...(mine.some((o) => o.items.some((l) => l.product.category === 'Bread')) && mine.length >= 3 ? ['Bread weekly'] : []),
    ];
  }
}

// ───────────────────────────── Issues and partial refunds ─────────────────────────────

const issues: SeedIssue[] = [];
let issueSeq = 0;
const delivered = orders.filter((o) => o.status === 'DELIVERED' && !o.liveOffsetMin);
const at = (o: SeedOrder, s: OrderStatus) => new Date(o.history.find((h) => h.status === s)?.at ?? o.createdAt);
function addIssue(o: SeedOrder, category: IssueCategory, priority: IssuePriority, opened: Date, description: string, inbound: string, opts: { refund?: number; resolution: string; reply: string; note: string }) {
  if (opened > ANCHOR) return;
  issueSeq += 1;
  const id = `ISS-${pad(issueSeq, 4)}`;
  const age = (ANCHOR.getTime() - opened.getTime()) / DAY;
  const status: IssueStatus = age > 6 ? (chance(0.7) ? 'CLOSED' : 'RESOLVED') : age > 3 ? pick(['RESOLVED', 'WAITING_CUSTOMER', 'INVESTIGATING']) : pick(['OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'WAITING_CUSTOMER']);
  const assignee = status === 'OPEN' ? null : pick(['staff-support', 'staff-manager', 'staff-support']);
  const replyAt = new Date(opened.getTime() + int(8, 70) * MIN);
  const resolvedAt = status === 'RESOLVED' || status === 'CLOSED' ? new Date(opened.getTime() + int(2, 30) * HOUR) : null;
  let refundId: string | null = null;
  if (opts.refund && resolvedAt) {
    const pay = payments.find((p) => p.orderId === o.id && p.status !== 'FAILED')!;
    if (pay.method !== 'COD' && pay.refundedAmount + opts.refund < pay.amount) {
      refundSeq += 1;
      const r: SeedRefund = { id: `RFD-${pad(refundSeq, 4)}`, paymentId: pay.id, orderId: o.id, amount: opts.refund, reason: `Partial refund: ${opts.resolution}`, status: 'PROCESSED', issueId: id, by: 'staff-manager', createdAt: iso(resolvedAt), processedAt: iso(new Date(resolvedAt.getTime() + int(1, 3) * DAY)) };
      pay.refunds.push(r); refunds.push(r); pay.refundedAmount += r.amount; pay.status = 'PARTIALLY_REFUNDED';
      refundsByOrder.set(o.id, (refundsByOrder.get(o.id) ?? 0) + r.amount);
      refundId = r.id;
    }
  }
  issues.push({
    id, orderId: o.id, customerId: o.customerId, category, priority, status, description, assignedTo: assignee,
    internalNotes: assignee ? [{ by: assignee, at: iso(new Date(replyAt.getTime() + 2 * MIN)), body: opts.note }] : [],
    messages: [
      { direction: 'inbound', channel: pick(['whatsapp', 'whatsapp', 'email', 'phone']), body: inbound, at: iso(opened), by: null },
      ...(assignee ? [{ direction: 'outbound' as const, channel: 'whatsapp' as const, body: opts.reply, at: iso(replyAt), by: assignee }] : []),
    ],
    refundId, createdAt: iso(opened), updatedAt: iso(resolvedAt ?? replyAt), resolvedAt: resolvedAt ? iso(resolvedAt) : null, resolution: resolvedAt ? opts.resolution : null,
  });
}
// Late deliveries → delay complaints (about half of them).
for (const o of delivered.filter((x) => lateByOrder.has(x.id))) {
  if (!chance(0.42)) continue;
  const late = lateByOrder.get(o.id)!;
  addIssue(o, 'DELIVERY_DELAY', late > 60 ? 'HIGH' : 'NORMAL', new Date(at(o, 'OUT_FOR_DELIVERY').getTime() + int(30, 50) * MIN), `Order arrived about ${late} minutes after the expected time.`,
    pick(['Still waiting for my order, it was supposed to be here by now.', 'Rider seems stuck, any update?', 'Order is quite late today.']),
    { resolution: 'Rider was delayed by traffic; apologised and added a complimentary cookie to the next order.', reply: 'So sorry for the wait. Our rider is a few minutes away; we’ve noted this and will make it up to you.', note: 'Rider stuck on Old Airport Road. Offered a cookie on next order.' });
}
// Missing and quality complaints with partial refunds.
for (const o of delivered.filter((x) => x.paymentMethod !== 'COD' && x.items.length >= 2)) {
  if (!chance(0.012)) continue;
  const line = o.items[o.items.length - 1];
  addIssue(o, 'MISSING_ITEM', 'NORMAL', new Date(at(o, 'DELIVERED').getTime() + int(10, 90) * MIN), `${line.qty} × ${line.product.name} missing from the bag.`,
    `The ${line.product.name} wasn't in the bag.`, { refund: line.unitPrice * line.qty, resolution: `Refunded the missing ${line.product.name}.`, reply: 'Apologies, that was our packing miss. We’ve refunded it to your original payment method.', note: 'Packing checklist missed the last line. Refund raised.' });
}
for (const o of delivered.filter((x) => x.paymentMethod !== 'COD')) {
  if (!chance(0.008)) continue;
  const line = o.items[0];
  const half = Math.round((line.unitPrice * line.qty) / 2);
  addIssue(o, 'QUALITY', 'NORMAL', new Date(at(o, 'DELIVERED').getTime() + int(30, 240) * MIN), `Customer says the ${line.product.name} was not up to the usual standard.`,
    pick([`The ${line.product.name} was a bit dry today.`, `${line.product.name} looked squashed when it arrived.`]), { refund: half, resolution: `Refunded half of the ${line.product.name}; feedback shared with the kitchen.`, reply: 'Thank you for telling us. We’ve refunded half the item and passed this to the kitchen.', note: 'Shared with the morning bake team.' });
}
// Payment queries on orders that had a failed attempt.
for (const o of orders.filter((x) => payments.some((p) => p.orderId === x.id && p.status === 'FAILED') && x.status !== 'CANCELLED' && !x.liveOffsetMin)) {
  if (!chance(0.18)) continue;
  addIssue(o, 'PAYMENT', 'HIGH', new Date(new Date(o.createdAt).getTime() + int(20, 180) * MIN), 'Customer reports being charged for a failed attempt as well as the order.',
    'Money was debited twice, once when the payment failed.', { resolution: 'The failed attempt was never captured; the bank reversed the hold within 3 working days.', reply: 'The first attempt failed and was never captured. Your bank will release the hold within 3 working days.', note: 'Checked the simulated gateway: attempt 1 FAILED, not captured.' });
}
// Custom cake change requests before the bake.
for (const o of orders.filter((x) => x.items.some((l) => l.custom) && x.status !== 'CANCELLED')) {
  if (!chance(0.07)) continue;
  addIssue(o, 'CUSTOM_CAKE', 'NORMAL', new Date(new Date(o.createdAt).getTime() + int(1, 10) * HOUR), 'Customer asked to change the message on the cake.',
    'Can we change the message to say “Happy Birthday from all of us”?', { resolution: 'Message updated on the production sheet before the bake.', reply: 'Done, we’ve updated the message on your cake.', note: 'Updated message on the production sheet; told the baker.' });
}
// Refund questions on cancelled orders.
for (const o of orders.filter((x) => x.status === 'CANCELLED' && x.paymentMethod !== 'COD')) {
  if (!chance(0.3)) continue;
  addIssue(o, 'REFUND_REQUEST', 'NORMAL', new Date(new Date(o.history[o.history.length - 1].at).getTime() + int(1, 20) * HOUR), 'Customer asked when the refund for the cancelled order will arrive.',
    'When will I get my refund for the cancelled order?', { resolution: 'Refund processed to the original payment method.', reply: 'Your refund has been processed; it usually reaches your account in 3–5 working days.', note: 'Refund was already raised at cancellation.' });
}
// Wrong item.
for (const o of delivered) {
  if (!chance(0.004)) continue;
  addIssue(o, 'WRONG_ITEM', 'NORMAL', new Date(at(o, 'DELIVERED').getTime() + int(10, 60) * MIN), 'A different pastry was delivered than the one ordered.', 'I got an almond croissant instead of what I ordered.',
    { resolution: 'Replacement sent with the next order; apologised.', reply: 'Sorry about the mix-up. We’ll send the right one with your next order, on us.', note: 'Labels swapped at packing. Replacement noted on the customer profile.' });
}
// The current queue: recent orders with issues still being worked on.
const recentDelivered = delivered.filter((o) => ANCHOR.getTime() - at(o, 'DELIVERED').getTime() < 4 * DAY && !issues.some((x) => x.orderId === o.id));
const queue: [IssueCategory, IssuePriority, string, string, string][] = [
  ['MISSING_ITEM', 'NORMAL', 'Customer says one item was missing from the bag.', 'One of the items is missing from my order.', 'Checking the packing photo before refunding.'],
  ['QUALITY', 'HIGH', 'Customer reports the cream on a cake slice had split.', 'The cream on the slice looked split when it arrived.', 'Asked the customer for a photo; checking the walk-in temperature log.'],
  ['DELIVERY_DELAY', 'NORMAL', 'Order arrived after the delivery window.', 'Order came 40 minutes after the window.', 'Rider was on a long route; reviewing route batching.'],
  ['WRONG_ITEM', 'NORMAL', 'A different drink was delivered.', 'I ordered a cappuccino but got a latte.', 'Barista sticker mix-up; arranging a replacement.'],
  ['OTHER', 'LOW', 'Customer asked for a GST invoice with their company name.', 'Can you send an invoice with my company name on it?', 'Waiting for the company name and GSTIN from the customer.'],
];
for (const [k, [category, priority, description, inbound, noteText]] of queue.entries()) {
  const o = recentDelivered[Math.floor((k * recentDelivered.length) / queue.length)];
  if (!o) continue;
  issueSeq += 1;
  const opened = new Date(Math.min(ANCHOR.getTime() - int(20, 600) * MIN, at(o, 'DELIVERED').getTime() + int(15, 120) * MIN));
  const status: IssueStatus = (['OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'WAITING_CUSTOMER', 'INVESTIGATING'] as IssueStatus[])[k];
  const assignee = status === 'OPEN' ? null : (k % 2 ? 'staff-manager' : 'staff-support');
  const replyAt = new Date(opened.getTime() + int(6, 25) * MIN);
  issues.push({
    id: `ISS-Q${k}`, orderId: o.id, customerId: o.customerId, category, priority, status, description, assignedTo: assignee,
    internalNotes: assignee ? [{ by: assignee, at: iso(new Date(replyAt.getTime() + 2 * MIN)), body: noteText }] : [],
    messages: [{ direction: 'inbound', channel: 'whatsapp', body: inbound, at: iso(opened), by: null }, ...(assignee ? [{ direction: 'outbound' as const, channel: 'whatsapp' as const, body: 'Thanks for letting us know, we’re looking into it now.', at: iso(replyAt), by: assignee }] : [])],
    refundId: null, createdAt: iso(opened), updatedAt: iso(assignee ? replyAt : opened), resolvedAt: null, resolution: null,
  });
}
issues.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
// Renumber in date order with one old → new map (renaming one by one would let ids collide).
const renumber = new Map(issues.map((x, i) => [x.id, `ISS-${pad(i + 1, 4)}`]));
for (const r of refunds) if (r.issueId) r.issueId = renumber.get(r.issueId) ?? r.issueId;
for (const x of issues) x.id = renumber.get(x.id)!;
reconcileCustomers();
for (const x of issues) C.get(x.customerId)!.issueIds.push(x.id);

// ───────────────────────────── Invoices ─────────────────────────────

const invoices: Invoice[] = orders.filter((o) => o.status !== 'CANCELLED').map((o) => {
  const inv = buildInvoice(o, new Date(new Date(o.createdAt).getTime() + int(20, 150) * 1000));
  return { ...inv, revision: 1 };
});

// ───────────────────────────── Automations (last 30 days) ─────────────────────────────

const jobs: Job[] = [];
const log: AutomationEvent[] = [];
let logSeq = 0;
const since = ANCHOR.getTime() - 30 * DAY;
function logEvent(type: AutomationEvent['type'], orderId: string, when: Date, status: AutomationEvent['status'], detail?: string) {
  if (when.getTime() < ANCHOR.getTime() - 7 * DAY) return; // keep the log short: last 7 days
  logSeq += 1;
  log.push({ id: `ae-seed-${pad(logSeq, 5)}`, type, clientId: null, sessionId: null, orderId, timestamp: iso(when), status, ...(detail ? { detail } : {}) });
}
for (const o of orders.filter((x) => new Date(x.createdAt).getTime() >= since)) {
  const created = new Date(o.createdAt);
  const make = (kind: Job['kind'], topic: string, when: Date) => {
    const job = newJob(kind, o.id, topic, when);
    const failSoft = chance(kind === 'invoice' ? 0.03 : 0.04);
    const failHard = kind === 'whatsapp' && chance(0.012);
    const queued = ANCHOR.getTime() - when.getTime() < 2 * MIN;
    job.attempts = queued ? 0 : failHard ? 3 : failSoft ? 2 : 1;
    job.status = queued ? 'requested' : failHard ? 'failed' : 'succeeded';
    job.lastError = failHard ? 'Recipient is not on WhatsApp' : failSoft ? (kind === 'invoice' ? 'Invoice service timed out' : 'Provider timeout') : null;
    job.updatedAt = iso(new Date(when.getTime() + (failSoft ? 3200 : 900)));
    job.result = job.status === 'succeeded' ? (kind === 'invoice' ? { invoiceNumber: invoices.find((i) => i.orderId === o.id)?.invoiceNumber } : { to: maskPhone(o.customer.phone), ...(ANCHOR.getTime() - when.getTime() < 3 * DAY ? { text: whatsappMessage(o, topic) } : {}) }) : null;
    jobs.push(job);
    logEvent(kind === 'invoice' ? 'invoice.requested' : 'whatsapp.requested', o.id, when, 'ok', topic);
    if (failSoft) logEvent(kind === 'invoice' ? 'invoice.retrying' : 'whatsapp.retrying', o.id, new Date(when.getTime() + 900), 'retry', job.lastError ?? undefined);
    if (job.status === 'succeeded') logEvent(kind === 'invoice' ? 'invoice.generated' : 'whatsapp.sent', o.id, new Date(when.getTime() + (failSoft ? 3200 : 900)), 'ok', topic);
    if (job.status === 'failed') logEvent('whatsapp.failed', o.id, new Date(when.getTime() + 4800), 'failed', job.lastError ?? undefined);
  };
  if (o.status !== 'CANCELLED') make('invoice', 'invoice', new Date(created.getTime() + 20 * 1000));
  make('whatsapp', 'confirmation', new Date(created.getTime() + 25 * 1000));
  for (const h of o.history) if (NOTIFY_STATUSES.includes(h.status)) make('whatsapp', `status:${h.status}`, new Date(new Date(h.at).getTime() + 15 * 1000));
}
// One live order's latest message is still retrying.
const lastLive = orders.filter((o) => o.liveOffsetMin && o.status === 'READY').pop();
if (lastLive) { const j = jobs.filter((x) => x.orderId === lastLive.id && x.kind === 'whatsapp').pop(); if (j) { j.status = 'retrying'; j.attempts = 2; j.lastError = 'Provider timeout'; j.result = null; } }

// ───────────────────────────── Inventory: a day-by-day simulation ─────────────────────────────

const ING = initialInventory.map((i) => ({ ...i }));
const PERISHABLE = new Set(['milk', 'berries', 'mushrooms', 'spinach', 'paneer', 'cream-cheese', 'mascarpone', 'yogurt', 'sourdough', 'feta']);
const END_LOW: Record<string, number> = { beans: 0.62, vanilla: 0.7, 'almond-flour': 0.68, matcha: 0.4, pistachio: 0.8 }; // fraction of reorder point at the anchor
const level = new Map<string, number>(ING.map((i) => [i.id, i.reorderPoint * 3]));
const movements: SeedMovement[] = [];
let mvSeq = 0;
const mv = (m: Omit<SeedMovement, 'id'>) => { mvSeq += 1; movements.push({ id: `MV-${pad(mvSeq, 6)}`, ...m }); };
const ordersByDay = new Map<string, SeedOrder[]>();
for (const o of orders) if (!(o.status === 'CANCELLED' && !o.history.some((h) => h.status === 'PREPARING'))) {
  const k = dayKey(new Date(o.createdAt)); (ordersByDay.get(k) ?? ordersByDay.set(k, []).get(k)!).push(o);
}
const lowDips: { id: string; at: Date; restockAt: Date | null; critical: boolean }[] = [];
const restockDue = new Map<string, boolean>();
const weekly = new Map<string, { online: number; counter: number; orderIds: string[]; at: Date }>();
const DETAIL_FROM = ANCHOR.getTime() - 56 * DAY;
DAYS.forEach((day, di) => {
  const isAnchorDay = day.getTime() === ANCHOR_DAY.getTime();
  const lastDays = ANCHOR_DAY.getTime() - day.getTime() < 6 * DAY;
  // Planned lows: the last delivery before the final six days is sized so that normal use
  // (counter estimate plus the online orders actually placed) ends near the planned level today.
  if (ANCHOR_DAY.getTime() - day.getTime() === 6 * DAY) {
    for (const i of ING.filter((x) => END_LOW[x.id])) {
      let expected = 0;
      for (let k = 0; k < 6; k += 1) {
        const d2 = new Date(day.getTime() + k * DAY);
        expected += i.reorderPoint * 0.34 * (DOW[parts(d2).dow] / 1.05) + (needsFor((ordersByDay.get(dayKey(d2)) ?? []).flatMap((o) => o.items))[i.id] ?? 0);
      }
      expected += i.reorderPoint * 0.34 * ((ANCHOR.getTime() - ANCHOR_DAY.getTime()) / DAY) + (needsFor((ordersByDay.get(dayKey(ANCHOR_DAY)) ?? []).flatMap((o) => o.items))[i.id] ?? 0);
      const amount = round3(Math.max(0, i.reorderPoint * END_LOW[i.id] + expected - level.get(i.id)!));
      if (amount > 0) {
        mv({ at: iso(new Date(day.getTime() + 8 * HOUR)), ingredientId: i.id, delta: amount, reason: 'Restock', note: 'Supplier delivery (smaller lot: supplier short)', actor: 'staff-manager' });
        level.set(i.id, round3(level.get(i.id)! + amount));
      }
      restockDue.set(i.id, false);
    }
  }
  // Morning deliveries for anything that ran low yesterday.
  for (const i of ING) {
    if (!restockDue.get(i.id)) continue;
    if (END_LOW[i.id] && lastDays) continue; // the next delivery for these is due after the anchor
    if (i.id === 'mango-pulp' && !inSeason('mango-danish', day)) continue;
    const par = i.reorderPoint * (3 + rnd() * 0.6);
    const amount = round3(Math.max(0, par - level.get(i.id)!));
    if (amount > 0) {
      const when = new Date(day.getTime() + int(7 * 60, 9 * 60 + 30) * MIN);
      mv({ at: iso(when), ingredientId: i.id, delta: amount, reason: 'Restock', note: pick(['Supplier delivery', 'Weekly order', 'Supplier delivery, invoice checked']), actor: pick(['staff-manager', 'staff-kitchen-am', 'staff-kitchen']) });
      level.set(i.id, round3(level.get(i.id)! + amount));
      const dip = [...lowDips].reverse().find((x) => x.id === i.id && !x.restockAt); if (dip) dip.restockAt = when;
    }
    restockDue.set(i.id, false);
  }
  // Usage: online orders (exact, from recipes) and the counter (walk-in sales, estimated).
  const todays = ordersByDay.get(dayKey(day)) ?? [];
  const online = needsFor(todays.flatMap((o) => o.items));
  const dowF = DOW[parts(day).dow] / 1.05;
  const endOfUsage = isAnchorDay ? (ANCHOR.getTime() - day.getTime()) / DAY : 1; // partial day on the anchor
  for (const i of ING) {
    const seasonal = i.id === 'mango-pulp' ? (inSeason('mango-danish', day) ? 1 : 0) : i.id === 'dried-fruit' ? (inSeason('plum-cake', day) ? 1.6 : 0.6) : 1;
    let counter = round3(i.reorderPoint * 0.34 * dowF * seasonal * (0.8 + rnd() * 0.4) * endOfUsage);
    const on = round3(online[i.id] ?? 0);
    // Planned lows never run out: the last day's use stops short of empty (still realistic: rationed).
    if (END_LOW[i.id] && lastDays) counter = round3(Math.max(0, Math.min(counter, level.get(i.id)! - on - i.reorderPoint * 0.15)));
    if (on > level.get(i.id)!) {
      // The shop never takes an order it can't make: the kitchen tops up the same morning.
      const topUp = round3(i.reorderPoint * 3 - level.get(i.id)! + on);
      mv({ at: iso(new Date(day.getTime() + 7 * HOUR + 45 * MIN)), ingredientId: i.id, delta: topUp, reason: 'Restock', note: 'Same-day top-up from the market', actor: 'staff-kitchen-am' });
      level.set(i.id, round3(level.get(i.id)! + topUp));
    }
    const total = round3(Math.min(level.get(i.id)!, on + counter));
    const usedOnline = round3(Math.min(on, total));
    const usedCounter = round3(total - usedOnline);
    level.set(i.id, round3(level.get(i.id)! - total));
    const ids = total > 0 ? todays.filter((o) => o.items.some((l) => (needsFor([l])[i.id] ?? 0) > 0)).map((o) => o.id) : [];
    if (day.getTime() >= DETAIL_FROM) {
      if (total > 0) mv({ at: iso(new Date(day.getTime() + (isAnchorDay ? ANCHOR.getTime() - day.getTime() - MIN : 22 * HOUR))), ingredientId: i.id, delta: -total, reason: 'Sale', note: `Online ${usedOnline} · counter ${usedCounter} (estimate)`, online: usedOnline, counter: usedCounter, orderIds: ids, period: 'day' });
    } else {
      const wk = `${i.id}:${Math.floor(di / 7)}`;
      if (total > 0) {
        const w = weekly.get(wk) ?? { online: 0, counter: 0, orderIds: [], at: day };
        w.online = round3(w.online + usedOnline); w.counter = round3(w.counter + usedCounter); w.orderIds.push(...ids); w.at = day;
        weekly.set(wk, w);
      }
      // Close the week on its last day, or before the detailed (daily) window starts, used or not.
      const endOfWeek = di % 7 === 6 || DAYS[di + 1]?.getTime() >= DETAIL_FROM;
      const w = weekly.get(wk);
      if (endOfWeek && w) { mv({ at: iso(new Date(day.getTime() + 22 * HOUR)), ingredientId: i.id, delta: -round3(w.online + w.counter), reason: 'Sale', note: `Week: online ${w.online} · counter ${w.counter} (estimate)`, online: w.online, counter: w.counter, orderIds: w.orderIds, period: 'week' }); weekly.delete(wk); }
    }
    // Perishables: occasional end-of-day wastage.
    if (PERISHABLE.has(i.id) && !isAnchorDay && chance(0.05) && level.get(i.id)! > i.reorderPoint * 0.5) {
      const waste = round3(Math.min(level.get(i.id)! * 0.15, i.reorderPoint * 0.2));
      if (waste > 0) { mv({ at: iso(new Date(day.getTime() + 21 * HOUR + 30 * MIN)), ingredientId: i.id, delta: -waste, reason: 'Wastage', note: pick(['Past best-before', 'Spoiled in the walk-in', 'Dropped tray', 'Quality check: discarded']), actor: pick(['staff-kitchen', 'staff-baker']) }); level.set(i.id, round3(level.get(i.id)! - waste)); }
    }
    if (level.get(i.id)! < i.reorderPoint * (END_LOW[i.id] ? 1 : 1.3) && !isAnchorDay) {
      restockDue.set(i.id, true);
      if (day.getTime() > ANCHOR.getTime() - 45 * DAY && level.get(i.id)! < i.reorderPoint) lowDips.push({ id: i.id, at: new Date(day.getTime() + 20 * HOUR), restockAt: null, critical: level.get(i.id)! <= i.reorderPoint / 2 });
    }
  }
  // Monthly stock count: small corrections.
  if (parts(day).d === 1 && !isAnchorDay) for (const i of ING) {
    if (!chance(0.4)) continue;
    const delta = round3(level.get(i.id)! * (rnd() * 0.06 - 0.03));
    if (delta !== 0 && level.get(i.id)! + delta >= 0) { mv({ at: iso(new Date(day.getTime() + 7 * HOUR)), ingredientId: i.id, delta, reason: 'Correction', note: 'Monthly stock count', actor: 'staff-manager' }); level.set(i.id, round3(level.get(i.id)! + delta)); }
  }
});
const ingredients: Ingredient[] = ING.map((i) => ({ ...i, onHand: round3(level.get(i.id)!), reserved: 0 }));
// Opening levels are what the history implies; the validator replays it.
movements.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));

// ───────────────────────────── Notifications ─────────────────────────────

const notifications: SeedNotification[] = [];
const note = (n: Omit<SeedNotification, 'id'>) => notifications.push({ id: '', ...n });
const ageState = (when: Date, resolved: Date | null): Pick<SeedNotification, 'state' | 'readAt' | 'resolvedAt'> => {
  if (resolved && resolved <= ANCHOR) return { state: 'RESOLVED', readAt: iso(new Date(when.getTime() + 20 * MIN)), resolvedAt: iso(resolved) };
  return ANCHOR.getTime() - when.getTime() > 3 * HOUR ? { state: 'READ', readAt: iso(new Date(when.getTime() + 25 * MIN)), resolvedAt: null } : { state: 'UNREAD', readAt: null, resolvedAt: null };
};
for (const d of lowDips.filter((x) => x.critical || !x.restockAt)) {
  const i = ING.find((x) => x.id === d.id)!;
  note({ type: 'LOW_STOCK', title: `${i.name} is ${d.critical ? 'critically ' : ''}low`, body: `Below the reorder point of ${i.reorderPoint} ${i.unit}.`, resourceType: 'ingredient', resourceId: i.id, href: `/admin/inventory?item=${i.id}`, createdAt: iso(d.at), ...ageState(d.at, d.restockAt) });
}
for (const i of ingredients.filter((x) => x.onHand <= x.reorderPoint && END_LOW[x.id])) {
  const when = new Date(ANCHOR.getTime() - int(30, 300) * MIN);
  if (!notifications.some((n) => n.resourceId === i.id && n.state !== 'RESOLVED')) note({ type: 'LOW_STOCK', title: `${i.name} is low`, body: `${i.onHand} ${i.unit} left, reorder point ${i.reorderPoint} ${i.unit}. Next delivery is due.`, resourceType: 'ingredient', resourceId: i.id, href: `/admin/inventory?item=${i.id}`, createdAt: iso(when), ...ageState(when, null) });
}
for (const p of payments.filter((x) => x.status === 'FAILED' && new Date(x.createdAt).getTime() > ANCHOR.getTime() - 30 * DAY)) {
  const when = new Date(p.createdAt);
  note({ type: 'PAYMENT_FAILURE', title: `Payment failed for ${p.orderId}`, body: `${p.method} · ${p.failureReason}. The customer retried successfully.`, resourceType: 'payment', resourceId: p.id, href: `/admin/payments?q=${p.orderId}`, createdAt: iso(when), ...ageState(when, new Date(when.getTime() + 10 * MIN)) });
}
for (const x of issues.filter((i) => new Date(i.createdAt).getTime() > ANCHOR.getTime() - 45 * DAY)) {
  const when = new Date(x.createdAt);
  note({ type: x.category === 'DELIVERY_DELAY' ? 'DELIVERY_DELAY' : 'ISSUE_CREATED', title: `${x.id}: ${x.category === 'DELIVERY_DELAY' ? 'delivery delay' : x.category.toLowerCase().replace('_', ' ')} on ${x.orderId}`, body: x.description, resourceType: 'issue', resourceId: x.id, href: `/admin/issues?issue=${x.id}`, createdAt: iso(when), ...ageState(when, x.resolvedAt ? new Date(x.resolvedAt) : null) });
}
for (const j of jobs.filter((x) => x.status === 'failed')) {
  const when = new Date(j.updatedAt);
  note({ type: 'AUTOMATION_FAILURE', title: `WhatsApp message failed for ${j.orderId}`, body: j.lastError ?? 'Failed after 3 attempts', resourceType: 'job', resourceId: j.id, href: '/admin/automations', createdAt: iso(when), ...ageState(when, ANCHOR.getTime() - when.getTime() > 2 * DAY ? new Date(when.getTime() + 6 * HOUR) : null) });
}
for (const o of orders.filter((x) => x.items.some((l) => l.custom) && (x.status === 'CONFIRMED' || x.status === 'PREPARING') && requiredBy(x).getTime() - ANCHOR.getTime() < 36 * HOUR)) {
  const when = new Date(ANCHOR.getTime() - int(20, 180) * MIN);
  note({ type: 'CUSTOM_CAKE_DEADLINE', title: `Custom cake for ${o.id} is due soon`, body: `Slot: ${o.slot}.`, resourceType: 'order', resourceId: o.id, href: `/admin/custom-cakes?order=${o.id}`, createdAt: iso(when), ...ageState(when, null) });
}
notifications.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
notifications.forEach((n, i) => { n.id = `NTF-${pad(i + 1, 4)}`; });

// ───────────────────────────── Analytics (daily) ─────────────────────────────

const failedByDay = new Map<string, number>();
for (const p of payments.filter((x) => x.status === 'FAILED')) failedByDay.set(dayKey(new Date(p.createdAt)), (failedByDay.get(dayKey(new Date(p.createdAt))) ?? 0) + 1);
const analyticsDays: SeedAnalyticsDay[] = DAYS.map((day) => {
  const k = dayKey(day);
  const placedToday = orders.filter((o) => dayKey(new Date(o.createdAt)) === k);
  const kept = placedToday.filter((o) => o.status !== 'CANCELLED');
  const customs = placedToday.filter((o) => o.items.some((l) => l.custom)).length;
  const conv = 0.021 + rnd() * 0.008;
  const partial = day.getTime() === ANCHOR_DAY.getTime() ? 0.62 : 1;
  const sessions = Math.max(placedToday.length * 12, Math.round(((placedToday.length + 0.6) / conv) * partial));
  const checkoutStarted = placedToday.length + (failedByDay.get(k) ?? 0) + Math.round(sessions * 0.012);
  const addToCart = Math.max(checkoutStarted, Math.round(checkoutStarted * (1.8 + rnd() * 0.5)));
  const productViews = Math.max(addToCart, Math.round(sessions * (2.3 + rnd() * 0.6)));
  const cakePlaygroundSessions = Math.max(customs, Math.round(sessions * (0.05 + rnd() * 0.02)));
  const recommendationImpressions = Math.round(productViews * 0.8);
  return {
    date: k, sessions, productViews, addToCart, checkoutStarted, paymentFailures: failedByDay.get(k) ?? 0, orders: kept.length, revenue: kept.reduce((s, o) => s + o.total, 0),
    searches: Math.round(sessions * (0.11 + rnd() * 0.05)), cakePlaygroundSessions, customCakeAdds: Math.max(customs, Math.round(cakePlaygroundSessions * 0.18)),
    recommendationImpressions, recommendationClicks: Math.round(recommendationImpressions * (0.045 + rnd() * 0.02)),
  };
});
const SEARCH_TERMS: [string, number, number][] = [
  ['croissant', 9, 4], ['chocolate cake', 8, 6], ['birthday cake', 8, 7], ['sourdough', 6, 3], ['cheesecake', 5, 1], ['filter coffee', 5, 1], ['eggless cake', 5, 0],
  ['coffee', 5, 4], ['gift box', 4, 3], ['brownie', 4, 1], ['puff', 4, 1], ['plum cake', 3, 1], ['red velvet', 3, 0], ['gluten free', 3, 0], ['vegan', 2, 6], ['macarons', 2, 1],
];
const totalSearches = analyticsDays.reduce((s, d) => s + d.searches, 0);
const searchWeight = SEARCH_TERMS.reduce((s, t) => s + t[1], 0);
const topSearches = SEARCH_TERMS.map(([term, w, results]) => ({ term, count: Math.round((totalSearches * 0.6 * w) / searchWeight), resultCount: results }));

// ───────────────────────────── Campaigns ─────────────────────────────

function campaign(id: string, name: string, description: string, start: Date, end: Date, featured: string[], status: SeedCampaign['status'], extra: Partial<SeedCampaign> = {}): SeedCampaign {
  const attributed = orders.filter((o) => o.status !== 'CANCELLED' && inRange(new Date(o.createdAt), start, end) && o.items.some((l) => featured.includes(l.product.id)));
  return {
    id, name, description, start: iso(start), end: iso(end), status, archived: false, audience: 'everyone', heroMediaId: null, featuredProductIds: featured,
    // Planned ahead: created and last edited before the dataset's 'now', even for future campaigns.
    category: null, cta: { label: 'Shop now', href: '/shop' }, priority: 2,
    createdAt: iso(new Date(Math.min(start.getTime() - 9 * DAY, ANCHOR.getTime() - 6 * DAY))), updatedAt: iso(new Date(Math.min(start.getTime() - 2 * DAY, ANCHOR.getTime() - 2 * DAY))),
    attributedOrderIds: attributed.map((o) => o.id),
    attributedRevenue: attributed.reduce((s, o) => s + o.items.filter((l) => featured.includes(l.product.id)).reduce((t, l) => t + l.unitPrice * l.qty, 0), 0),
    ...extra,
  };
}
const campaigns: SeedCampaign[] = [
  campaign('cmp-monsoon-2025', 'Monsoon chai and bakes', 'Masala chai, cardamom knots and paneer puffs for rainy evenings.', ist(2025, 7, 1), ist(2025, 8, 15, 23, 59), ['masala-chai', 'cardamom-knot', 'paneer-tikka-puff'], 'ENDED'),
  campaign('cmp-diwali-2025', 'Diwali gift boxes', 'Festive boxes and macarons, delivered across the city.', ist(2025, 9, 1), ist(2025, 9, 23, 23, 59), ['festive-gift-box', 'macaron-box', 'cookie-tin'], 'ENDED', { cta: { label: 'See gift boxes', href: '/shop' }, priority: 1 }),
  campaign('cmp-christmas-2025', 'Christmas at Tresor', 'Plum cake, butter cookie tins and hot chocolate for December.', ist(2025, 10, 25), ist(2025, 11, 31, 23, 59), ['plum-cake', 'cookie-tin', 'hot-chocolate'], 'ENDED', { priority: 1 }),
  campaign('cmp-valentine-2026', 'Valentine’s: hearts by hand', 'Heart-shaped custom cakes and the Rose Chocolate Truffle.', ist(2026, 1, 1), ist(2026, 1, 14, 23, 59), ['rose-chocolate-truffle', 'macaron-box'], 'ENDED', { cta: { label: 'Design a cake', href: '/customize' } }),
  campaign('cmp-mango-2026', 'Mango season', 'Alphonso mango danish and the mango passion cake, while the season lasts.', ist(2026, 3, 15), ist(2026, 5, 30, 23, 59), ['mango-danish', 'mango-passion'], 'ENDED'),
  campaign('cmp-mothers-2026', 'Mother’s Day breakfast', 'Brioche, croissants and flowers-on-top cakes for the weekend.', ist(2026, 4, 1), ist(2026, 4, 10, 23, 59), ['brioche-loaf', 'butter-croissant', 'strawberry-cream'], 'ENDED'),
  campaign('cmp-sourdough-2026', 'Sourdough Saturdays', 'Fresh loaves every weekend: country, multigrain and focaccia.', ist(2026, 8, 1), ist(2026, 9, 31, 23, 59), ['country-sourdough', 'multigrain-sourdough', 'rosemary-focaccia'], 'LIVE', { cta: { label: 'Order bread', href: '/shop' } }),
  campaign('cmp-diwali-2026', 'Diwali 2026 gift boxes', 'Festive boxes for Diwali, scheduled ahead of the festival.', ist(2026, 9, 20), ist(2026, 10, 9, 23, 59), ['festive-gift-box', 'macaron-box'], 'SCHEDULED', { priority: 1 }),
  campaign('cmp-winter-draft', 'Winter warmers', 'Hot chocolate and plum cake for the cold months. Draft.', ist(2026, 11, 1), ist(2027, 0, 15, 23, 59), ['hot-chocolate', 'plum-cake'], 'DRAFT', { priority: 3 }),
];

// ───────────────────────────── Audit: staff actions over the history ─────────────────────────────

const staffById = new Map(STAFF.map((x) => [x.id, x]));
const audit: AuditRecord[] = [];
const actor = (id: string) => { const x = staffById.get(id)!; return { id: x.id, name: x.name, role: x.role }; };
const record = (r: Omit<AuditRecord, 'id'>) => audit.push({ id: '', ...r });
const STEP_ACTOR: Partial<Record<OrderStatus, string[]>> = {
  PREPARING: ['staff-kitchen', 'staff-kitchen-am', 'staff-baker'], READY: ['staff-kitchen', 'staff-kitchen-am', 'staff-baker'],
  OUT_FOR_DELIVERY: ['staff-delivery', 'staff-rider-2'], DELIVERED: ['staff-delivery', 'staff-rider-2'],
};
// Status changes by the team over the last 30 days.
for (const o of orders.filter((x) => new Date(x.createdAt).getTime() >= ANCHOR.getTime() - 30 * DAY)) {
  for (let i = 2; i < o.history.length; i += 1) {
    const h = o.history[i];
    if (h.status === 'CANCELLED') continue;
    const custom = o.items.some((l) => l.custom) && (h.status === 'PREPARING' || h.status === 'READY');
    record({ at: h.at, actor: actor(custom ? 'staff-baker-cakes' : pick(STEP_ACTOR[h.status] ?? ['staff-kitchen'])), action: 'order.status.changed', entity: { type: 'order', id: o.id }, before: { status: o.history[i - 1].status }, after: { status: h.status }, reason: null, source: 'admin-ui' });
  }
}
// Cancellations and refunds.
for (const o of orders.filter((x) => x.status === 'CANCELLED')) {
  const h = o.history[o.history.length - 1];
  record({ at: h.at, actor: actor(pick(['staff-manager', 'staff-support'])), action: 'order.status.changed', entity: { type: 'order', id: o.id }, before: { status: o.history[o.history.length - 2].status }, after: { status: 'CANCELLED' }, reason: cancelReasonByOrder.get(o.id) ?? null, source: 'admin-ui' });
}
for (const r of refunds.filter((x) => x.status === 'PROCESSED')) {
  record({ at: r.processedAt!, actor: actor(r.by), action: 'order.refunded', entity: { type: 'order', id: r.orderId }, before: { refunded: 0 }, after: { refunded: r.amount, refund: r.id }, reason: r.reason, source: 'admin-ui' });
}
// Stock: deliveries, wastage and counts over the last 60 days.
for (const m of movements.filter((x) => x.reason !== 'Sale' && x.actor && new Date(x.at).getTime() >= ANCHOR.getTime() - 60 * DAY)) {
  record({ at: m.at, actor: actor(m.actor!), action: `inventory.${m.reason.toLowerCase()}`, entity: { type: 'inventory', id: m.ingredientId }, before: null, after: { delta: m.delta }, reason: m.note ?? null, source: 'admin-ui' });
}
// Issues: assignment and resolution.
for (const x of issues) {
  if (x.assignedTo) record({ at: x.messages[1]?.at ?? x.updatedAt, actor: actor(x.assignedTo), action: 'issue.assigned', entity: { type: 'issue', id: x.id, label: x.orderId }, before: { assignedTo: null }, after: { assignedTo: x.assignedTo }, reason: null, source: 'admin-ui' });
  if (x.resolvedAt) record({ at: x.resolvedAt, actor: actor(x.assignedTo ?? 'staff-support'), action: 'issue.resolved', entity: { type: 'issue', id: x.id, label: x.orderId }, before: { status: 'INVESTIGATING' }, after: { status: x.status }, reason: x.resolution, source: 'admin-ui' });
}
// Campaigns: scheduled and published by the owner.
for (const c of campaigns.filter((x) => x.status !== 'DRAFT')) {
  record({ at: c.updatedAt, actor: actor('staff-owner'), action: 'campaign.published', entity: { type: 'campaign', id: c.id, label: c.name }, before: { status: 'DRAFT' }, after: { status: 'SCHEDULED' }, reason: 'Campaign calendar', source: 'admin-ui' });
}
audit.sort((a, b) => a.at.localeCompare(b.at));
audit.forEach((r, i) => { r.id = `aud-seed-${pad(i + 1, 5)}`; });

// ───────────────────────────── Write ─────────────────────────────

const slim = (o: SeedOrder): SeedOrder => ({
  ...o,
  items: o.items.map((l) => ({ ...l, product: { id: l.product.id, name: l.product.name, category: l.product.category, description: l.product.description, price: l.product.price, image: l.product.image, searchTerms: [] } })),
});
const dataset: MockDataset = {
  manifest: {
    version: VERSION, anchor: iso(ANCHOR), timezone: 'Asia/Kolkata', seed: SEED,
    counts: { orders: orders.length, customers: customers.length, products: baseProducts.length, customCakes: designs.size, payments: payments.length, refunds: refunds.length, invoices: invoices.length, issues: issues.length, notifications: notifications.length, jobs: jobs.length, movements: movements.length, campaigns: campaigns.length, staff: STAFF.length, audit: audit.length },
    liveOrderIds: orders.filter((o) => o.liveOffsetMin).map((o) => o.id),
    inventoryLevels: ingredients.map((i) => ({ id: i.id, onHand: i.onHand, reserved: 0 })),
    note: 'Demonstration data. Every person, phone number, email address and order is fictional.',
  },
  customers, orders: orders.map(slim), products: baseProducts.map((p) => ({ id: p.id, name: p.name, category: p.category, price: p.price, available: p.available !== false })),
  customCakes: [...designs.values()], payments, invoices, issues, notifications, automations: { jobs, log }, inventory: { ingredients, movements },
  analytics: { days: analyticsDays, topSearches, note: 'Sessions, views and searches are modelled from the orders (conversion about 2–3%); orders and revenue are exact.' },
  staff: STAFF, campaigns, audit,
};

const out = path.join(process.cwd(), 'public', 'mock-data');
mkdirSync(out, { recursive: true });
const files: [string, unknown][] = [
  ['manifest', dataset.manifest], ['customers', dataset.customers], ['orders', dataset.orders], ['products', dataset.products], ['custom-cakes', dataset.customCakes],
  ['payments', dataset.payments], ['invoices', dataset.invoices], ['issues', dataset.issues], ['notifications', dataset.notifications], ['automations', dataset.automations],
  ['inventory', dataset.inventory], ['analytics', dataset.analytics], ['staff', dataset.staff], ['campaigns', dataset.campaigns], ['audit', dataset.audit],
];
for (const [name, data] of files) writeFileSync(path.join(out, `${name}.json`), JSON.stringify(data) + '\n');
console.log(`Wrote public/mock-data (${VERSION})`);
console.log(Object.entries(dataset.manifest.counts).map(([k, v]) => `  ${k}: ${v}`).join('\n'));
