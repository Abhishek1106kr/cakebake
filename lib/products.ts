export type Product = {
  slug: string;
  name: string;
  description: string;
  price: number;
  categories: string[];
  mood: string[];
  imageTone: 'warm' | 'soft' | 'sage';
};

export const products: Product[] = [
  { slug: 'almond-croissant', name: 'Almond Croissant', description: 'Buttery layers · almond cream · toasted almonds', price: 320, categories: ['pastry'], mood: ['warm', 'nutty', 'not too sweet'], imageTone: 'warm' },
  { slug: 'flat-white', name: 'Flat White', description: 'Double espresso · silky milk · balanced finish', price: 220, categories: ['coffee', 'drinks'], mood: ['warm', 'smooth', 'coffee'], imageTone: 'soft' },
  { slug: 'pistachio-tart', name: 'Pistachio Tart', description: 'Pistachio · vanilla · crisp pastry', price: 340, categories: ['dessert', 'pastry'], mood: ['nutty', 'not too sweet'], imageTone: 'warm' },
  { slug: 'chocolate-tart', name: 'Chocolate Tart', description: 'Dark chocolate · hazelnut · sea salt', price: 340, categories: ['dessert', 'pastry'], mood: ['chocolatey', 'rich', 'not too sweet'], imageTone: 'warm' },
  { slug: 'cold-brew', name: 'Cold Brew', description: 'Slow-steeped · bright finish · low bitterness', price: 240, categories: ['coffee', 'drinks'], mood: ['cold', 'bright', 'light'], imageTone: 'soft' },
  { slug: 'cinnamon-roll', name: 'Cinnamon Roll', description: 'Brown sugar · cinnamon · soft center', price: 260, categories: ['pastry', 'brunch'], mood: ['warm', 'sweet'], imageTone: 'warm' },
  { slug: 'avocado-toast', name: 'Avocado Toast', description: 'Sourdough · avocado · herbs · lemon', price: 390, categories: ['brunch'], mood: ['light', 'brunch', 'fresh'], imageTone: 'soft' },
  { slug: 'tresor-tonic', name: 'Tresor Tonic', description: 'Espresso · tonic · citrus peel', price: 260, categories: ['drinks'], mood: ['cold', 'bright', 'refreshing'], imageTone: 'sage' },
];

const normalize = (value: string) => value.toLowerCase().trim();

export function semanticSearch(query: string) {
  const q = normalize(query);
  if (!q) return products;
  const terms = q.split(/\s+|\+|,|·|and/g).filter(Boolean);
  return [...products].sort((a, b) => score(b, terms) - score(a, terms));
}

function score(product: Product, terms: string[]) {
  const haystack = normalize([product.name, product.description, ...product.categories, ...product.mood].join(' '));
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 3 : partialIntent(term, product)), 0);
}

function partialIntent(term: string, product: Product) {
  const aliases: Record<string, string[]> = {
    chocolatey: ['chocolate', 'rich'],
    nutty: ['almond', 'pistachio', 'hazelnut'],
    cold: ['cold', 'bright', 'refreshing'],
    brunch: ['brunch', 'fresh', 'light'],
    light: ['light', 'fresh', 'bright'],
    warm: ['warm'],
    sweet: ['sweet'],
  };
  return aliases[term]?.some(x => normalize(product.name + ' ' + product.description + ' ' + product.mood.join(' ')).includes(x)) ? 2 : 0;
}
