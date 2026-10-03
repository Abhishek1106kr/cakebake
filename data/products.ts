// The Tresor menu: the single source of product truth.
// The first eight items, their descriptions and prices come from the Figma V2 prototype.

export type CategoryId = 'coffee' | 'pastry' | 'dessert' | 'brunch' | 'drinks';
export type ArtKind = 'croissant' | 'cup' | 'glass' | 'tart' | 'roll' | 'toast' | 'slice' | 'bar' | 'shell' | 'teacup';
export type Tone = 'cream' | 'warm' | 'stone' | 'sage';
export type Size = 'regular' | 'large';

export type AnatomyLayer = { label: string; detail: string };

export type Product = {
  slug: string;
  name: string;
  category: CategoryId;
  price: number; // INR, GST inclusive
  short: string; // V2 "desc" line: three notes separated by middots
  story: string;
  moods: string[]; // semantic search vocabulary
  sweetness: 1 | 2 | 3 | 4 | 5;
  prepMinutes: number;
  eggless: boolean;
  allergens: string[];
  sizes?: Size[]; // drinks that come in two sizes
  anatomy?: AnatomyLayer[]; // top-to-bottom layers for the "Inside" module
  enjoy: string;
  storage: string;
  art: ArtKind;
  tone: Tone;
  signature?: boolean;
  thisWeek?: boolean;
  image?: { src: string; alt: string }; // real photography slots in here later
};

export const categories: { id: CategoryId; label: string }[] = [
  { id: 'coffee', label: 'Coffee' },
  { id: 'pastry', label: 'Pastry' },
  { id: 'dessert', label: 'Dessert' },
  { id: 'brunch', label: 'Brunch' },
  { id: 'drinks', label: 'Drinks' },
];

export const LARGE_SURCHARGE = 40;

export const products: Product[] = [
  {
    slug: 'almond-croissant', name: 'Almond Croissant', category: 'pastry', price: 320,
    short: 'Buttery layers · almond cream · toasted almonds',
    story: 'Our croissant dough, filled with almond cream and baked a second time until the edges caramelise. Crisp outside, soft and nutty within.',
    moods: ['warm', 'nutty', 'not too sweet', 'buttery', 'breakfast', 'flaky'],
    sweetness: 3, prepMinutes: 6, eggless: false,
    allergens: ['Gluten', 'Dairy', 'Egg', 'Tree nuts'],
    anatomy: [
      { label: 'Toasted flaked almonds', detail: 'Roasted the same morning' },
      { label: 'Almond frangipane', detail: 'Baked inside and on top' },
      { label: '27 laminated layers', detail: 'Folded over three days' },
      { label: 'Cultured butter', detail: 'For depth, not just richness' },
    ],
    enjoy: 'Warm, within the hour, with a flat white.',
    storage: 'Best the day it is baked. Revive for 3 minutes in a hot oven.',
    art: 'croissant', tone: 'warm', signature: true, thisWeek: true,
  },
  {
    slug: 'flat-white', name: 'Flat White', category: 'coffee', price: 220,
    short: 'Double espresso · silky milk · balanced finish',
    story: 'A double ristretto under a thin layer of silky milk. Small, strong and round.',
    moods: ['warm', 'smooth', 'coffee', 'hot', 'milky', 'espresso'],
    sweetness: 1, prepMinutes: 4, eggless: true, allergens: ['Dairy'], sizes: ['regular', 'large'],
    enjoy: 'Straight away, while the milk is still glossy.',
    storage: 'Made to order.',
    art: 'cup', tone: 'stone', signature: true,
  },
  {
    slug: 'pistachio-tart', name: 'Pistachio Tart', category: 'dessert', price: 340,
    short: 'Pistachio · vanilla · crisp pastry',
    story: 'Pistachio praline and vanilla crème in a thin, crisp shell. Green, nutty and gently sweet.',
    moods: ['nutty', 'not too sweet', 'dessert', 'creamy', 'afternoon'],
    sweetness: 2, prepMinutes: 3, eggless: false,
    allergens: ['Gluten', 'Dairy', 'Egg', 'Tree nuts'],
    anatomy: [
      { label: 'Chopped Sicilian-style pistachio', detail: 'Lightly salted' },
      { label: 'Vanilla crème', detail: 'Set overnight' },
      { label: 'Pistachio praline', detail: 'A thin, intense layer' },
      { label: 'Pâte sablée shell', detail: 'Rolled to 2 mm' },
    ],
    enjoy: 'Slightly cool, with black coffee.',
    storage: 'Refrigerate. Best within 24 hours.',
    art: 'tart', tone: 'sage', signature: true,
  },
  {
    slug: 'chocolate-tart', name: 'Chocolate Tart', category: 'dessert', price: 340,
    short: 'Dark chocolate · hazelnut · sea salt',
    story: 'Dark chocolate ganache over hazelnut praline in a cocoa shell, finished with sea salt.',
    moods: ['chocolatey', 'rich', 'not too sweet', 'dessert', 'nutty', 'indulgent'],
    sweetness: 3, prepMinutes: 3, eggless: false,
    allergens: ['Gluten', 'Dairy', 'Egg', 'Tree nuts'],
    anatomy: [
      { label: 'Sea salt flakes', detail: 'Added last' },
      { label: '70% chocolate ganache', detail: 'Poured, never piped' },
      { label: 'Hazelnut praline', detail: 'Caramelised, then ground' },
      { label: 'Cocoa sablé', detail: 'Short and bitter-sweet' },
    ],
    enjoy: 'At room temperature, so the ganache softens.',
    storage: 'Refrigerate. Bring to room temperature for 15 minutes.',
    art: 'tart', tone: 'warm', thisWeek: true,
  },
  {
    slug: 'cold-brew', name: 'Cold Brew', category: 'coffee', price: 240,
    short: 'Slow-steeped · bright finish · low bitterness',
    story: 'Coffee steeped cold for eighteen hours. Clean, bright and gentle.',
    moods: ['cold', 'bright', 'light', 'coffee', 'iced', 'refreshing'],
    sweetness: 1, prepMinutes: 2, eggless: true, allergens: [], sizes: ['regular', 'large'],
    enjoy: 'Over ice, black.',
    storage: 'Made to order.',
    art: 'glass', tone: 'stone',
  },
  {
    slug: 'cinnamon-roll', name: 'Cinnamon Roll', category: 'pastry', price: 260,
    short: 'Brown sugar · cinnamon · soft center',
    story: 'A soft, eggless dough rolled with brown sugar and cinnamon, glazed while warm.',
    moods: ['warm', 'sweet', 'cinnamon', 'comforting', 'breakfast', 'soft'],
    sweetness: 4, prepMinutes: 5, eggless: true, allergens: ['Gluten', 'Dairy'],
    enjoy: 'Warm, pulled apart from the outside in.',
    storage: 'Best the day it is baked.',
    art: 'roll', tone: 'cream', thisWeek: true,
  },
  {
    slug: 'avocado-toast', name: 'Avocado Toast', category: 'brunch', price: 390,
    short: 'Sourdough · avocado · herbs · lemon',
    story: 'Thick sourdough, crushed avocado, soft herbs, chilli and lemon.',
    moods: ['light', 'brunch', 'fresh', 'savoury', 'green', 'healthy'],
    sweetness: 1, prepMinutes: 10, eggless: true, allergens: ['Gluten'],
    enjoy: 'Straight away, with a cold brew.',
    storage: 'Made to order.',
    art: 'toast', tone: 'sage',
  },
  {
    slug: 'tresor-tonic', name: 'Tresor Tonic', category: 'drinks', price: 260,
    short: 'Espresso · tonic · citrus peel',
    story: 'A shot of espresso floated over tonic and ice, with a twist of orange peel.',
    moods: ['cold', 'bright', 'refreshing', 'coffee', 'citrus', 'sparkling'],
    sweetness: 2, prepMinutes: 3, eggless: true, allergens: [],
    enjoy: 'Unstirred, so it changes as you drink.',
    storage: 'Made to order.',
    art: 'glass', tone: 'cream', signature: true,
  },
  {
    slug: 'tiramisu', name: 'Tiramisu', category: 'dessert', price: 360,
    short: 'Mascarpone · espresso · cocoa',
    story: 'Savoiardi soaked in our espresso, layered with mascarpone cream and dusted with cocoa.',
    moods: ['chocolatey', 'coffee', 'creamy', 'rich', 'dessert', 'cocoa'],
    sweetness: 3, prepMinutes: 3, eggless: false, allergens: ['Gluten', 'Dairy', 'Egg'],
    anatomy: [
      { label: 'Cocoa dusting', detail: 'Sifted just before it leaves' },
      { label: 'Mascarpone cream', detail: 'Whipped by hand' },
      { label: 'Espresso-soaked savoiardi', detail: 'Our house blend' },
      { label: 'Mascarpone cream', detail: 'The second layer' },
    ],
    enjoy: 'Cold, with a spoon and no hurry.',
    storage: 'Refrigerate. Best within 48 hours.',
    art: 'slice', tone: 'warm',
  },
  {
    slug: 'cafe-mocha', name: 'Café Mocha', category: 'coffee', price: 260,
    short: 'Espresso · dark chocolate · steamed milk',
    story: 'Double espresso, melted dark chocolate and steamed milk.',
    moods: ['chocolatey', 'warm', 'coffee', 'hot', 'sweet', 'cocoa'],
    sweetness: 3, prepMinutes: 4, eggless: true, allergens: ['Dairy'], sizes: ['regular', 'large'],
    enjoy: 'Hot, on a slow afternoon.',
    storage: 'Made to order.',
    art: 'cup', tone: 'warm',
  },
  {
    slug: 'hazelnut-brownie', name: 'Hazelnut Brownie', category: 'dessert', price: 220,
    short: 'Dark chocolate · roasted hazelnut · fudgy',
    story: 'A dense, eggless brownie with roasted hazelnuts folded through.',
    moods: ['chocolatey', 'nutty', 'rich', 'sweet', 'fudgy', 'cocoa'],
    sweetness: 4, prepMinutes: 2, eggless: true, allergens: ['Gluten', 'Dairy', 'Tree nuts'],
    enjoy: 'Slightly warm.',
    storage: 'Keeps for two days, sealed.',
    art: 'bar', tone: 'cream',
  },
  {
    slug: 'pain-au-chocolat', name: 'Pain au Chocolat', category: 'pastry', price: 280,
    short: 'Laminated dough · two bars of dark chocolate',
    story: 'Our croissant dough wrapped around two bars of dark chocolate.',
    moods: ['chocolatey', 'buttery', 'breakfast', 'flaky', 'warm'],
    sweetness: 3, prepMinutes: 5, eggless: false, allergens: ['Gluten', 'Dairy', 'Egg'],
    enjoy: 'Warm, so the chocolate is just soft.',
    storage: 'Best the day it is baked.',
    art: 'bar', tone: 'warm',
  },
  {
    slug: 'soft-scramble-sourdough', name: 'Soft Scramble Sourdough', category: 'brunch', price: 420,
    short: 'Slow-cooked eggs · chives · brown butter',
    story: 'Eggs cooked slowly until just set, on toasted sourdough with brown butter and chives.',
    moods: ['brunch', 'eggs', 'savoury', 'warm', 'sandwich', 'comforting'],
    sweetness: 1, prepMinutes: 12, eggless: false, allergens: ['Gluten', 'Dairy', 'Egg'],
    enjoy: 'Straight away, with a flat white.',
    storage: 'Made to order.',
    art: 'toast', tone: 'cream',
  },
  {
    slug: 'iced-matcha', name: 'Iced Matcha', category: 'drinks', price: 280,
    short: 'Stone-ground matcha · cold milk · a little vanilla',
    story: 'Whisked matcha poured over cold milk and ice, softened with vanilla.',
    moods: ['cold', 'light', 'green', 'tea', 'refreshing', 'calm'],
    sweetness: 2, prepMinutes: 4, eggless: true, allergens: ['Dairy'], sizes: ['regular', 'large'],
    enjoy: 'Stirred, then sipped slowly.',
    storage: 'Made to order.',
    art: 'glass', tone: 'sage', thisWeek: true,
  },
  {
    slug: 'jasmine-green-tea', name: 'Jasmine Green Tea', category: 'drinks', price: 200,
    short: 'Jasmine-scented green tea · a pot for one',
    story: 'Green tea scented with jasmine blossom, brewed at 80°C.',
    moods: ['light', 'tea', 'warm', 'floral', 'calm', 'fresh'],
    sweetness: 1, prepMinutes: 3, eggless: true, allergens: [],
    enjoy: 'After three minutes. The second pour is better.',
    storage: 'Made to order.',
    art: 'teacup', tone: 'stone',
  },
  {
    slug: 'lemon-madeleines', name: 'Lemon Madeleines', category: 'pastry', price: 240,
    short: 'Brown butter · lemon zest · box of four',
    story: 'Shell-shaped brown-butter sponges with lemon zest, baked to order.',
    moods: ['light', 'fresh', 'citrus', 'not too sweet', 'afternoon', 'buttery'],
    sweetness: 2, prepMinutes: 8, eggless: false, allergens: ['Gluten', 'Dairy', 'Egg'],
    enjoy: 'Within minutes of baking, with jasmine tea.',
    storage: 'Best the same day.',
    art: 'shell', tone: 'cream',
  },
];

export function getProduct(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}

export function categoryLabel(id: CategoryId): string {
  return categories.find((category) => category.id === id)?.label ?? id;
}

export function relatedProducts(product: Product, count = 3): Product[] {
  const shared = (other: Product) => other.moods.filter((mood) => product.moods.includes(mood)).length;
  return products
    .filter((other) => other.slug !== product.slug)
    .sort((a, b) => Number(b.category === product.category) - Number(a.category === product.category) || shared(b) - shared(a))
    .slice(0, count);
}
