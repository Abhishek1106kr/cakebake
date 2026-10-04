'use client';

// Cake presentation: editorial collection entries and the cake campaign page.

import Link from 'next/link';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Minus, Plus } from 'lucide-react';
import { MaskedReveal, Media, SplitText } from './cinematic';
import { useStore } from './store-provider';
import { useTransitions } from './transitions';
import { ExternalOrderButtons } from './external-order-buttons';
import { cakeImage, cakeScenes } from '@/lib/cake-assets';
import type { Product } from '@/lib/data';
import { EASE, EASE_IMAGE, T } from '@/lib/motion';

export function SweetnessDots({ level }: { level: number }) {
  return (
    <span className="sweetness" aria-label={`Sweetness ${level} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= level ? 'on' : ''} />)}
    </span>
  );
}

/** Editorial collection entry: large image, oversized name, minimal metadata. */
export function CakeEditorial({ product, index }: { product: Product; index: number }) {
  const reduce = useReducedMotion();
  const { addToCart } = useStore();
  const { flyToBag, travelTo } = useTransitions();
  const ref = useRef<HTMLDivElement>(null);
  const [added, setAdded] = useState(false);
  const cake = product.cake!;
  const img = cakeImage(cake.slug, 'product');
  const visual = { src: img.src, tone: img.tone };
  const add = () => {
    if (addToCart(product) === 0) return;
    flyToBag(ref.current, visual);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1300);
  };
  return (
    <motion.article className={`cake-entry ${index % 2 ? 'is-offset' : ''}`} initial="rest" whileHover="hover" animate="rest">
      <div ref={ref} className="cake-entry-media" role="link" tabIndex={0} aria-label={product.name}
        onClick={() => travelTo(`/shop/${product.id}`, ref.current, visual)}
        onKeyDown={(e) => { if (e.key === 'Enter') travelTo(`/shop/${product.id}`, ref.current, visual); }}>
        <motion.div className="cake-entry-img" variants={reduce ? undefined : { rest: { scale: 1, y: 0 }, hover: { scale: 1.035, y: -8, transition: { duration: 0.8, ease: EASE } } }}>
          <Media asset={img} sizes="(max-width: 900px) 90vw, 40vw" />
        </motion.div>
        <span className="cake-entry-num">{String(index + 1).padStart(2, '0')}</span>
      </div>
      <motion.div className="cake-entry-copy" variants={reduce ? undefined : { rest: { x: 0 }, hover: { x: 10, transition: T.editorial } }}>
        <h3 className="cake-entry-name">{product.name}</h3>
        <p className="cake-entry-desc">{product.description}</p>
        <motion.p className="cake-entry-detail" variants={reduce ? undefined : { rest: { opacity: 0, y: 6 }, hover: { opacity: 1, y: 0, transition: T.ui } }}>
          {cake.flavorProfile.join(' · ')} — {cake.texture.toLowerCase()}
        </motion.p>
        <div className="cake-entry-foot">
          <span className="cake-entry-price">₹{product.price.toLocaleString('en-IN')}</span>
          <motion.button className={`cake-add ${added ? 'is-added' : ''}`} whileTap={{ scale: 0.94 }} onClick={add} aria-label={`Add ${product.name} to bag`}>
            {added ? 'Added' : '+ Add'}
          </motion.button>
        </div>
      </motion.div>
    </motion.article>
  );
}

/** Cake detail as a product campaign. */
export function CakeCampaign({ product }: { product: Product }) {
  const reduce = useReducedMotion();
  const cake = product.cake!;
  const { addToCart, canAddMore, mounted } = useStore();
  const { flyToBag } = useTransitions();
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const productRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: stripRef, offset: ['start end', 'end start'] });
  const stripX = useTransform(scrollYProgress, [0, 1], ['6%', '-26%']);
  const hero = cakeImage(cake.slug, 'hero');
  const shot = cakeImage(cake.slug, 'product');
  const macro = cakeImage(cake.slug, 'macro');
  const available = mounted ? canAddMore(product) : 99;

  const add = () => {
    const n = addToCart(product, Math.min(qty, available));
    if (n === 0) { setNote('That’s the most we can bake for one order today.'); return; }
    flyToBag(productRef.current, { src: shot.src, tone: shot.tone });
    setNote(`${product.name} is in your bag.`);
  };

  return (
    <main className="cake-campaign">
      <section className="campaign-hero">
        <motion.div className="campaign-hero-media" initial={reduce ? false : { clipPath: 'inset(0% 50% 0% 50%)' }} animate={{ clipPath: 'inset(0% 0% 0% 0%)' }} transition={{ duration: 1.4, ease: EASE_IMAGE }}>
          <motion.div className="campaign-hero-inner" initial={reduce ? false : { scale: 1.15 }} animate={{ scale: 1 }} transition={{ duration: 2.2, ease: EASE_IMAGE }}>
            <Media asset={hero} eager />
          </motion.div>
        </motion.div>
        <div className="campaign-hero-copy">
          <Link href="/shop" className="campaign-back"><ArrowLeft size={14} /> The menu</Link>
          <motion.div className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>{product.tag ?? 'Whole cake'} · {cake.size}</motion.div>
          <SplitText as="h1" text={product.name} by="word" trigger="mount" delay={0.7} className="campaign-title" />
        </div>
      </section>

      <section className="campaign-body">
        <div className="campaign-sticky" ref={productRef}>
          <MaskedReveal className="campaign-product"><Media asset={shot} sizes="(max-width: 900px) 92vw, 46vw" /></MaskedReveal>
        </div>
        <div className="campaign-info">
          <motion.p className="campaign-story" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={T.editorial}>{cake.story}</motion.p>
          <dl className="campaign-facts">
            <div><dt>Flavour</dt><dd>{cake.flavorProfile.join(' · ')}</dd></div>
            <div><dt>Texture</dt><dd>{cake.texture}</dd></div>
            <div><dt>Sweetness</dt><dd><SweetnessDots level={cake.sweetness} /></dd></div>
            <div><dt>Perfect for</dt><dd>{cake.occasion.join(', ')}</dd></div>
            <div><dt>Availability</dt><dd>{cake.availability}</dd></div>
          </dl>
          <div className="campaign-ingredients">
            <div className="eyebrow">Ingredients</div>
            <ul>{cake.ingredients.map((i) => <li key={i}>{i}</li>)}</ul>
          </div>
          <div className="campaign-order">
            <motion.div key={qty} className="campaign-price" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={T.ui}>₹{(product.price * qty).toLocaleString('en-IN')}</motion.div>
            <div className="qty">
              <button aria-label="One fewer" onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus size={14} /></button>
              <span>{qty}</span>
              <button aria-label="One more" disabled={qty >= Math.min(available, 5)} onClick={() => setQty((q) => Math.min(5, available, q + 1))}><Plus size={14} /></button>
            </div>
            <motion.button className="btn btn-brand btn-lg full-btn" whileTap={{ scale: 0.97 }} onClick={add} disabled={available === 0}>Add to bag <ArrowRight size={16} /></motion.button>
            {note && <motion.p className="campaign-note" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{note} <Link href="/cart">View bag →</Link></motion.p>}
            <p className="campaign-small">{cake.availability === 'Order 24 h ahead' ? 'Baked to order: choose a delivery slot from tomorrow at checkout.' : 'Baked daily. Order before 4 pm for same-day delivery.'}</p>
            <ExternalOrderButtons compact />
          </div>
        </div>
      </section>

      <section ref={stripRef} className="campaign-strip" aria-label="Details">
        <motion.div className="campaign-strip-row" style={reduce ? undefined : { x: stripX }}>
          <figure className="strip-macro"><Media asset={macro} sizes="40vw" /><figcaption>The finish</figcaption></figure>
          <figure className="strip-tall"><Media asset={cakeScenes.lifestyle} sizes="30vw" /><figcaption>On the table</figcaption></figure>
          <figure className="strip-wide"><Media asset={cakeScenes.cut} sizes="45vw" /><figcaption>Cut into it</figcaption></figure>
        </motion.div>
      </section>
    </main>
  );
}
