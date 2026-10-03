'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useSpring, useTransform, type MotionStyle, type Variants } from 'framer-motion';
import { ArrowDownRight, ArrowRight, Clock3, Leaf, MapPin, Sparkles, Star } from 'lucide-react';
import { ProductCard } from '@/components/product-card';
import { ExternalOrderButtons } from '@/components/external-order-buttons';
import { Magnetic, Reveal } from '@/components/motion';
import { products } from '@/lib/data';
import { EASE } from '@/lib/motion';

const stagger = (gap = 0.08, delay = 0): Variants => ({ hidden: {}, visible: { transition: { staggerChildren: gap, delayChildren: delay } } });
const rise: Variants = { hidden: { opacity: 0, y: 28 }, visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } };

export default function HomePage() {
  const reduce = useReducedMotion();
  const featured = products.filter((p) => p.featured).slice(0, 6);
  const heroRef = useRef<HTMLElement>(null);
  const storyRef = useRef<HTMLElement>(null);
  const { scrollYProgress: heroProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const { scrollYProgress: storyProgress } = useScroll({ target: storyRef, offset: ['start end', 'end start'] });
  const plateRotate = useSpring(useTransform(heroProgress, [0, 1], [0, 40]), { stiffness: 80, damping: 20 });
  const plateY = useTransform(heroProgress, [0, 1], [0, 120]);
  const copyY = useTransform(heroProgress, [0, 1], [0, -60]);
  const storyY = useTransform(storyProgress, [0, 1], [60, -60]);
  const m = (style: MotionStyle) => (reduce ? undefined : style);
  const v = (variants: Variants) => (reduce ? undefined : variants);

  return (
    <main className="page home-page">
      <motion.div className="announcement" initial={reduce ? false : { y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, ease: EASE }}><span>Fresh counter drops every morning</span><span>•</span><span>Order before 11:30 for same-day delivery</span></motion.div>

      <section ref={heroRef} className="hero hero-premium">
        <div className="hero-orbit orbit-1"/><div className="hero-orbit orbit-2"/><div className="hero-orbit orbit-3"/>
        <div className="container hero-grid">
          <motion.div className="hero-copy" style={m({ y: copyY })} initial="hidden" animate="visible" variants={v(stagger(0.1, 0.2))}>
            <motion.div className="eyebrow" variants={v(rise)}>Bakery · Coffee · Dessert · Bengaluru</motion.div>
            <h1 className="display hero-title" aria-label="A little more ritual in your everyday.">
              {[<>A little more</>, <><em>ritual</em> in your</>, <>everyday.</>].map((line, i) => (
                <span className="line-mask" key={i} aria-hidden="true">
                  <motion.span className="line-inner" initial={reduce ? false : { y: '110%' }} animate={{ y: '0%' }} transition={{ delay: 0.35 + i * 0.13, duration: 0.95, ease: EASE }}>{line}</motion.span>
                </span>
              ))}
            </h1>
            <motion.p className="hero-subtitle" variants={v({ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { delay: 0.55, duration: 0.7, ease: EASE } } })}>Warm pastry, expressive coffee and thoughtful dessert — made fresh, packed carefully, delivered without turning the moment into a transaction.</motion.p>
            <motion.div className="hero-actions" variants={v({ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { delay: 0.7, duration: 0.7, ease: EASE } } })}><Magnetic><Link className="btn btn-brand btn-lg" href="/shop">Explore the menu <ArrowRight size={17}/></Link></Magnetic><Link className="text-link" href="#story">Why Tresor <ArrowDownRight size={16}/></Link></motion.div>
            <motion.div className="hero-trust" variants={v({ hidden: {}, visible: { transition: { staggerChildren: 0.08, delayChildren: 0.85 } } })}>
              {[[<Clock3 key="c" size={14}/>, '8–22 daily'], [<Leaf key="l" size={14}/>, 'Small-batch'], [<Star key="s" size={14}/>, '4.9 ritual rating']].map(([icon, text]) => <motion.span key={String(text)} variants={v(rise)}>{icon}{text}</motion.span>)}
            </motion.div>
          </motion.div>
          <div className="hero-stage">
            <motion.div className="floating-sticker top" initial={reduce ? false : { opacity: 0, scale: 0.6 }} animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: [0, -10, 0] }} transition={{ opacity: { delay: 1.0, duration: 0.4 }, scale: { delay: 1.0, type: 'spring', stiffness: 180, damping: 16 }, y: { delay: 1.0, duration: 7, repeat: Infinity, ease: 'easeInOut' } }} whileHover={reduce ? undefined : { scale: 1.05, rotate: -2 }}><span>Today’s favourite</span><strong>Basque<br/>Cheesecake</strong></motion.div>
            <motion.div className="hero-plate-wrap" style={m({ y: plateY, rotate: plateRotate })}>
              <div className="hero-float">
              <motion.div className="hero-plate" initial={reduce ? false : { opacity: 0, scale: 0.7, rotate: -40 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ delay: 0.3, duration: 1.3, ease: EASE }}>
                <div className="hero-plate-ring"/><div className="hero-dessert"><div className="dessert-glow"/><div className="dessert-slice"/></div><span className="hero-caption">Caramelised top · sea salt · soft centre</span>
              </motion.div>
              </div>
            </motion.div>
            <motion.div className="floating-sticker bottom" initial={reduce ? false : { opacity: 0, scale: 0.6 }} animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: [0, -10, 0] }} transition={{ opacity: { delay: 1.15, duration: 0.4 }, scale: { delay: 1.15, type: 'spring', stiffness: 180, damping: 16 }, y: { delay: 1.15, duration: 7, repeat: Infinity, ease: 'easeInOut' } }} whileHover={reduce ? undefined : { scale: 1.05, rotate: 2 }}><span>Delivery</span><strong>Fast enough.<br/>Calm enough.</strong></motion.div>
          </div>
        </div>
      </section>

      <div className="ticker"><div className="ticker-track"><span>ALMOND CROISSANT</span><i>✦</i><span>DOUBLE ESPRESSO</span><i>✦</i><span>BASQUE CHEESECAKE</span><i>✦</i><span>MUSHROOM SOURDOUGH</span><i>✦</i><span>MATCHA CLOUD</span><i>✦</i><span>ALMOND CROISSANT</span><i>✦</i><span>DOUBLE ESPRESSO</span><i>✦</i></div></div>

      <section className="section menu-preview" id="menu">
        <div className="container">
          <Reveal className="section-head"><div><div className="eyebrow">The counter today</div><h2 className="display h2">Choose your mood.</h2></div><div className="section-head-copy"><p>Search the menu like a human, not a spreadsheet. Try “something chocolatey”, “a cold coffee”, or simply browse.</p><Link className="text-link" href="/shop">See everything <ArrowRight size={15}/></Link></div></Reveal>
          <motion.div className="mood-grid" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.25 }} variants={v(stagger(0.12))}>
            {[
              ['/shop?q=something%20chocolatey', 'mood-chocolate', 'Craving rich', 'Chocolate, cocoa & caramel.', '5 menu matches'],
              ['/shop?q=a%20cold%20coffee', 'mood-cold', 'Need a reset', 'Iced, crisp, caffeinated.', '3 menu matches'],
              ['/shop?q=something%20for%20brunch', 'mood-brunch', 'Making a morning', 'Savoury plates & buttery pastry.', '4 menu matches'],
            ].map(([href, cls, kicker, title, meta]) => (
              <motion.div key={cls} variants={v({ hidden: { opacity: 0, y: 40, scale: 0.96 }, visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.7, ease: EASE } } })} whileHover={reduce ? undefined : { y: -8 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
                <Link href={href as never} className={`mood-card ${cls}`}><span>{kicker}</span><strong>{title}</strong><small>{meta}</small></Link>
              </motion.div>
            ))}
          </motion.div>
          <motion.div className="product-grid featured-grid" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }} variants={v(stagger(0.07))}>
            {featured.map((product) => <motion.div key={product.id} variants={v(rise)}><ProductCard product={product}/></motion.div>)}
          </motion.div>
        </div>
      </section>

      <section ref={storyRef} className="section story-section" id="story">
        <div className="container story-grid">
          <motion.div className="story-visual" initial={reduce ? false : { clipPath: 'inset(12% 12% 12% 12% round 30px)', opacity: 0.4 }} whileInView={{ clipPath: 'inset(0% 0% 0% 0% round 30px)', opacity: 1 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 1.1, ease: EASE }}>
            <div className="story-orbit"/>
            <motion.div className="story-card-main" style={m({ y: storyY })}><span>EST. 2026</span><strong>stay<br/>a little<br/><em>longer.</em></strong></motion.div>
            <motion.div className="story-mini" initial={reduce ? false : { opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.5, duration: 0.7, ease: EASE }}>No rush.<br/>No noise.<br/>Just good things.</motion.div>
          </motion.div>
          <motion.div className="story-panel" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={v(stagger(0.1))}>
            <motion.div className="eyebrow" variants={v(rise)}>The Tresor philosophy</motion.div>
            <motion.h2 className="display h2" variants={v(rise)}>Good food should slow the room down.</motion.h2>
            <motion.p variants={v(rise)}>We design the menu around contrast: crisp and soft, bitter and bright, rich and restrained. The technology should do the same — disappear into the experience.</motion.p>
            <motion.div className="story-list" variants={v(stagger(0.1))}>
              {[[<Sparkles key="a" size={18}/>, 'Small-batch pastry', 'Baked in waves throughout the day.'], [<Leaf key="b" size={18}/>, 'Seasonal ingredients', 'Simple finishes, thoughtful sourcing.'], [<Clock3 key="c" size={18}/>, 'Fast ordering', 'Checkout in under a minute when you know what you want.']].map(([icon, title, text]) => (
                <motion.div key={String(title)} variants={v({ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: EASE } } })}>{icon}<span><strong>{title}</strong><br/>{text}</span></motion.div>
              ))}
            </motion.div>
            <motion.div variants={v(rise)}><Link className="btn btn-light" href="/about">Meet Tresor <ArrowRight size={16}/></Link></motion.div>
          </motion.div>
        </div>
      </section>

      <section className="section order-anywhere">
        <Reveal className="container split-banner"><div><div className="eyebrow">Already on your favourite app?</div><h2 className="display h2">Find Tresor where you already order.</h2><p className="muted">The direct checkout is ours. The discovery layer can still live where Bengaluru already looks for food.</p></div><ExternalOrderButtons/></Reveal>
      </section>

      <section className="section visit-section">
        <div className="container visit-grid">
          <Reveal className="visit-card"><div className="eyebrow">Come by</div><h2 className="display h2">Indiranagar.<br/><em>Your corner table.</em></h2><p>Mon–Sun · 8:00–22:00<br/>Dine-in, takeaway, delivery.</p><div className="visit-actions"><Magnetic><Link className="btn btn-primary" href="/contact">Get directions <MapPin size={15}/></Link></Magnetic><a className="text-link" href="tel:+919999999999">Call the bakery</a></div></Reveal>
          <Reveal className="map-card" delay={0.12}><div className="map-grid"/><motion.div className="map-pin" initial={reduce ? false : { y: -60, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 12 }}><MapPin size={22}/><span>Tresor<br/><small>Indiranagar, Bengaluru</small></span></motion.div><div className="map-note">Walk in. Stay longer.</div></Reveal>
        </div>
      </section>
    </main>
  );
}
