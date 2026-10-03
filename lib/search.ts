import { Product } from './data';

const synonyms: Record<string, string[]> = {
  sweet: ['dessert', 'chocolate', 'brownie', 'cake', 'pastry', 'honey'],
  chocolatey: ['chocolate', 'cocoa', 'brownie'],
  cold: ['iced', 'cold brew', 'matcha'],
  coffee: ['espresso', 'latte', 'caffeine', 'coffee'],
  light: ['fresh', 'refreshing', 'tea', 'berry', 'citrus', 'yogurt'],
  brunch: ['toast', 'sourdough', 'mushroom', 'pastry', 'breakfast'],
  nutty: ['almond', 'pistachio', 'nut'],
  refreshing: ['citrus', 'iced', 'tea', 'cold', 'berry'],
  savoury: ['mushroom', 'fries', 'toast', 'parmesan'],
  not: [],
};

export function semanticSearch(products: Product[], query: string): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return products;
  const tokens = q.split(/\s+/).filter(Boolean);
  return products
    .map((product) => {
      const haystack = [product.name, product.category, product.description, ...product.searchTerms].join(' ').toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (haystack.includes(token)) score += 4;
        for (const synonym of synonyms[token] ?? []) if (haystack.includes(synonym)) score += 2;
      }
      if (q.includes('not too sweet') && !product.searchTerms.some((x) => ['sweet', 'chocolate', 'dessert'].includes(x))) score += 3;
      return { product, score };
    })
    .sort((a, b) => b.score - a.score || Number(b.product.featured) - Number(a.product.featured))
    .filter((x) => x.score > 0)
    .map((x) => x.product);
}
