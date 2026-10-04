'use client';

// React glue for the intelligence engine: feeds it live stock and sales from the
// store, and records page and search events. No ranking or rules live here.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { products, type Product } from '@/lib/data';
import { availableUnits } from '@/lib/inventory';
import { useStore } from './store-provider';
import { browserContext, cartSuggestions, forYou, moodsFor, orderShowcase, pairsWith, search, unitsSold, type IntelligenceContext, type SearchResult, type IntelligenceResult } from '@/engine/intelligence';
import { track } from '@/engine/intelligence/events/track';

export { track };

/** Live inputs the engine needs: what the kitchen can make now, and what's been selling. */
export function useEngineInputs() {
  const { inventory, orders } = useStore();
  const availability = useCallback((p: Product) => availableUnits(inventory, [], p.id, 'Regular'), [inventory]);
  const popularity = useMemo(() => unitsSold(orders), [orders]);
  return { availability, popularity, orders };
}

export function useSearch(query: string): IntelligenceResult<SearchResult> {
  const { availability, popularity } = useEngineInputs();
  return useMemo(() => search(query, { products, availability, popularity }), [query, availability, popularity]);
}

/** Records one search_completed per settled query (after the customer stops typing). */
export function useTrackSearch(query: string, result: IntelligenceResult<SearchResult>, surface: 'menu' | 'header') {
  const last = useRef('');
  useEffect(() => {
    const q = query.trim();
    if (!q || q === last.current) return;
    const t = setTimeout(() => {
      last.current = q;
      const r = result.result;
      track('search_completed', {
        query: q.slice(0, 80),
        resultCount: r.relaxed.includes('everything') ? 0 : r.hits.length,
        zeroResult: r.relaxed.includes('everything'),
        relaxed: r.relaxed,
        corrected: r.corrections.map((c) => c.to),
        confidence: Math.round(result.confidence * 100) / 100,
        surface,
      });
    }, 900);
    return () => clearTimeout(t);
  }, [query, result, surface]);
}

export function usePairs(productIds: string[], limit = 4) {
  const { availability, orders } = useEngineInputs();
  const key = productIds.join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => pairsWith(productIds, { products, availability, orders, limit }), [key, availability, orders, limit]);
}

export function useCartSuggestions(limit = 3) {
  const { availability, orders } = useEngineInputs();
  const { cart, toFreeDelivery } = useStore();
  return useMemo(() => cartSuggestions(cart.map((l) => ({ productId: l.product.id })), toFreeDelivery, { products, availability, orders, limit }), [cart, toFreeDelivery, availability, orders, limit]);
}

/** The browser's context (time, season, device, network). Null until mounted, so server and client render the same first. */
export function useClientContext(): IntelligenceContext | null {
  const [ctx, setCtx] = useState<IntelligenceContext | null>(null);
  useEffect(() => {
    setCtx(browserContext());
    // Time of day moves on; refresh every ten minutes.
    const t = setInterval(() => setCtx(browserContext()), 600000);
    return () => clearInterval(t);
  }, []);
  return ctx;
}

/** Products ordered for this moment (time, season, stock, sales). Falls back to menu order before mount. */
export function useShowcase() {
  const ctx = useClientContext();
  const { availability, popularity } = useEngineInputs();
  return useMemo(() => {
    if (!ctx) return { items: products.map((product) => ({ product, reason: null as string | null })), moods: null as string[] | null };
    return { items: orderShowcase(ctx, { products, availability, popularity }).result, moods: moodsFor(ctx) };
  }, [ctx, availability, popularity]);
}

export function useForYou(limit = 4) {
  const ctx = useClientContext();
  const { availability } = useEngineInputs();
  const { myOrders } = useStore();
  return useMemo(() => (ctx ? forYou({ timeOfDay: ctx.timeOfDay, history: myOrders }, { products, availability, limit }) : null), [ctx, myOrders, availability, limit]);
}

/** One page_view per customer-facing route change. */
export function PageViewTracker() {
  const path = usePathname();
  useEffect(() => {
    if (path && !path.startsWith('/admin')) track('page_view', { path });
  }, [path]);
  return null;
}

/** Fires an event once when `when` first becomes true for a given key. */
export function useTrackOnce(when: boolean, key: string, fire: () => void) {
  const done = useRef<string | null>(null);
  useEffect(() => {
    if (!when || done.current === key) return;
    done.current = key;
    fire();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [when, key]);
}
