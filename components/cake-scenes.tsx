'use client';

// Cake scenes for the homepage (cake image system). The cake is revealed, not boxed.

import Link from 'next/link';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion, useTransform, type MotionValue } from 'framer-motion';
import { useMemo, useRef, useState } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import { MaskedReveal, Media, Parallax, ScrollScene, SplitText } from './cinematic';
import { CakeEditorial, SweetnessDots } from './cake';
import { useStore } from './store-provider';
import { useTransitions } from './transitions';
import { cakeImage, cakeScenes } from '@/lib/cake-assets';
import { products } from '@/lib/data';
import { EASE, T } from '@/lib/motion';

const SIGNATURE = products.find((p) => p.id === 'rose-chocolate-truffle')!;
const COLLECTION = products.filter((p) => p.cake && p.id !== SIGNATURE.id);

// ---------- Cake reveal: whole cake → crop into macro → typography ----------
export function SceneCakeReveal() {
  return <ScrollScene height="270vh" className="scene-cake-reveal">{(p) => <CakeRevealInner progress={p} />}</ScrollScene>;
}

function CakeRevealInner({ progress }: { progress: MotionValue<number> }) {
  const reduce = useReducedMotion();
  // Full-bleed: the cake fills the frame on its own backdrop (16:9, or the 9:16 crop on phones),
  // then one continuous push carries the camera into the rose.
  const hero = cakeImage('rose-truffle', 'hero');
  const push = useTransform(progress, [0, 0.62, 1], [1, 2.35, 2.6]);
  const titleOpacity = useTransform(progress, [0, 0.22], [1, 0]);
  const titleY = useTransform(progress, [0, 0.22], [0, -40]);
  const dim = useTransform(progress, [0.5, 0.72], [0, 0.55]);
  const lineA = useTransform(progress, [0.6, 0.76], ['110%', '0%']);
  const lineB = useTransform(progress, [0.66, 0.82], ['110%', '0%']);
  const ctaOpacity = useTransform(progress, [0.8, 0.92], [0, 1]);
  return (
    <div className="cake-reveal">
      <motion.div className="cake-reveal-frame" style={reduce ? undefined : { scale: push }} initial={reduce ? false : { opacity: 0, scale: 1.06 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1.2 }}>
        <Media asset={hero} eager />
      </motion.div>
      <motion.div className="cake-reveal-dim" style={{ opacity: reduce ? 0.45 : dim }} />
      <motion.div className="cake-reveal-title" style={reduce ? { opacity: 0 } : { opacity: titleOpacity, y: titleY }}>
        <span className="eyebrow">The signature</span>
        <SplitText as="h2" text="Rose Chocolate Truffle" by="word" className="cake-reveal-name" />
      </motion.div>
      <div className="cake-reveal-type" aria-label="Layer by layer, by hand.">
        <span className="line-mask" aria-hidden="true"><motion.span className="line-inner" style={reduce ? undefined : { y: lineA }}>Layer by layer,</motion.span></span>
        <span className="line-mask" aria-hidden="true"><motion.span className="line-inner italic" style={reduce ? undefined : { y: lineB }}>by hand.</motion.span></span>
        <motion.div style={reduce ? undefined : { opacity: ctaOpacity }}><Link href="/shop/rose-chocolate-truffle" className="btn btn-light">Meet the cake <ArrowRight size={16} /></Link></motion.div>
      </div>
    </div>
  );
}

// ---------- Signature cake: editorial composition ----------
export function SceneSignatureCake() {
  const { addToCart } = useStore();
  const { flyToBag, travelTo } = useTransitions();
  const ref = useRef<HTMLDivElement>(null);
  const cake = SIGNATURE.cake!;
  const shot = cakeImage(cake.slug, 'product');
  const visual = { src: shot.src, tone: shot.tone };
  return (
    <section className="scene-signature-cake">
      <div className="sig-cake-media" ref={ref}>
        <Parallax distance={90} className="sig-cake-main"><MaskedReveal><Media asset={shot} sizes="(max-width: 900px) 92vw, 52vw" /></MaskedReveal></Parallax>
        <Parallax distance={-120} className="sig-cake-inset"><MaskedReveal from="center"><Media asset={cakeImage(cake.slug, 'macro')} sizes="22vw" /></MaskedReveal></Parallax>
      </div>
      <div className="sig-cake-copy">
        <div className="eyebrow">The signature cake</div>
        <SplitText as="h2" text={SIGNATURE.name} className="sig-cake-title" />
        <motion.p initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ ...T.editorial, delay: 0.3 }} className="sig-cake-story">{cake.story}</motion.p>
        <motion.dl className="sig-cake-facts" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={{ visible: { transition: { staggerChildren: 0.08, delayChildren: 0.4 } } }}>
          {[['Flavour', cake.flavorProfile.join(' · ')], ['Texture', cake.texture], ['Serves', cake.size]].map(([k, v]) => (
            <motion.div key={k} variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: T.editorial } }}><dt>{k}</dt><dd>{v}</dd></motion.div>
          ))}
          <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: T.editorial } }}><dt>Sweetness</dt><dd><SweetnessDots level={cake.sweetness} /></dd></motion.div>
        </motion.dl>
        <div className="sig-cake-actions">
          <span className="sig-cake-price">₹{SIGNATURE.price.toLocaleString('en-IN')}</span>
          <motion.button whileTap={{ scale: 0.95 }} className="btn btn-brand" onClick={() => { if (addToCart(SIGNATURE) > 0) flyToBag(ref.current, visual); }}><Plus size={16} /> Add to bag</motion.button>
          <button className="text-link" onClick={() => travelTo(`/shop/${SIGNATURE.id}`, ref.current, visual)}>The details <ArrowRight size={14} /></button>
        </div>
      </div>
    </section>
  );
}

// ---------- Cake collection: editorial, filterable by occasion ----------
const OCCASIONS = ['All', 'Birthday', 'Celebration', 'Everyday', 'Gift', 'Dinner party'];

export function SceneCakeCollection() {
  const reduce = useReducedMotion();
  const [occasion, setOccasion] = useState('All');
  const shown = useMemo(() => (occasion === 'All' ? COLLECTION : COLLECTION.filter((p) => p.cake!.occasion.includes(occasion))), [occasion]);
  return (
    <section className="scene-cake-collection">
      <div className="collection-head">
        <div>
          <div className="eyebrow">The cake collection</div>
          <SplitText as="h2" text="Whole cakes, baked to order." className="collection-title" />
        </div>
        <div className="occasion-filter" role="group" aria-label="Filter by occasion">
          {OCCASIONS.map((o) => (
            <button key={o} className={occasion === o ? 'is-active' : ''} aria-pressed={occasion === o} onClick={() => setOccasion(o)}>
              {o}{occasion === o && <motion.span layoutId="occasion-underline" className="occasion-underline" transition={T.ui} />}
            </button>
          ))}
        </div>
      </div>
      <LayoutGroup>
        <motion.div layout={!reduce} className="collection-grid">
          <AnimatePresence mode="popLayout" initial={false}>
            {shown.map((p, i) => (
              <motion.div key={p.id} layout={!reduce} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ duration: 0.7, ease: EASE, delay: (i % 2) * 0.08 }}>
                <CakeEditorial product={p} index={i} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </LayoutGroup>
      <div className="collection-foot"><Link href="/shop" className="text-link">Everything on the counter <ArrowRight size={14} /></Link></div>
    </section>
  );
}

// ---------- The cut: a knife-like diagonal sweep reveals the serving shot ----------
export function SceneCut() {
  return <ScrollScene height="220vh" className="scene-cut">{(p) => <CutInner progress={p} />}</ScrollScene>;
}

function CutInner({ progress }: { progress: MotionValue<number> }) {
  const reduce = useReducedMotion();
  const edge = useTransform(progress, [0.05, 0.6], [-30, 130]);
  const clipPath = useTransform(edge, (e) => `polygon(0% 0%, ${e + 20}% 0%, ${e - 20}% 100%, 0% 100%)`);
  const knifeX = useTransform(edge, (e) => `${e}%`);
  const knifeOpacity = useTransform(progress, [0.05, 0.1, 0.55, 0.62], [0, 1, 1, 0]);
  const imgScale = useTransform(progress, [0, 1], [1.12, 1]);
  const titleY = useTransform(progress, [0.45, 0.65], ['110%', '0%']);
  const copyOpacity = useTransform(progress, [0.6, 0.78], [0, 1]);
  return (
    <div className="cut">
      <motion.div className="cut-media" style={reduce ? undefined : { clipPath }}>
        <Media asset={cakeScenes.cut} imgStyle={reduce ? undefined : { scale: imgScale }} />
      </motion.div>
      {!reduce && <motion.span className="cut-knife" style={{ left: knifeX, opacity: knifeOpacity }} aria-hidden="true" />}
      <div className="cut-copy">
        <span className="line-mask"><motion.span className="line-inner" style={reduce ? undefined : { y: titleY }}>Cut into it.</motion.span></span>
        <motion.div style={reduce ? undefined : { opacity: copyOpacity }}>
          <p>Every slice shows the work: the sponge, the mousse, the layer that holds it all together.</p>
          <Link href="/shop?q=cake" className="btn btn-light">Order a whole cake <ArrowRight size={16} /></Link>
        </motion.div>
      </div>
    </div>
  );
}

/** Lifestyle cake image used by the story scene. */
export const lifestyleAsset = cakeScenes.lifestyle;
