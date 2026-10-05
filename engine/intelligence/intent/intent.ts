// Intent engine: turns what a customer types ("something warm, nutty and not too
// sweet") into structured, explainable constraints. Deterministic lexicon and
// phrase rules; every recognised phrase becomes a piece of evidence, and words
// the engine couldn't place are reported rather than guessed.

import type { Evidence } from '../core/contract';
import type { Flavour, Moment, Richness } from '../product/signals';

export type TemperatureWish = 'warm' | 'cold';

export type SearchIntent = {
  raw: string;
  normalized: string;
  tokens: string[];
  categories: string[];
  flavours: Flavour[];
  excludeFlavours: Flavour[];
  temperature: TemperatureWish | null;
  sweetness: { min?: number; max?: number } | null;
  richness: Richness | null;
  caffeine: boolean | null;
  moments: Moment[];
  occasions: string[];
  /** Specific ingredients asked for by name. */
  ingredients: string[];
  excludeNuts: boolean;
  priceMax: number | null;
  serves: number | null;
  needToday: boolean;
  /** Content words not understood by the lexicon; left for text and vector matching. */
  freeTerms: string[];
  /** Free terms that also match nothing on the menu. */
  unknownTerms: string[];
  interpretation: string | null;
  confidence: number;
  evidence: Evidence[];
};

export const INTENT_VERSION = 'intent-v1';

const STOPWORDS = new Set('a an the i im i\'m me my we us our you something anything some any want wanna need would like love looking look for find show give get please and or with of to in on at is it its that this be really very bit little kind sort maybe just one ones thing things stuff have has can could do does mood feel feeling today\'s what whats which'.split(' '));

const SPELLING: Record<string, string> = {
  savory: 'savoury', flavor: 'flavour', flavors: 'flavours', choco: 'chocolate', choc: 'chocolate', chocolatey: 'chocolate', chocolaty: 'chocolate',
  cakes: 'cake', pastries: 'pastry', desserts: 'dessert', drinks: 'drink', coffees: 'coffee', nuts: 'nut', berries: 'berry', iced: 'iced',
  bday: 'birthday', b: 'b',
};

const CATEGORY_WORDS: Record<string, string[]> = { cake: ['Cake'], pastry: ['Pastry'], croissant: ['Pastry'], coffee: ['Coffee'], drink: ['Drinks', 'Coffee'], beverage: ['Drinks', 'Coffee'], savoury: ['Savoury'], bread: ['Bread'], loaf: ['Bread'], loaves: ['Bread'], sourdough: ['Bread'] };

/** Flavour words specific enough to mean that ingredient, not just its family ("mango", not "anything fruity"). */
const SPECIFIC = new Set(['almond', 'pistachio', 'hazelnut', 'praline', 'strawberry', 'mango', 'cherry', 'citrus', 'lemon', 'berry', 'matcha']);
// "dessert" and "snack" are moments, not categories: cakes are desserts too.

const FLAVOUR_WORDS: Record<string, Flavour> = {
  chocolate: 'chocolate', cocoa: 'chocolate', brownie: 'chocolate',
  nut: 'nutty', nutty: 'nutty', almond: 'nutty', pistachio: 'nutty', hazelnut: 'nutty', praline: 'nutty',
  fruit: 'fruity', fruity: 'fruity', berry: 'fruity', strawberry: 'fruity', mango: 'fruity', cherry: 'fruity', citrus: 'fruity', lemon: 'fruity', tropical: 'fruity',
  caramel: 'caramel', toffee: 'caramel', vanilla: 'vanilla', espresso: 'coffee', tea: 'tea', matcha: 'tea', creamy: 'creamy', cream: 'creamy', cheesy: 'savoury', savoury: 'savoury',
};

const MOMENT_WORDS: Record<string, Moment> = { breakfast: 'breakfast', morning: 'breakfast', brunch: 'brunch', lunch: 'brunch', snack: 'snack', sharing: 'snack', share: 'snack', dessert: 'dessert', 'after dinner': 'dessert', celebration: 'celebration', celebrate: 'celebration', party: 'celebration', 'pick me up': 'pick-me-up', energy: 'pick-me-up' };

const OCCASION_WORDS: Record<string, string> = { birthday: 'birthday', anniversary: 'anniversary', 'dinner party': 'dinner party', gift: 'gift', present: 'gift', celebration: 'celebration' };

const NEGATORS = new Set(['no', 'not', 'without', 'free', 'less', 'non', 'avoid', 'skip']);

export function normalizeQuery(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/₹\s*/g, ' rs ')
    .replace(/(\w)-(\w)/g, '$1 $2')
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => SPELLING[t] ?? t)
    .join(' ');
}

type Ctx = { categories: Set<string>; vocabulary: Set<string> };

export function parseIntent(raw: string, ctx: Ctx = { categories: new Set(), vocabulary: new Set() }): SearchIntent {
  const normalized = normalizeQuery(raw);
  const tokens = normalized ? normalized.split(' ') : [];
  const used = new Set<number>();
  const evidence: Evidence[] = [];
  const intent: SearchIntent = {
    raw, normalized, tokens, categories: [], flavours: [], excludeFlavours: [], temperature: null, sweetness: null, richness: null,
    caffeine: null, moments: [], occasions: [], ingredients: [], excludeNuts: false, priceMax: null, serves: null, needToday: false,
    freeTerms: [], unknownTerms: [], interpretation: null, confidence: 0, evidence,
  };
  const mark = (from: number, len: number) => { for (let i = from; i < from + len; i += 1) used.add(i); };
  const note = (label: string, value: string) => evidence.push({ kind: 'rule', label, value, source: INTENT_VERSION });
  // "no chocolate", "not too sweet", "without any nuts": a negator directly before, or one filler word between.
  const negatedAt = (i: number) => NEGATORS.has(tokens[i - 1]) || (NEGATORS.has(tokens[i - 2]) && (STOPWORDS.has(tokens[i - 1]) || tokens[i - 1] === 'too'));

  // ---- Multi-word phrases first ----
  const phrase = (re: RegExp, apply: (m: RegExpMatchArray) => void) => {
    const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
    let applied = false;
    for (const m of normalized.matchAll(new RegExp(re.source, flags))) {
      const start = normalized.slice(0, m.index).split(' ').filter(Boolean).length;
      mark(start, m[0].trim().split(' ').length);
      if (!applied) { apply(m); applied = true; }
    }
  };
  phrase(/\b(not too|not very|not overly|less|low|not that|barely|lightly) sweet\b|\bnot sweet\b|\blow sugar\b|\bless sugar\b/, () => { intent.sweetness = { max: 2 }; note('Not too sweet', 'sweetness ≤ 2/5'); });
  phrase(/\b(nut free|no nut|without nut|nut allergy|no nuts|without nuts)\b/, () => { intent.excludeNuts = true; note('No nuts', 'excludes anything containing nuts'); });
  phrase(/\b(decaf|caffeine free|no caffeine|without caffeine)\b/, () => { intent.caffeine = false; note('No caffeine', 'excludes coffee and tea'); });
  phrase(/\b(under|below|less than|within|upto|up to|max|maximum)\s+(rs\s+)?(\d{2,5})\b/, (m) => { intent.priceMax = Number(m[3]); note('Budget', `up to ₹${m[3]}`); });
  phrase(/\b(?:for|serves?|feeds?)\s+(\d{1,2})(?:\s+(?:people|persons|guests|of us))?\b/, (m) => { intent.serves = Number(m[1]); note('Serves', `${m[1]} people`); });
  phrase(/\b(right now|today|now|asap|quick|quickly|in a hurry|same day)\b/, () => { intent.needToday = true; note('Needed today', 'excludes cakes that need 24 h notice'); });
  phrase(/\bpick me up\b/, () => { intent.moments.push('pick-me-up'); note('Pick-me-up', 'coffee or tea'); });
  phrase(/\bafter dinner\b/, () => { intent.moments.push('dessert'); note('Moment', 'dessert'); });
  phrase(/\bdinner party\b/, () => { intent.occasions.push('dinner party'); note('Occasion', 'dinner party'); });
  phrase(/\bcold brew\b/, () => { intent.temperature = 'cold'; intent.flavours.push('coffee'); note('Cold brew', 'cold coffee'); });

  // ---- Single words ----
  tokens.forEach((t, i) => {
    if (used.has(i)) return;
    const negated = negatedAt(i);
    if (NEGATORS.has(t) || t === 'too' || t === 'rs') { used.add(i); return; }
    if (t === 'warm' || t === 'hot' || t === 'cosy' || t === 'cozy' || t === 'toasty' || t === 'fresh-baked') { intent.temperature = 'warm'; used.add(i); note('Warm', 'served hot or warm'); return; }
    if (t === 'cold' || t === 'iced' || t === 'chilled' || t === 'cool' || t === 'refreshing') {
      intent.temperature = 'cold'; used.add(i); note('Cold', 'served iced or chilled');
      if (t === 'refreshing') intent.richness ??= 'light';
      return;
    }
    if (t === 'light' || t === 'fresh' || t === 'airy') { intent.richness = 'light'; used.add(i); note('Light', 'light rather than rich'); return; }
    if (t === 'rich' || t === 'indulgent' || t === 'decadent' || t === 'fudgy' || t === 'heavy') { intent.richness = 'rich'; used.add(i); note('Rich', 'rich and indulgent'); return; }
    if ((t === 'sweet' || t === 'sugary') && !negated) { intent.sweetness = { min: 4 }; used.add(i); note('Sweet', 'sweetness ≥ 4/5'); return; }
    if (t === 'caffeine' || t === 'caffeinated') { intent.caffeine = !negated; used.add(i); note(negated ? 'No caffeine' : 'Caffeine', negated ? 'excludes coffee and tea' : 'coffee or tea'); return; }
    if (t === 'cheap' || t === 'budget' || t === 'affordable' || t === 'inexpensive') { intent.priceMax = 250; used.add(i); note('Budget', 'up to ₹250'); return; }
    if (t in OCCASION_WORDS) { intent.occasions.push(OCCASION_WORDS[t]); used.add(i); note('Occasion', OCCASION_WORDS[t]); return; }
    if (t in MOMENT_WORDS) { intent.moments.push(MOMENT_WORDS[t]); used.add(i); note('Moment', MOMENT_WORDS[t]); return; }
    const cats = (CATEGORY_WORDS[t] ?? []).filter((c) => ctx.categories.size === 0 || ctx.categories.has(c));
    if (cats.length) {
      if (t === 'coffee') { intent.flavours.push('coffee'); intent.caffeine ??= true; }
      for (const c of cats) if (!intent.categories.includes(c)) intent.categories.push(c);
      used.add(i); note('Category', cats.join(' or ')); return;
    }
    if (t in FLAVOUR_WORDS) {
      const f = FLAVOUR_WORDS[t];
      if (negated) { if (f === 'nutty') intent.excludeNuts = true; else intent.excludeFlavours.push(f); note(`No ${f}`, `excludes ${f}`); }
      else if (SPECIFIC.has(t)) { intent.ingredients.push(t); note('Ingredient', t); }
      else { intent.flavours.push(f); note('Flavour', f); }
      used.add(i); return;
    }
  });

  intent.flavours = [...new Set(intent.flavours)].filter((f) => !intent.excludeFlavours.includes(f));
  intent.moments = [...new Set(intent.moments)];
  intent.occasions = [...new Set(intent.occasions)];
  intent.ingredients = [...new Set(intent.ingredients)];

  // ---- What's left ----
  intent.freeTerms = tokens.filter((t, i) => !used.has(i) && !STOPWORDS.has(t) && !/^\d+$/.test(t) && t.length > 1);
  intent.unknownTerms = intent.freeTerms.filter((t) => !ctx.vocabulary.has(t));

  const content = tokens.filter((t, i) => used.has(i) || (!STOPWORDS.has(t) && t.length > 1)).length;
  const understood = content - intent.unknownTerms.length;
  intent.confidence = content === 0 ? 0 : Math.round((understood / content) * 100) / 100;
  intent.interpretation = interpret(intent);
  return intent;
}

const join = (parts: string[]) => (parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`);

const CATEGORY_NOUN: Record<string, string> = { Cake: 'cake', Pastry: 'pastry', Coffee: 'coffee', Drinks: 'drink', Dessert: 'dessert', Savoury: 'savoury bite' };
const FLAVOUR_ADJ: Record<Flavour, string> = { chocolate: 'chocolatey', nutty: 'nutty', fruity: 'fruity', caramel: 'caramel', vanilla: 'vanilla', coffee: 'coffee', tea: 'tea', savoury: 'savoury', creamy: 'creamy' };

/** One human sentence describing the structured intent, or null when nothing structured was understood. */
export function interpret(i: SearchIntent): string | null {
  const traits: string[] = [];
  if (i.temperature) traits.push(i.temperature);
  for (const f of i.flavours) if (!(f === 'coffee' && i.categories.includes('Coffee'))) traits.push(FLAVOUR_ADJ[f]);
  if (i.richness) traits.push(i.richness);
  if (i.sweetness?.max) traits.push('not too sweet');
  if (i.sweetness?.min) traits.push('sweet');
  const nouns = [...new Set(i.categories.map((c) => CATEGORY_NOUN[c] ?? c.toLowerCase()))];
  // "drink" covers coffee too; say it once.
  const noun = nouns.includes('drink') ? 'drink' : nouns.length ? join(nouns) : 'something';
  const tail: string[] = [];
  if (i.occasions.length) tail.push(`for ${i.occasions.includes('birthday') ? 'a birthday' : i.occasions.includes('anniversary') ? 'an anniversary' : `a ${i.occasions[0]}`}`);
  else if (i.moments.length) tail.push(`for ${i.moments[0] === 'pick-me-up' ? 'a pick-me-up' : i.moments[0]}`);
  if (i.ingredients.length) tail.push(`with ${join(i.ingredients)}`);
  if (i.serves) tail.push(`to serve ${i.serves}`);
  if (i.excludeNuts) tail.push('without nuts');
  if (i.excludeFlavours.length) tail.push(`without ${join(i.excludeFlavours)}`);
  if (i.caffeine === false) tail.push('without caffeine');
  if (i.priceMax) tail.push(`under ₹${i.priceMax}`);
  if (i.needToday) tail.push('ready today');
  if (!traits.length && !tail.length && noun === 'something') return null;
  const lead = noun === 'something' ? (traits.length ? `something ${join(traits)}` : 'something') : `a ${traits.length ? `${join(traits)} ` : ''}${noun}`;
  return `Looking for ${lead}${tail.length ? ` ${tail.join(', ')}` : ''}`.replace(/\s+/g, ' ').trim();
}

/** Every single word the intent engine understands, for typo correction. */
export const LEXICON: ReadonlySet<string> = new Set([
  ...Object.keys(CATEGORY_WORDS), ...Object.keys(FLAVOUR_WORDS),
  ...Object.keys(MOMENT_WORDS).filter((k) => !k.includes(' ')), ...Object.keys(OCCASION_WORDS).filter((k) => !k.includes(' ')),
  'warm', 'hot', 'cosy', 'cozy', 'toasty', 'cold', 'iced', 'chilled', 'cool', 'refreshing', 'light', 'fresh', 'airy',
  'rich', 'indulgent', 'decadent', 'fudgy', 'heavy', 'sweet', 'sugary', 'caffeine', 'caffeinated', 'decaf', 'cheap', 'budget', 'affordable', 'dessert', 'snack',
]);
