'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Minus, Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { OrderElsewhere } from '@/components/external/order-elsewhere';
import { ProductArt } from '@/components/media/product-art';
import { Reveal } from '@/components/motion/reveal';
import { useFeedback } from '@/components/providers/feedback-provider';
import { useStore } from '@/components/providers/store-provider';
import { categoryLabel, getProduct, products, relatedProducts, type Size } from '@/data/products';
import { MAX_QTY_PER_LINE, unitPrice } from '@/lib/cart/pricing';
import { formatPrice } from '@/lib/format';
import { EASE } from '@/lib/motion/transitions';
import { AddToCartButton } from './add-to-cart-button';
import { Disclosure } from './disclosure';
import { ProductAnatomy } from './product-anatomy';
import { ProductCard } from './product-card';

const VIEWS = [
  { id: 'whole', label: 'Whole' },
  { id: 'detail', label: 'Detail' },
  { id: 'pair', label: 'Paired' },
] as const;

export function ProductView({ slug }: { slug: string }) {
  const product = getProduct(slug)!;
  const reduce = useReducedMotion();
  const { addToCart, markViewed, recent, ready } = useStore();
  const { flyToBag, toast } = useFeedback();
  const [view, setView] = useState<(typeof VIEWS)[number]['id']>('whole');
  const [size, setSize] = useState<Size>('regular');
  const [qty, setQty] = useState(1);
  const mediaRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => { markViewed(product.slug); }, [product.slug, markViewed]);

  const price = unitPrice(product, size);
  const index = products.findIndex((p) => p.slug === product.slug);
  const recentlyViewed = ready ? recent.filter((s) => s !== product.slug).map(getProduct).filter((p) => p !== undefined).slice(0, 3) : [];

  const add = () => {
    const added = addToCart(product.slug, size, qty);
    if (added === 0) { toast(`We can pack up to ${MAX_QTY_PER_LINE} of one item.`); return false; }
    flyToBag(mediaRef.current, product);
    toast(added < qty ? `Added ${added}: that’s the most we can pack.` : `${product.name} is in your bag.`, { href: '/cart', label: 'View bag' });
    return true;
  };

  const onZoomMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || event.pointerType !== 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    setZoom({ x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 });
  };

  return (
    <main className="product-page">
      <div className="wrap">
        <Link href="/menu" className="back-link"><ArrowLeft size={14} strokeWidth={1.5} /> Back to menu</Link>
      </div>

      <div className="product-layout wrap">
        <div className="gallery">
          <div
            ref={mediaRef}
            className={`gallery-main ${zoom ? 'is-zooming' : ''}`}
            onPointerMove={onZoomMove}
            onPointerLeave={() => setZoom(null)}
            style={zoom ? ({ '--zx': `${zoom.x}%`, '--zy': `${zoom.y}%` } as React.CSSProperties) : undefined}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div key={view} className="gallery-frame" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: EASE }}>
                <ProductArt product={product} view={view} priority sizes="(max-width: 860px) 100vw, 55vw" />
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="gallery-thumbs" role="tablist" aria-label="Product views">
            {VIEWS.map((item, i) => (
              <motion.button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={view === item.id}
                className={`thumb ${view === item.id ? 'is-active' : ''}`}
                onClick={() => setView(item.id)}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.07, duration: 0.4, ease: EASE }}
              >
                <ProductArt product={product} view={item.id} sizes="120px" />
                <span>{item.label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        <section className="product-info" aria-labelledby="product-title">
          <div className="eyebrow eyebrow-light">{String(index + 1).padStart(2, '0')} / {product.signature ? 'Signature ' : ''}{categoryLabel(product.category)}</div>
          <h1 id="product-title" className="product-title display">{product.name}</h1>
          <p className="product-short">{product.short}</p>
          <p className="product-story">{product.story}</p>

          <div className="price-row">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={price * qty} className="price-lg display" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                {formatPrice(price * qty)}
              </motion.span>
            </AnimatePresence>
            {qty > 1 && <span className="price-each">{formatPrice(price)} each</span>}
          </div>

          <div className="fresh-note"><span className="breathing-dot" aria-hidden="true" /> Freshly prepared · about {product.prepMinutes} min</div>

          {product.sizes && (
            <fieldset className="option-group">
              <legend className="eyebrow eyebrow-light">Size</legend>
              <div className="segmented">
                {product.sizes.map((s) => (
                  <button key={s} type="button" className={size === s ? 'is-active' : ''} aria-pressed={size === s} onClick={() => setSize(s)}>
                    {s === 'regular' ? 'Regular' : `Large · ${formatPrice(unitPrice(product, 'large'))}`}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <div className="option-group">
            <span className="eyebrow eyebrow-light" id="qty-label">Quantity</span>
            <div className="stepper is-light" role="group" aria-labelledby="qty-label">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="One fewer"><Minus size={14} /></button>
              <output aria-live="polite">{qty}</output>
              <button type="button" onClick={() => setQty((q) => Math.min(MAX_QTY_PER_LINE, q + 1))} disabled={qty >= MAX_QTY_PER_LINE} aria-label="One more"><Plus size={14} /></button>
            </div>
          </div>

          <AddToCartButton label={`Add to bag · ${formatPrice(price * qty)}`} onAdd={add} />

          <ul className="diet-tags" aria-label="Dietary information">
            <li>Vegetarian</li>
            {product.eggless && <li>Eggless</li>}
            {product.allergens.length === 0 ? <li>No common allergens</li> : <li>Contains {product.allergens.join(', ').toLowerCase()}</li>}
          </ul>

          <div className="info-block">
            <div className="eyebrow eyebrow-light">Delivery / pickup</div>
            <p>Delivered around Whitefield, or ready at the counter. Choose a time at checkout.</p>
            <OrderElsewhere compact className="on-dark" />
          </div>
        </section>
      </div>

      <ProductAnatomy product={product} />

      <section className="wrap product-details" aria-label="Details">
        <Disclosure title="Ingredients & allergens" defaultOpen>
          <p>{product.allergens.length ? `Contains: ${product.allergens.join(', ')}.` : 'No common allergens.'} Made in a kitchen that handles nuts, gluten, dairy and egg.</p>
        </Disclosure>
        <Disclosure title="How to enjoy it"><p>{product.enjoy}</p></Disclosure>
        <Disclosure title="Storage"><p>{product.storage}</p></Disclosure>
      </section>

      <section className="wrap related" aria-labelledby="related-title">
        <Reveal><div className="eyebrow" id="related-title">You may also like</div></Reveal>
        <div className="related-grid">
          {relatedProducts(product).map((item) => <ProductCard key={item.slug} product={item} />)}
        </div>
        {recentlyViewed.length > 0 && (
          <>
            <div className="eyebrow related-recent">Recently viewed</div>
            <div className="recent-row">
              {recentlyViewed.map((item) => (
                <Link key={item.slug} href={`/product/${item.slug}`} className="recent-item">
                  <ProductArt product={item} sizes="96px" />
                  <span className="display">{item.name}</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>

      <div className="mobile-buy-bar">
        <span className="display">{formatPrice(price * qty)}</span>
        <AddToCartButton label="Add to bag" onAdd={add} className="is-compact" />
      </div>
    </main>
  );
}
