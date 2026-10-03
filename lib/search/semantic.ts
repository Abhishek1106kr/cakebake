// Deterministic "mood" search. It reads intent words, expands them into the
// menu's vocabulary and ranks products. No network, no model: the same query
// always gives the same order.

import { products, type Product } from '@/data/products';

const INTENTS: Record<string, string[]> = {
  chocolatey: ['chocolate', 'cocoa', 'chocolatey', 'tart', 'brownie', 'mocha'],
  chocolate: ['chocolate', 'cocoa', 'chocolatey'],
  warm: ['warm', 'hot', 'coffee', 'cinnamon', 'pastry', 'comforting'],
  nutty: ['nutty', 'almond', 'pistachio', 'hazelnut'],
  cold: ['cold', 'iced', 'cold brew', 'refreshing'],
  iced: ['iced', 'cold'],
  light: ['light', 'tea', 'fresh', 'citrus'],
  fresh: ['fresh', 'citrus', 'green', 'light'],
  brunch: ['brunch', 'toast', 'sandwich', 'eggs', 'savoury'],
  breakfast: ['breakfast', 'pastry', 'brunch', 'buttery'],
  savoury: ['savoury', 'toast', 'eggs'],
  sweet: ['sweet', 'dessert', 'chocolate'],
  coffee: ['coffee', 'espresso'],
  tea: ['tea', 'matcha', 'jasmine'],
  bright: ['bright', 'citrus', 'refreshing'],
  refreshing: ['refreshing', 'cold', 'citrus', 'sparkling'],
  rich: ['rich', 'indulgent', 'chocolatey', 'creamy'],
  creamy: ['creamy', 'milky', 'mascarpone'],
  comforting: ['comforting', 'warm', 'soft', 'cinnamon'],
  calm: ['calm', 'tea', 'floral'],
  flaky: ['flaky', 'buttery', 'croissant', 'laminated'],
};

const STOP_WORDS = new Set(['something', 'a', 'an', 'the', 'and', 'with', 'some', 'for', 'me', 'i', 'want', 'like', 'feel', 'feeling', 'very', 'bit', 'of', 'to', 'in', 'mood', 'please']);

const LOW_SWEET = /\b(not too sweet|less sweet|not sweet|low sugar|light on sugar)\b/;

export type SearchResult = { product: Product; score: number; reasons: string[] };

function haystack(product: Product): string {
  return [product.name, product.category, product.short, product.story, ...product.moods].join(' ').toLowerCase();
}

export function moodSearch(query: string, pool: Product[] = products): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return pool.map((product) => ({ product, score: 0, reasons: [] }));

  const wantsLowSweet = LOW_SWEET.test(q);
  const tokens = q
    .replace(LOW_SWEET, ' ')
    .split(/[^a-z]+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

  const results = pool.map((product) => {
    const text = haystack(product);
    let score = 0;
    const reasons = new Set<string>();

    for (const token of tokens) {
      if (product.moods.includes(token)) { score += 4; reasons.add(token); }
      else if (text.includes(token)) { score += 3; reasons.add(token); }
      for (const synonym of INTENTS[token] ?? []) {
        if (synonym !== token && text.includes(synonym)) { score += 1.5; reasons.add(synonym); }
      }
    }
    if (wantsLowSweet) {
      if (product.sweetness <= 2) { score += 3; reasons.add('not too sweet'); }
      else if (product.sweetness >= 4) score -= 3;
    }
    return { product, score, reasons: [...reasons].slice(0, 3) };
  });

  return results
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || Number(Boolean(b.product.signature)) - Number(Boolean(a.product.signature)));
}

export const moodSuggestions = ['something chocolatey', 'warm and nutty', 'something cold', 'light brunch', 'not too sweet'];
