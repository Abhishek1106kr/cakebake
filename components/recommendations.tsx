'use client';

import { motion } from 'framer-motion';
import type { IntelligenceResult, Recommendation } from '@/engine/intelligence';
import { ProductCard } from './product-card';
import { track, useCartSuggestions, usePairs, useTrackOnce } from './intelligence';
import { useStore } from './store-provider';
import { EASE } from '@/lib/motion';

function Row({ surface, eyebrow, title, recs }: { surface: string; eyebrow: string; title: string; recs: IntelligenceResult<Recommendation[]> }) {
  const { mounted } = useStore();
  const items = recs.result;
  useTrackOnce(mounted && items.length > 0, `${surface}:${items.map((r) => r.product.id).join(',')}`, () =>
    track('recommendation_shown', { surface, productIds: items.map((r) => r.product.id), version: recs.rankingVersion }));
  if (!mounted || items.length === 0) return null;
  return (
    <section className="section reco-row">
      <div className="container">
        <div className="reco-head"><span className="eyebrow">{eyebrow}</span><h2 className="display reco-title">{title}</h2></div>
        <div className={`product-grid reco-grid reco-grid-${Math.min(items.length, 4)}`}>
          {items.map((r, i) => (
            <motion.div key={r.product.id} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6, ease: EASE, delay: i * 0.06 }}
              onClickCapture={() => track('recommendation_clicked', { surface, productId: r.product.id, kind: r.kind })}>
              <ProductCard product={r.product} compact note={r.reason} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** "Goes well with" under a product. */
export function PairsRow({ productId }: { productId: string }) {
  const recs = usePairs([productId], 4);
  return <Row surface="product" eyebrow="Goes well with" title="Make it a moment." recs={recs} />;
}

/** Add-ons under the bag, including the free-delivery nudge. */
export function CartSuggestions() {
  const { cart } = useStore();
  const recs = useCartSuggestions(3);
  if (cart.length === 0) return null;
  return <Row surface="cart" eyebrow="Add to your order" title="Something to go with it?" recs={recs} />;
}
