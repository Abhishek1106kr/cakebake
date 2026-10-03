'use client';
import Link from 'next/link';
import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { ProductCard } from '@/components/product-card';
import { products } from '@/lib/products';
import { LineReveal, Magnetic, Reveal } from '@/components/motion';
import { OrderElsewhere } from '@/components/order-elsewhere';
import { EASE, HERO, riseAt } from '@/lib/motion';

/** Laminated dough seen side-on: 27 wavering hairlines (placeholder until a macro video exists). */
function Lamination() {
  return (
    <svg className="lamination" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">
      {Array.from({ length: 27 }, (_, i) => {
        const y = 22 + i * 9.6;
        const w = 3 + (i % 4);
        return <path key={i} d={`M-10 ${y} C 80 ${y - w}, 160 ${y + w}, 240 ${y - w / 2} S 380 ${y + w}, 410 ${y}`} />;
      })}
    </svg>
  );
}

/** REFERENCES.md §6: a narrow slit of texture that opens to full width on scroll. */
function TextureSlit() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] });
  const clipPath = useTransform(scrollYProgress, [0, 1], ['inset(0% 40% 0% 40%)', 'inset(0% 0% 0% 0%)']);
  return (
    <section ref={ref} className="page texture-slit" aria-label="How our pastry is made">
      <motion.div className="slit-media" style={reduce ? undefined : { clipPath }}><Lamination /></motion.div>
      <LineReveal as="p" className="slit-words font-display" lines={['27 layers.', 'Three days.', 'One morning.']} gap={0.18} />
    </section>
  );
}

export default function HomePage() {
  const reduce = useReducedMotion();
  const featured = [products[0], products[1], products[2]];
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const photoScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const v = (delay: number) => (reduce ? undefined : riseAt(delay));

  return <main className="page-shell">
    <section ref={heroRef} className="home-hero page">
      <motion.aside className="hero-side" aria-label="Tresor information" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
        <div className="display-side">TRESOR</div>
        <motion.div className="hero-side-bottom" initial="hidden" animate="visible" variants={v(HERO.detail)}><div><div className="eyebrow" style={{ color: 'white' }}>BENGALURU</div><div style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,.74)' }}>Whitefield · 08:00 — 23:00</div></div><div><div className="eyebrow" style={{ color: 'white' }}>THE HOUSE OF</div><div className="font-display" style={{ fontSize: 32, marginTop: 7 }}>good bread</div></div></motion.div>
      </motion.aside>
      <div className="hero-main">
        <motion.div className="hero-photo-wrap" initial={reduce ? false : { clipPath: 'inset(100% 0% 0% 0%)' }} animate={{ clipPath: 'inset(0% 0% 0% 0%)' }} transition={{ delay: HERO.media, duration: 1.2, ease: EASE }}>
          <motion.div className="editorial-image hero-photo" style={reduce ? undefined : { scale: photoScale }}><span className="editorial-label">Cinematic interior / pastry still</span></motion.div>
        </motion.div>
        <motion.div className="hero-stamp" initial={reduce ? false : { opacity: 0, scale: 0.8, rotate: -18 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ delay: HERO.detail, duration: 0.7, ease: EASE }}>NEW<br />TODAY</motion.div>
        <motion.div className="hero-copy" style={reduce ? undefined : { y: copyY }}>
          <motion.div className="eyebrow" initial="hidden" animate="visible" variants={v(HERO.line1 - 0.1)}>01 / THE HOUSE OF TRESOR</motion.div>
          <h1 className="font-display" aria-label="Good bread. Slow mornings.">
            {['GOOD BREAD.', 'SLOW MORNINGS.'].map((line, i) => (
              <span className="line-mask" key={line} aria-hidden="true">
                <motion.span className="line-inner" initial={reduce ? false : { y: '105%' }} animate={{ y: '0%' }} transition={{ delay: i ? HERO.line2 : HERO.line1, duration: 0.95, ease: EASE }}>{line}</motion.span>
              </span>
            ))}
          </h1>
          <motion.p className="lede" style={{ maxWidth: 520, marginTop: 22 }} initial="hidden" animate="visible" variants={v(HERO.copy)}>A contemporary bakery for mornings that become afternoons.</motion.p>
          <motion.div className="hero-actions" initial="hidden" animate="visible" variants={v(HERO.cta)}><Magnetic><Link className="btn btn-primary" href="/menu">EXPLORE MENU</Link></Magnetic><Link className="btn btn-secondary" href="/about">OUR STORY</Link></motion.div>
        </motion.div>
      </div>
    </section>

    <section className="page signature">
      <div className="signature-header"><div><Reveal><div className="eyebrow">SIGNATURE</div></Reveal><LineReveal className="font-display" lines={['Made for the first bite.']} /></div><Reveal delay={0.1}><Link href="/menu" className="btn btn-secondary">VIEW THE MENU <ArrowRight size={14} /></Link></Reveal></div>
      <div className="signature-grid">
        {featured.map((p, i) => <Reveal key={p.slug} delay={i * 0.08}><ProductCard product={p} className={`signature-card s${i}`} /></Reveal>)}
      </div>
      <Reveal className="order-ribbon"><span>Order from Tresor, or through</span><OrderElsewhere /></Reveal>
    </section>

    <TextureSlit />

    <section className="page section">
      <div className="house-grid">
        <div><Reveal><div className="eyebrow">THE HOUSE</div></Reveal><LineReveal className="section-title font-display" lines={['Bread, pastry,', 'conversation.']} /><Reveal delay={0.15}><p className="lede">Tresor is built around the simple idea that a bakery should make time feel a little slower — considered without excess.</p><Link className="btn btn-secondary" href="/about" style={{ marginTop: 24 }}>READ OUR STORY</Link></Reveal></div>
        <motion.div className="editorial-image" style={{ minHeight: 450 }} initial={reduce ? false : { clipPath: 'inset(100% 0% 0% 0%)' }} whileInView={{ clipPath: 'inset(0% 0% 0% 0%)' }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 1.1, ease: EASE }}><span className="editorial-label">Editorial bakery interior</span></motion.div>
      </div>
    </section>

    <section className="evening" aria-label="Evenings at Tresor">
      <div className="lamp" aria-hidden="true"><svg viewBox="0 0 200 260" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M100 0v110" /><path d="M62 150c0-24 17-40 38-40s38 16 38 40z" /><ellipse cx="100" cy="150" rx="38" ry="5" /></svg><span className="lamp-pool" /></div>
      <div className="page">
        <Reveal><div className="eyebrow" style={{ color: 'var(--sage-light)' }}>AFTER SIX</div></Reveal>
        <LineReveal className="section-title font-display" lines={['The room slows down.', 'The ovens don’t.']} />
        <Reveal delay={0.15}><p className="lede" style={{ color: 'var(--sage-light)' }}>Open until 23:00: tea, tarts and conversations that run long.</p></Reveal>
      </div>
    </section>

    <section className="page section">
      <Reveal><div className="eyebrow">VISIT TRESOR</div></Reveal><div className="visit-grid"><LineReveal className="font-display visit-title" lines={['Whitefield,', 'Bengaluru.']} /><Reveal delay={0.1}><p className="lede" style={{ margin: 0 }}>08:00 — 23:00 · Monday to Sunday</p><Link className="btn btn-primary" href="/contact" style={{ marginTop: 22 }}>GET DIRECTIONS <ArrowRight size={14} /></Link></Reveal></div>
    </section>

    <section className="page section"><div style={{ display:'flex', justifyContent:'space-between', alignItems:'end', gap:20 }}><div><Reveal><div className="eyebrow">FOLLOW THE DAY</div></Reveal><LineReveal className="section-title font-display" lines={['See you at Tresor.']} /></div><motion.span animate={reduce ? undefined : { y: [0, 6, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}><ArrowDown size={20} color="var(--sage)" /></motion.span></div></section>
  </main>;
}
