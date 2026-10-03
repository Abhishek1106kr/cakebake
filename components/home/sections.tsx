'use client';

import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { OrderElsewhere } from '@/components/external/order-elsewhere';
import { ArtDrawing, toneClass } from '@/components/media/product-art';
import { LazyVideo } from '@/components/media/lazy-video';
import { ImageReveal } from '@/components/motion/image-reveal';
import { Magnetic } from '@/components/motion/magnetic';
import { Reveal } from '@/components/motion/reveal';
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger';
import { TextReveal } from '@/components/motion/text-reveal';
import { ProductCard } from '@/components/product/product-card';
import { media } from '@/data/media';
import { products, type ArtKind, type Tone } from '@/data/products';
import { site } from '@/data/site';
import { SPRING } from '@/lib/motion/transitions';

export function Signatures() {
  const signatures = products.filter((product) => product.signature).slice(0, 3);
  return (
    <section className="section wrap" aria-labelledby="signature-title">
      <div className="section-head">
        <div>
          <Reveal><div className="eyebrow">02 / Signature</div></Reveal>
          <TextReveal as="h2" id="signature-title" lines={['Made for the first sip.']} className="section-title display" />
        </div>
        <Reveal delay={0.1}><Link href="/menu" className="text-link">View the menu <ArrowRight size={14} strokeWidth={1.5} /></Link></Reveal>
      </div>
      <StaggerGroup className="signature-grid">
        {signatures.map((product, i) => (
          <StaggerItem key={product.slug}><ProductCard product={product} index={i} /></StaggerItem>
        ))}
      </StaggerGroup>
      <Reveal className="order-ribbon">
        <div>
          <div className="eyebrow">Order</div>
          <p>Delivered from Whitefield, or ready for pickup at the counter.</p>
        </div>
        <div className="ribbon-actions">
          <Magnetic><Link href="/menu" className="btn btn-primary">Order from Tresor</Link></Magnetic>
          <OrderElsewhere compact />
        </div>
      </Reveal>
    </section>
  );
}

function LaminationTexture() {
  // Stacked, slightly wavering hairlines: laminated dough seen side-on.
  const lines = Array.from({ length: 27 }, (_, i) => i);
  return (
    <div className="lamination tone-warm" aria-hidden="true">
      <svg viewBox="0 0 400 300" preserveAspectRatio="none">
        {lines.map((i) => {
          const y = 22 + i * 9.6;
          const wobble = 3 + (i % 4);
          return <path key={i} d={`M-10 ${y} C 80 ${y - wobble}, 160 ${y + wobble}, 240 ${y - wobble / 2} S 380 ${y + wobble}, 410 ${y}`} />;
        })}
      </svg>
    </div>
  );
}

/** A narrow slit of texture that opens to full width as it scrolls through. */
export function TextureSlit() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] });
  const inset = useTransform(scrollYProgress, [0, 1], [38, 0]);
  const clipPath = useTransform(inset, (v) => `inset(0% ${v}% 0% ${v}%)`);

  return (
    <section ref={ref} className="texture-slit" aria-label="How our pastry is made">
      <motion.div className="slit-media" style={reduce ? undefined : { clipPath }}>
        <LazyVideo slot={media.textureLamination} fallback={<LaminationTexture />} />
      </motion.div>
      <div className="slit-caption wrap">
        <TextReveal as="p" lines={['27 layers.', 'Three days.', 'One morning.']} className="slit-words display" gap={0.18} />
      </div>
    </section>
  );
}

export function TheHouse() {
  return (
    <section className="section wrap house" aria-labelledby="house-title">
      <div className="house-copy">
        <Reveal><div className="eyebrow">03 / The house</div></Reveal>
        <TextReveal as="h2" id="house-title" lines={['Coffee, pastry,', 'conversation.']} className="section-title display" />
        <Reveal delay={0.15}>
          <p className="lede">Tresor is built around the simple idea that a café should make time feel a little slower: considered, without excess.</p>
          <Link href="/about" className="btn btn-secondary">Read our story</Link>
        </Reveal>
      </div>
      <ImageReveal className="house-media">
        <LazyVideo
          slot={media.interiorMorning}
          fallback={
            <div className="interior-still tone-stone">
              <span className="window-light" />
              <svg viewBox="0 0 300 360" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M70 330V130a80 80 0 0 1 160 0v200" />
                <path d="M150 50v280M70 210h160" opacity=".5" />
                <ellipse cx="150" cy="330" rx="120" ry="8" opacity=".4" />
              </svg>
            </div>
          }
        />
      </ImageReveal>
    </section>
  );
}

const INDEX: { href: string; label: string; meta: string; art: ArtKind; tone: Tone }[] = [
  { href: '/menu', label: 'The menu', meta: '16 things, made daily', art: 'croissant', tone: 'warm' },
  { href: '/menu?category=pastry', label: 'Pastry', meta: 'Laminated, shaped, baked', art: 'roll', tone: 'cream' },
  { href: '/menu?category=coffee', label: 'Coffee', meta: 'Espresso, filter, cold', art: 'cup', tone: 'stone' },
  { href: '/about', label: 'The house', meta: 'A place to stay longer', art: 'teacup', tone: 'sage' },
  { href: '/contact', label: 'Visit', meta: `${site.neighbourhood}, ${site.city}`, art: 'tart', tone: 'warm' },
];

/** Editorial index; on desktop a small preview follows the cursor. */
export function ExploreIndex() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);
  const [canHover, setCanHover] = useState(false);
  const x = useSpring(useMotionValue(0), SPRING.soft);
  const y = useSpring(useMotionValue(0), SPRING.soft);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setCanHover(!reduce && window.matchMedia('(hover: hover) and (pointer: fine)').matches); }, [reduce]);

  const onMove = (event: React.PointerEvent) => {
    if (!canHover || !listRef.current) return;
    const rect = listRef.current.getBoundingClientRect();
    x.set(event.clientX - rect.left + 24);
    y.set(event.clientY - rect.top - 90);
  };

  return (
    <section className="section wrap explore" aria-labelledby="explore-title">
      <Reveal><div className="eyebrow" id="explore-title">04 / Explore</div></Reveal>
      <div className="explore-list" ref={listRef} onPointerMove={onMove} onPointerLeave={() => setActive(null)}>
        {INDEX.map((item, i) => (
          <Reveal key={item.href} delay={i * 0.05}>
            <Link href={item.href} className="explore-row" onPointerEnter={() => setActive(i)} onFocus={() => setActive(null)}>
              <span className="explore-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="explore-label display">{item.label}</span>
              <span className="explore-meta">{item.meta}</span>
              <ArrowRight className="explore-arrow" size={18} strokeWidth={1.3} />
            </Link>
          </Reveal>
        ))}
        {canHover && (
          <motion.div
            className={`explore-preview ${active !== null ? toneClass[INDEX[active].tone] : ''}`}
            style={{ x, y }}
            animate={{ opacity: active !== null ? 1 : 0, scale: active !== null ? 1 : 0.92 }}
            transition={{ duration: 0.22 }}
            aria-hidden="true"
          >
            {active !== null && <ArtDrawing art={INDEX[active].art} />}
          </motion.div>
        )}
      </div>
    </section>
  );
}

export function ThisWeek() {
  const picks = products.filter((product) => product.thisWeek);
  return (
    <section className="section wrap" aria-labelledby="week-title">
      <div className="section-head">
        <div>
          <Reveal><div className="eyebrow">05 / This week</div></Reveal>
          <TextReveal as="h2" id="week-title" lines={['On the counter this week.']} className="section-title display" />
        </div>
      </div>
      <StaggerGroup className="week-rail">
        {picks.map((product) => (
          <StaggerItem key={product.slug} className="week-item"><ProductCard product={product} /></StaggerItem>
        ))}
      </StaggerGroup>
    </section>
  );
}

export function Evening() {
  return (
    <section className="evening" aria-labelledby="evening-title">
      <div className="evening-media">
        <LazyVideo
          slot={media.eveningAtmosphere}
          fallback={
            <div className="evening-still">
              <svg viewBox="0 0 200 260" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M100 0v110" />
                <path d="M62 150c0-24 17-40 38-40s38 16 38 40z" />
                <ellipse cx="100" cy="150" rx="38" ry="5" />
              </svg>
              <span className="lamp-pool" />
            </div>
          }
        />
      </div>
      <div className="evening-copy wrap">
        <Reveal><div className="eyebrow eyebrow-light">06 / After six</div></Reveal>
        <TextReveal as="h2" id="evening-title" lines={['The room slows down.', 'The kitchen doesn’t.']} className="section-title display" />
        <Reveal delay={0.15}><p className="lede">Open until {site.hours.close}: tea, tarts and conversations that run long.</p></Reveal>
      </div>
    </section>
  );
}

export function VisitBlock() {
  return (
    <section className="section wrap visit-block" aria-labelledby="visit-title">
      <Reveal><div className="eyebrow">07 / Visit Tresor</div></Reveal>
      <div className="visit-grid">
        <TextReveal as="h2" id="visit-title" lines={[`${site.neighbourhood},`, `${site.city}.`]} className="visit-title display" />
        <Reveal delay={0.1} className="visit-meta">
          <p className="lede">{site.hours.open} — {site.hours.close} · {site.hours.days}</p>
          <Link href="/contact" className="btn btn-primary">Plan your visit <ArrowRight size={14} strokeWidth={1.5} /></Link>
        </Reveal>
      </div>
    </section>
  );
}
