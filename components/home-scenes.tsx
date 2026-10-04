'use client';

// Homepage scenes (MOTION.md scene map). Each scene has one motion idea.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useTransform, type MotionValue } from 'framer-motion';
import { useRef, useState } from 'react';
import { ArrowRight, MapPin, Plus } from 'lucide-react';
import { GlazeReveal, HorizontalTrack, LaminationReveal, MaskedReveal, Media, Parallax, ScrollScene, SplitText } from './cinematic';
import { Magnetic } from './motion';
import { useStore } from './store-provider';
import { useTransitions } from './transitions';
import { media, productMedia } from '@/lib/media';
import { cakeScenes } from '@/lib/cake-assets';
import { products, type Product } from '@/lib/data';
import { EASE, EASE_IMAGE, HERO, T } from '@/lib/motion';

const find = (id: string) => products.find((p) => p.id === id)!;

// ---------- 01 Opening: proving, camera push, steam ----------
export function SceneOpening() {
  const reduce = useReducedMotion();
  return (
    <ScrollScene height="230vh" className="scene-opening">
      {(p) => <OpeningInner progress={p} reduce={Boolean(reduce)} />}
    </ScrollScene>
  );
}

function OpeningInner({ progress, reduce }: { progress: MotionValue<number>; reduce: boolean }) {
  const push = useTransform(progress, [0, 1], [1, 1.28]);
  const dim = useTransform(progress, [0, 0.8], [0.25, 0.72]);
  const tracking = useTransform(progress, [0, 0.45], ['0.02em', '0.55em']);
  const wordOpacity = useTransform(progress, [0.1, 0.45], [1, 0]);
  const wordY = useTransform(progress, [0, 0.45], [0, -90]);
  const lineA = useTransform(progress, [0.32, 0.55], ['110%', '0%']);
  const lineB = useTransform(progress, [0.4, 0.63], ['110%', '0%']);
  const metaOpacity = useTransform(progress, [0.55, 0.75], [0, 1]);
  const cueOpacity = useTransform(progress, [0, 0.12], [1, 0]);
  return (
    <div className="opening">
      <motion.div className="opening-media" initial={reduce ? false : { clipPath: 'inset(47% 0% 47% 0%)' }} animate={{ clipPath: 'inset(0% 0% 0% 0%)' }} transition={{ delay: HERO.media, duration: 1.5, ease: EASE_IMAGE }}>
        <motion.div className="opening-push" style={reduce ? undefined : { scale: push }}>
          <motion.div className="proving" initial={reduce ? false : { scale: 1.18 }} animate={{ scale: 1 }} transition={{ delay: HERO.media, duration: 2.4, ease: EASE_IMAGE }}>
            <Media asset={media.heroFilm} eager />
          </motion.div>
        </motion.div>
        <motion.div className="opening-dim" style={{ opacity: reduce ? 0.45 : dim }} />
      </motion.div>

      <motion.div className="opening-word" style={reduce ? undefined : { letterSpacing: tracking, opacity: wordOpacity, y: wordY }}>
        <SplitText text="TRESOR" by="char" trigger="mount" delay={HERO.word} stagger={0.06} className="wordmark-xl" />
      </motion.div>

      <div className="opening-statement" aria-label="Good things take time.">
        <span className="line-mask" aria-hidden="true"><motion.span className="line-inner" style={reduce ? undefined : { y: lineA }}>Good things</motion.span></span>
        <span className="line-mask" aria-hidden="true"><motion.span className="line-inner italic" style={reduce ? undefined : { y: lineB }}>take time.</motion.span></span>
        <motion.div className="opening-meta" style={reduce ? undefined : { opacity: metaOpacity }}>
          <span>Bakery · Indiranagar, Bengaluru</span>
          <Magnetic><Link href="/shop" className="btn btn-light">Explore the menu <ArrowRight size={16} /></Link></Magnetic>
        </motion.div>
      </div>

      <motion.div className="scroll-cue" style={reduce ? undefined : { opacity: cueOpacity }} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: HERO.detail }}>
        <span>Scroll</span><motion.i animate={reduce ? undefined : { scaleY: [0, 1, 0], originY: [0, 0, 1] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} />
      </motion.div>
    </div>
  );
}

// ---------- 02 Craft: lamination ----------
const CRAFT = [
  { word: 'Flour.', line: 'Milled fine, rested long.', asset: media.craftFlour },
  { word: 'Butter.', line: 'Cultured, cold, folded in.', asset: media.craftButter },
  { word: 'Time.', line: 'Measured in folds, not minutes.', asset: media.craftTime },
];

export function SceneCraft() {
  return <ScrollScene height="320vh" className="scene-craft">{(p) => <CraftInner progress={p} />}</ScrollScene>;
}

function CraftInner({ progress }: { progress: MotionValue<number> }) {
  const [active, setActive] = useState(0);
  useMotionValueEvent(progress, 'change', (v) => setActive(Math.min(CRAFT.length - 1, Math.floor(v * CRAFT.length * 0.999))));
  return (
    <div className="craft">
      <div className="craft-copy">
        <div className="eyebrow">02 / The craft</div>
        <ol className="craft-words">
          {CRAFT.map((c, i) => (
            <li key={c.word} className={i === active ? 'is-active' : i < active ? 'is-past' : ''}>
              <motion.span className="craft-word display" animate={{ x: i === active ? 0 : -18, opacity: i === active ? 1 : 0.18 }} transition={T.editorial}>{c.word}</motion.span>
              <AnimatePresence>{i === active && <motion.span className="craft-line" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={T.ui}>{c.line}</motion.span>}</AnimatePresence>
            </li>
          ))}
        </ol>
        <div className="craft-count"><motion.span key={active} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={T.ui}>0{active + 1}</motion.span> / 0{CRAFT.length}</div>
      </div>
      <LaminationReveal className="craft-media" assets={CRAFT.map((c) => c.asset)} progress={progress} />
    </div>
  );
}

// ---------- 03 Signatures: pinned product scrollytelling ----------
const SIGNATURES = ['almond-croissant', 'basque-cheesecake', 'pistachio-tart'].map(find);

export function SceneSignatures() {
  return <ScrollScene height="340vh" className="scene-signatures">{(p) => <SignaturesInner progress={p} />}</ScrollScene>;
}

function SignaturesInner({ progress }: { progress: MotionValue<number> }) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  useMotionValueEvent(progress, 'change', (v) => setActive(Math.min(SIGNATURES.length - 1, Math.floor(v * SIGNATURES.length * 0.999))));
  const nameX = useTransform(progress, [0, 1], ['12%', '-38%']);
  const product = SIGNATURES[active];
  return (
    <div className="signatures">
      <div className="eyebrow signatures-eyebrow">03 / Signatures · 0{active + 1}</div>
      <motion.div className="signature-name display" style={reduce ? undefined : { x: nameX }} aria-hidden="true">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={product.id} initial={{ y: '60%', opacity: 0 }} animate={{ y: '0%', opacity: 1 }} exit={{ y: '-60%', opacity: 0 }} transition={{ duration: 0.8, ease: EASE }}>{product.name}</motion.span>
        </AnimatePresence>
      </motion.div>
      <div className="signature-stage">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={product.id} className="signature-image" initial={{ opacity: 0, scale: 1.08, rotate: -3, clipPath: 'inset(8% 8% 8% 8% round 28px)' }} animate={{ opacity: 1, scale: 1, rotate: 0, clipPath: 'inset(0% 0% 0% 0% round 28px)' }} exit={{ opacity: 0, scale: 0.94, rotate: 3 }} transition={{ duration: 1.0, ease: EASE_IMAGE }}>
            <Media asset={productMedia(product.image, product.name)} />
          </motion.div>
        </AnimatePresence>
      </div>
      <SignatureMeta product={product} />
    </div>
  );
}

function SignatureMeta({ product }: { product: Product }) {
  const { addToCart } = useStore();
  const { flyToBag, travelTo } = useTransitions();
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="signature-meta" ref={ref}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={product.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={T.editorial}>
          <div className="eyebrow">{product.category} · {product.prepMinutes} min</div>
          <p className="signature-desc">{product.description}</p>
          <div className="signature-price display">₹{product.price}</div>
          <div className="signature-actions">
            <motion.button whileTap={{ scale: 0.95 }} className="btn btn-brand" onClick={() => { if (addToCart(product) > 0) flyToBag(document.querySelector('.signature-image'), { src: productMedia(product.image, product.name).src, tone: productMedia(product.image, product.name).tone }); }}><Plus size={16} /> Add to bag</motion.button>
            <button className="text-link" onClick={() => travelTo(`/shop/${product.id}`, document.querySelector('.signature-image'), { src: productMedia(product.image, product.name).src, tone: productMedia(product.image, product.name).tone })}>The details <ArrowRight size={14} /></button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ---------- 04 Glaze: liquid wipe ----------
export function SceneGlaze() {
  return <ScrollScene height="210vh" className="scene-glaze">{(p) => <GlazeInner progress={p} />}</ScrollScene>;
}

function GlazeInner({ progress }: { progress: MotionValue<number> }) {
  const reduce = useReducedMotion();
  const words = ['Tempered.', 'Poured.', 'Set.'];
  return (
    <div className="glaze-scene">
      <GlazeReveal asset={media.glaze} progress={progress} className="glaze-media" />
      <div className="glaze-copy">
        <div className="eyebrow eyebrow-light">04 / The finish</div>
        <div className="glaze-words display">
          {words.map((w, i) => <GlazeWord key={w} word={w} index={i} progress={progress} reduce={Boolean(reduce)} />)}
        </div>
        <p>Chocolate worked by hand, glazed while it is still warm enough to shine.</p>
      </div>
    </div>
  );
}

function GlazeWord({ word, index, progress, reduce }: { word: string; index: number; progress: MotionValue<number>; reduce: boolean }) {
  const start = 0.2 + index * 0.18;
  const y = useTransform(progress, [start, start + 0.2], ['110%', '0%']);
  return <span className="line-mask"><motion.span className="line-inner" style={reduce ? undefined : { y }}>{word}</motion.span></span>;
}

// ---------- 05 Discovery: horizontal product universe ----------
const MOODS = ['something chocolatey', 'a cold coffee', 'something for brunch', 'not too sweet'];

export function SceneDiscovery() {
  const router = useRouter();
  const [q, setQ] = useState('');
  return (
    <section className="scene-discovery">
      <div className="container discovery-head">
        <div className="eyebrow">05 / The counter</div>
        <SplitText as="h2" text="What are you in the mood for?" className="display discovery-title" />
        <form className="mood-form" onSubmit={(e) => { e.preventDefault(); router.push(`/shop?q=${encodeURIComponent(q || 'something warm')}` as never); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="something warm and nutty…" aria-label="What are you in the mood for?" />
          <button className="btn btn-brand" type="submit">Find it <ArrowRight size={15} /></button>
        </form>
        <motion.div className="mood-chips-row" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={{ visible: { transition: { staggerChildren: 0.06 } } }}>
          {MOODS.map((m) => <motion.button key={m} variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }} whileHover={{ y: -2 }} onClick={() => router.push(`/shop?q=${encodeURIComponent(m)}` as never)}>“{m}”</motion.button>)}
        </motion.div>
      </div>
      <HorizontalTrack className="discovery-track">
        {products.map((p, i) => <DiscoveryItem key={p.id} product={p} index={i} />)}
        <Link href="/shop" className="discovery-end display">The whole<br />counter <ArrowRight size={28} /></Link>
      </HorizontalTrack>
    </section>
  );
}

const SIZES = ['tall', 'wide', 'small', 'tall', 'small', 'wide'];

function DiscoveryItem({ product, index }: { product: Product; index: number }) {
  const reduce = useReducedMotion();
  const { addToCart } = useStore();
  const { flyToBag, travelTo } = useTransitions();
  const imgRef = useRef<HTMLDivElement>(null);
  const asset = productMedia(product.image, product.name);
  const visual = { src: asset.src, tone: asset.tone };
  return (
    <motion.article className={`discovery-item size-${SIZES[index % SIZES.length]}`} whileHover="hover" initial="rest" animate="rest">
      <div ref={imgRef} className="discovery-media" role="link" tabIndex={0} aria-label={product.name}
        onClick={() => travelTo(`/shop/${product.id}`, imgRef.current, visual)}
        onKeyDown={(e) => { if (e.key === 'Enter') travelTo(`/shop/${product.id}`, imgRef.current, visual); }}>
        <motion.div className="discovery-img" variants={reduce ? undefined : { rest: { scale: 1, x: 0 }, hover: { scale: 1.07, x: -10, transition: { duration: 0.7, ease: EASE } } }}>
          <Media asset={asset} />
        </motion.div>
      </div>
      <motion.div className="discovery-caption" variants={reduce ? undefined : { rest: { y: 0 }, hover: { y: -6, transition: T.ui } }}>
        <span className="discovery-index">{String(index + 1).padStart(2, '0')}</span>
        <h3 className="display">{product.name}</h3>
        <motion.div className="discovery-meta" variants={reduce ? undefined : { rest: { opacity: 0.6 }, hover: { opacity: 1 } }}>
          <span>₹{product.price} · {product.category}</span>
          <motion.button whileTap={{ scale: 0.9 }} className="discovery-add" aria-label={`Add ${product.name} to bag`} onClick={() => { if (addToCart(product) > 0) flyToBag(imgRef.current, visual); }}><Plus size={15} /></motion.button>
        </motion.div>
      </motion.div>
    </motion.article>
  );
}

// ---------- 06 Story: layered parallax ----------
export function SceneStory() {
  return (
    <section className="scene-story container">
      <div className="story-layers">
        <Parallax distance={160} className="story-back"><MaskedReveal><Media asset={cakeScenes.lifestyle} /></MaskedReveal></Parallax>
        <Parallax distance={-90} className="story-front"><MaskedReveal from="center"><Media asset={media.brunch} /></MaskedReveal></Parallax>
        <Parallax distance={40} className="story-caption"><span>Baked in waves,<br />all day long.</span></Parallax>
      </div>
      <div className="story-text">
        <div className="eyebrow">06 / The house</div>
        <SplitText as="h2" text="Good food should slow the room down." className="display story-statement" />
        <motion.ul className="story-points" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.4 }} variants={{ visible: { transition: { staggerChildren: 0.12, delayChildren: 0.4 } } }}>
          {['Small batches, baked through the day.', 'Seasonal fruit, simple finishes.', 'Packed by hand, never rushed.'].map((t) => <motion.li key={t} variants={{ hidden: { opacity: 0, x: -16 }, visible: { opacity: 1, x: 0, transition: T.editorial } }}>{t}</motion.li>)}
        </motion.ul>
        <Link className="btn btn-secondary" href="/about">Our story <ArrowRight size={15} /></Link>
      </div>
    </section>
  );
}

// ---------- 07 Visit: come find us ----------
export function SceneVisit() {
  const reduce = useReducedMotion();
  return (
    <section className="scene-visit">
      <div className="container">
        <div className="eyebrow">07 / Visit</div>
        <SplitText as="h2" text="COME FIND US." by="char" className="visit-headline display" stagger={0.04} />
        <div className="visit-layout">
          <MaskedReveal className="visit-image" from="center"><Media asset={media.visit} /></MaskedReveal>
          <motion.dl className="visit-details" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.4 }} variants={{ visible: { transition: { staggerChildren: 0.1 } } }}>
            {[['Where', 'Indiranagar, Bengaluru'], ['When', 'Every day · 8:00 – 22:00'], ['How', 'Dine in, take away, or delivered']].map(([k, v]) => (
              <motion.div key={k} variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: T.editorial } }}><dt>{k}</dt><dd className="display">{v}</dd></motion.div>
            ))}
            <motion.div className="visit-pin" variants={{ hidden: { opacity: 0, y: -40 }, visible: { opacity: 1, y: 0, transition: reduce ? { duration: 0 } : T.crumb } }}><MapPin size={20} /> <Link href="/contact" className="text-link">Get directions</Link></motion.div>
          </motion.dl>
        </div>
      </div>
    </section>
  );
}

// ---------- 08 Final statement: the page slows down ----------
export function SceneFinale() {
  return <ScrollScene height="170vh" className="scene-finale">{(p) => <FinaleInner progress={p} />}</ScrollScene>;
}

function FinaleInner({ progress }: { progress: MotionValue<number> }) {
  const reduce = useReducedMotion();
  const scale = useTransform(progress, [0, 0.7], [0.72, 1]);
  const tracking = useTransform(progress, [0, 0.7], ['0.6em', '-0.02em']);
  const opacity = useTransform(progress, [0, 0.25], [0.12, 1]);
  const tagY = useTransform(progress, [0.55, 0.85], ['110%', '0%']);
  return (
    <div className="finale">
      <motion.div className="finale-word display" style={reduce ? undefined : { scale, letterSpacing: tracking, opacity }}>TRESOR</motion.div>
      <span className="line-mask finale-tag"><motion.span className="line-inner" style={reduce ? undefined : { y: tagY }}>Good things take time. <Link href="/shop">Come and see.</Link></motion.span></span>
    </div>
  );
}
