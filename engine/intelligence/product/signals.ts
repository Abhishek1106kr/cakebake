// Product intelligence: derives structured, explainable signals from the menu
// data (flavour, temperature, sweetness, richness, moments, occasions…).
// Pure rules over product fields, so every signal can say where it came from.

import type { Product } from '@/lib/data';

export const FLAVOURS = ['chocolate', 'nutty', 'fruity', 'caramel', 'vanilla', 'coffee', 'tea', 'savoury', 'creamy'] as const;
export type Flavour = (typeof FLAVOURS)[number];
export type Temperature = 'hot' | 'warm' | 'cold' | 'chilled' | 'ambient';
export type Richness = 'light' | 'medium' | 'rich';
export const MOMENTS = ['breakfast', 'brunch', 'snack', 'dessert', 'celebration', 'pick-me-up'] as const;
export type Moment = (typeof MOMENTS)[number];
export type PriceBand = 'budget' | 'mid' | 'premium';

export type ProductSignals = {
  id: string;
  category: string;
  flavours: Flavour[];
  temperature: Temperature;
  sweetness: 1 | 2 | 3 | 4 | 5;
  richness: Richness;
  caffeine: boolean;
  containsNuts: boolean;
  moments: Moment[];
  occasions: string[];
  dietary: string[];
  wholeCake: boolean;
  serves: number;
  leadTime: 'today' | '24h';
  prepMinutes: number;
  priceBand: PriceBand;
  /** Where each derived signal came from, for explanations. */
  sources: Partial<Record<'sweetness' | 'temperature' | 'richness' | 'flavours', string>>;
};

export const SIGNALS_VERSION = 'signals-v1';

const FLAVOUR_WORDS: Record<Flavour, string[]> = {
  chocolate: ['chocolate', 'cocoa', 'brownie', 'ganache'],
  nutty: ['almond', 'pistachio', 'hazelnut', 'praline', 'nut', 'nutty'],
  fruity: ['berry', 'berries', 'strawberry', 'blueberry', 'blackcurrant', 'cherry', 'cherries', 'mango', 'passion', 'fruit', 'fruity', 'citrus', 'tropical', 'strawberries', 'blueberries'],
  caramel: ['caramel', 'caramelised', 'toffee'],
  vanilla: ['vanilla'],
  coffee: ['coffee', 'espresso'],
  tea: ['tea', 'matcha'],
  savoury: ['savoury', 'mushroom', 'mushrooms', 'parmesan', 'fries', 'ricotta'],
  creamy: ['cream', 'creamy', 'mousse', 'cheesecake', 'yogurt', 'milk'],
};

const words = (p: Product) => {
  const text = [p.name, p.description, ...p.searchTerms, ...(p.cake?.flavorProfile ?? []), ...(p.cake?.ingredients ?? []), p.cake?.texture ?? ''].join(' ').toLowerCase();
  return { text, set: new Set(text.match(/[a-z]+/g) ?? []), terms: new Set(p.searchTerms.map((t) => t.toLowerCase())) };
};

function flavoursOf(p: Product, set: Set<string>): Flavour[] {
  const found = FLAVOURS.filter((f) => FLAVOUR_WORDS[f].some((w) => set.has(w)));
  if (p.category === 'Savoury' && !found.includes('savoury')) found.push('savoury');
  return found;
}

function temperatureOf(p: Product, terms: Set<string>): [Temperature, string] {
  const iced = terms.has('cold') || terms.has('iced') || terms.has('cold brew');
  if (p.category === 'Coffee' || p.category === 'Drinks') return iced ? ['cold', 'served iced'] : ['hot', 'served hot'];
  if (p.category === 'Pastry' || p.category === 'Savoury') return ['warm', 'served warm from the oven'];
  if (p.category === 'Cake') return ['chilled', 'kept chilled'];
  if (/mousse|yogurt|parfait/.test(p.description.toLowerCase())) return ['chilled', 'kept chilled'];
  return ['ambient', 'served at room temperature'];
}

function sweetnessOf(p: Product, terms: Set<string>): [ProductSignals['sweetness'], string] {
  if (p.cake) return [p.cake.sweetness, `rated ${p.cake.sweetness}/5 by the bakery`];
  const base: Record<string, number> = { Savoury: 1, Coffee: 2, Drinks: 2, Pastry: 2, Dessert: 4, Cake: 3 };
  let s = base[p.category] ?? 3;
  let why = `typical for ${p.category.toLowerCase()}`;
  if (terms.has('sweet') || terms.has('caramelised') || terms.has('honey') || terms.has('vanilla')) { s += 1; why = 'described as sweet'; }
  if (terms.has('not too sweet') || terms.has('light') || terms.has('refreshing')) { s -= 1; why = 'described as light'; }
  return [Math.min(5, Math.max(1, s)) as ProductSignals['sweetness'], why];
}

function richnessOf(p: Product, set: Set<string>, terms: Set<string>): [Richness, string] {
  if (['rich', 'fudgy', 'indulgent', 'ganache'].some((w) => terms.has(w) || set.has(w))) return ['rich', 'described as rich'];
  if (['light', 'fresh', 'refreshing'].some((w) => terms.has(w)) || /\blight\b|cloud/.test(p.cake?.texture.toLowerCase() ?? '')) return ['light', 'described as light'];
  return ['medium', 'neither light nor rich'];
}

export function signalsFor(p: Product): ProductSignals {
  const { set, terms } = words(p);
  const flavours = flavoursOf(p, set);
  const [temperature, tWhy] = temperatureOf(p, terms);
  const [sweetness, sWhy] = sweetnessOf(p, terms);
  const [richness, rWhy] = richnessOf(p, set, terms);
  const caffeine = flavours.includes('coffee') || flavours.includes('tea');
  const wholeCake = Boolean(p.cake);
  const moments = new Set<Moment>();
  if (terms.has('breakfast') || p.category === 'Pastry' || p.category === 'Coffee') moments.add('breakfast');
  if (terms.has('brunch') || p.category === 'Savoury' || moments.has('breakfast')) moments.add('brunch');
  if (terms.has('snack') || terms.has('sharing') || p.category === 'Savoury' || p.category === 'Pastry' || p.id === 'chocolate-brownie') moments.add('snack');
  if (p.category === 'Cake' || p.category === 'Dessert') moments.add('dessert');
  if (wholeCake || terms.has('celebration')) moments.add('celebration');
  if (caffeine) moments.add('pick-me-up');
  const serves = Number(p.cake?.size.match(/serves\s*\d+\s*[–-]\s*(\d+)/)?.[1] ?? p.cake?.size.match(/serves\s*(\d+)/)?.[1] ?? 1);
  return {
    id: p.id,
    category: p.category,
    flavours,
    temperature,
    sweetness,
    richness,
    caffeine,
    containsNuts: flavours.includes('nutty') || (p.dietary ?? []).includes('Contains nuts'),
    moments: [...moments],
    occasions: (p.cake?.occasion ?? []).map((o) => o.toLowerCase()),
    dietary: (p.dietary ?? []).map((d) => d.toLowerCase()),
    wholeCake,
    serves,
    leadTime: p.cake?.availability === 'Order 24 h ahead' ? '24h' : 'today',
    prepMinutes: p.prepMinutes ?? 5,
    priceBand: p.price < 200 ? 'budget' : p.price < 1000 ? 'mid' : 'premium',
    sources: { sweetness: sWhy, temperature: tWhy, richness: rWhy, flavours: flavours.length ? `from ${p.name.toLowerCase()}'s ingredients` : 'no dominant flavour' },
  };
}

const SWEET_WORDS: Record<number, string> = { 1: 'savoury', 2: 'not too sweet', 3: 'gently sweet', 4: 'sweet', 5: 'very sweet' };

/** Text used for vector representation: product copy plus its derived concepts. */
export function conceptText(p: Product, s: ProductSignals): string {
  return [
    p.name, p.category, p.description, ...p.searchTerms,
    ...(p.cake ? [p.cake.story, p.cake.texture, ...p.cake.flavorProfile] : []),
    ...s.flavours, s.temperature, SWEET_WORDS[s.sweetness], s.richness, ...s.moments, ...s.occasions,
    s.caffeine ? 'caffeine energy' : '', s.wholeCake ? 'whole cake sharing serves' : '',
  ].join(' ');
}
