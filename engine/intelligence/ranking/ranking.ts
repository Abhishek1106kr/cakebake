// Ranking: explicit, versioned weights over named components. A hit's score is
// always reproducible from its components, so any ordering can be explained.

export const RANKING_VERSION = 'rank-v1';

export type RankingComponents = {
  /** Query words found in the name (strongest), search terms or copy. 0–1. */
  text: number;
  /** Vector similarity between query and product concepts. 0–1. */
  semantic: number;
  /** Share of the structured wishes (flavour, warmth, sweetness…) the product meets. 0–1. */
  attributes: number;
  /** Featured items and what's been selling. 0–1. */
  popularity: number;
  /** Ready now vs. made to order, and plenty of stock. 0–1. */
  availability: number;
};

export const WEIGHTS: Record<keyof RankingComponents, number> = {
  text: 0.3,
  semantic: 0.15,
  attributes: 0.4,
  popularity: 0.08,
  availability: 0.07,
};

export function scoreOf(c: RankingComponents, weights = WEIGHTS): number {
  let s = 0;
  for (const k of Object.keys(weights) as (keyof RankingComponents)[]) s += weights[k] * Math.min(1, Math.max(0, c[k]));
  return Math.round(s * 10000) / 10000;
}

export type Ranked<T> = { item: T; id: string; name: string; score: number; components: RankingComponents };

/** Highest score first; ties go to popularity, then name, so the order is stable. */
export function rank<T>(items: Ranked<T>[]): Ranked<T>[] {
  return [...items].sort((a, b) => b.score - a.score || b.components.popularity - a.components.popularity || a.name.localeCompare(b.name));
}

/** The component that contributed most to a score, for "why this ranked here". */
export function dominantComponent(c: RankingComponents, weights = WEIGHTS): keyof RankingComponents {
  return (Object.keys(weights) as (keyof RankingComponents)[]).reduce((best, k) => (weights[k] * c[k] > weights[best] * c[best] ? k : best), 'text');
}
