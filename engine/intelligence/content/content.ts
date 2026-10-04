// Content and media intelligence (Phase 8): what to feature, in what order, and
// which rendition of an asset to serve, given the time, season, device, network
// and what the kitchen can make right now. Rules only, every pick explained.

import type { Product } from '@/lib/data';
import type { MediaAsset } from '@/lib/media';
import { runOperation, type Evidence, type IntelligenceResult } from '../core/contract';
import type { IntelligenceContext, Season, TimeOfDay } from '../context/context';
import { productIndex } from '../product/index';
import type { Flavour, Moment, Temperature } from '../product/signals';
import { reasonLine } from '../explanations/explain';

export const CONTENT_VERSION = 'content-v1';

type ShowcaseOptions = { products: Product[]; availability?: (p: Product) => number; popularity?: Record<string, number> };
export type ShowcaseItem = { product: Product; score: number; reasons: string[]; reason: string | null };

const MOMENTS: Record<TimeOfDay, Moment[]> = { morning: ['breakfast', 'pick-me-up'], afternoon: ['pick-me-up', 'snack', 'dessert'], evening: ['dessert', 'celebration'], night: ['dessert'] };
const SEASON: Record<Season, { temps: Temperature[]; flavours: Flavour[]; words: string }> = {
  summer: { temps: ['cold', 'chilled'], flavours: ['fruity'], words: 'cool for the heat' },
  monsoon: { temps: ['hot', 'warm'], flavours: ['chocolate', 'coffee'], words: 'warm for the rain' },
  'post-monsoon': { temps: ['hot', 'warm'], flavours: ['nutty', 'caramel'], words: 'good for the season' },
  winter: { temps: ['hot', 'warm'], flavours: ['chocolate', 'nutty', 'caramel'], words: 'warming for winter' },
};
const NOVEL_TAGS = new Set(['new', 'seasonal', 'trending']);

/**
 * Orders products for a showcase (the homepage counter): what suits this moment and season
 * first, popular and new things lifted, low stock lowered, sold out left off.
 */
export function orderShowcase(ctx: Pick<IntelligenceContext, 'timeOfDay' | 'season'>, opts: ShowcaseOptions): IntelligenceResult<ShowcaseItem[]> {
  return runOperation('content.showcase', () => {
    const index = productIndex(opts.products);
    const available = opts.availability ?? (() => 99);
    const sold = opts.popularity ?? {};
    const maxSold = Math.max(1, ...Object.values(sold));
    const moments = MOMENTS[ctx.timeOfDay];
    const season = SEASON[ctx.season];
    let hidden = 0;
    const items: ShowcaseItem[] = [];
    for (const e of index.entries) {
      const units = available(e.product);
      if (units <= 0) { hidden += 1; continue; }
      const moment = moments.some((m) => e.signals.moments.includes(m));
      const seasonal = season.temps.includes(e.signals.temperature) || season.flavours.some((f) => e.signals.flavours.includes(f));
      const novel = NOVEL_TAGS.has((e.product.tag ?? '').toLowerCase());
      const popular = (sold[e.product.id] ?? 0) / maxSold;
      const lowStock = e.signals.leadTime === 'today' && units < 3;
      const score = 0.35 * (moment ? 1 : 0) + 0.25 * (seasonal ? 1 : 0) + 0.2 * popular + 0.1 * (novel ? 1 : 0) + 0.1 * (e.product.featured ? 1 : 0) - (lowStock ? 0.3 : 0);
      const reasons = [
        moment ? `right for ${ctx.timeOfDay === 'night' ? 'late' : `the ${ctx.timeOfDay}`}` : '',
        seasonal ? season.words : '',
        popular >= 0.5 ? 'selling well today' : '',
        novel ? (e.product.tag ?? '').toLowerCase() : '',
        lowStock ? 'only a few left' : '',
      ];
      items.push({ product: e.product, score: Math.round(score * 1000) / 1000, reasons, reason: reasonLine(reasons, 2) });
    }
    items.sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name));
    const evidence: Evidence[] = [
      { kind: 'data', label: 'Time of day', value: ctx.timeOfDay },
      { kind: 'data', label: 'Season', value: ctx.season },
      { kind: 'business', label: 'Hidden (sold out)', value: hidden },
    ];
    return { result: items, confidence: 0.8, evidence, provider: 'rules', providerKind: 'deterministic', modelVersion: CONTENT_VERSION, rankingVersion: null, fallbackUsed: false, warnings: [] };
  });
}

/** Mood suggestions for the search prompts, chosen for the moment. Each one is a query the search engine answers well. */
export function moodsFor(ctx: Pick<IntelligenceContext, 'timeOfDay' | 'season'>): string[] {
  const byTime: Record<TimeOfDay, string[]> = {
    morning: ['a flaky breakfast', 'a hot coffee', 'something nutty'],
    afternoon: ['a cold coffee', 'something sweet', 'light and refreshing'],
    evening: ['something chocolatey', 'a birthday cake', 'not too sweet'],
    night: ['something chocolatey', 'not too sweet', 'a cake for 8'],
  };
  const bySeason: Record<Season, string> = { summer: 'something with mango', monsoon: 'something warm', 'post-monsoon': 'something warm and nutty', winter: 'something rich' };
  return [...new Set([...byTime[ctx.timeOfDay], bySeason[ctx.season]])].slice(0, 4);
}

export type Rendition = { mode: 'video' | 'image'; src: string; loading: 'eager' | 'lazy'; reason: string };

/** Which version of an asset to serve: no autoplay video on slow connections or with reduced motion; lazy-load non-hero media on slow networks. */
export function selectRendition(asset: MediaAsset, ctx: Pick<IntelligenceContext, 'network' | 'reducedMotion' | 'device'>, eager = false): Rendition {
  const slow = ctx.network === 'slow';
  const loading = eager || asset.priority === 'high' ? (slow && asset.motionRole !== 'hero' ? 'lazy' : 'eager') : 'lazy';
  if (asset.type === 'video') {
    if (ctx.reducedMotion) return { mode: 'image', src: asset.poster ?? asset.src, loading, reason: 'reduced motion: still poster' };
    if (slow) return { mode: 'image', src: asset.poster ?? asset.src, loading, reason: 'slow connection: still poster' };
    return { mode: 'video', src: asset.src, loading, reason: 'full motion' };
  }
  return { mode: 'image', src: ctx.device === 'mobile' && asset.mobile ? asset.mobile : asset.src, loading, reason: ctx.device === 'mobile' && asset.mobile ? 'mobile crop' : 'standard image' };
}
