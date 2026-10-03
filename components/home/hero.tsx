'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import { useRef } from 'react';
import { useIntroDone } from '@/components/layout/brand-loader';
import { ArtDrawing } from '@/components/media/product-art';
import { LazyVideo } from '@/components/media/lazy-video';
import { Magnetic } from '@/components/motion/magnetic';
import { media } from '@/data/media';
import { site } from '@/data/site';
import { HERO } from '@/lib/motion/choreography';
import { EASE } from '@/lib/motion/transitions';

function HeroStill() {
  return (
    <div className="hero-still tone-cream">
      <span className="window-light" />
      <span className="window-light window-light-2" />
      <div className="hero-still-art"><ArtDrawing art="cup" /></div>
    </div>
  );
}

const rise = (delay: number) => ({
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { delay, duration: 0.8, ease: EASE } },
});

export function Hero() {
  const reduce = useReducedMotion();
  const ready = useIntroDone();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const mediaScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const state = ready ? 'visible' : 'hidden';

  return (
    <section ref={ref} className="hero" aria-labelledby="hero-title">
      <motion.aside className="hero-side" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: ready ? 1 : 0 }} transition={{ delay: HERO.background, duration: 0.6 }}>
        <div className="side-word" aria-hidden="true">TRESOR</div>
        <div className="side-bottom">
          <motion.div initial="hidden" animate={state} variants={reduce ? undefined : rise(HERO.detail)}>
            <div className="eyebrow eyebrow-light">{site.city}</div>
            <div className="side-meta">{site.neighbourhood} · {site.hours.open} — {site.hours.close}</div>
          </motion.div>
          <motion.div initial="hidden" animate={state} variants={reduce ? undefined : rise(HERO.detail + 0.08)}>
            <div className="eyebrow eyebrow-light">The house of</div>
            <div className="side-display display">good coffee</div>
          </motion.div>
        </div>
      </motion.aside>

      <div className="hero-main">
        <motion.div
          className="hero-media"
          initial={reduce ? false : { clipPath: 'inset(100% 0% 0% 0%)', scale: 1.04 }}
          animate={ready ? { clipPath: 'inset(0% 0% 0% 0%)', scale: 1 } : undefined}
          transition={{ delay: HERO.media, duration: 1.2, ease: EASE }}
        >
          <motion.div className="hero-media-inner" style={reduce ? undefined : { scale: mediaScale }}>
            <LazyVideo slot={media.heroCafe} fallback={<HeroStill />} eager />
          </motion.div>
        </motion.div>

        <motion.div className="stamp" aria-hidden="true" initial={reduce ? false : { opacity: 0, scale: 0.8, rotate: -20 }} animate={ready ? { opacity: 1, scale: 1, rotate: 0 } : undefined} transition={{ delay: HERO.detail, duration: 0.7, ease: EASE }}>
          <svg viewBox="0 0 100 100" className="stamp-ring">
            <defs><path id="stamp-circle" d="M50 50m-36 0a36 36 0 1 1 72 0a36 36 0 1 1-72 0" /></defs>
            <text><textPath href="#stamp-circle">FRESH TODAY · FROM THE OVEN ·</textPath></text>
          </svg>
          <span className="stamp-center">New<br />today</span>
        </motion.div>

        <motion.div className="hero-copy" style={reduce ? undefined : { y: copyY }}>
          <motion.div className="eyebrow" initial="hidden" animate={state} variants={reduce ? undefined : rise(HERO.line1 - 0.1)}>01 / The house of Tresor</motion.div>
          <h1 id="hero-title" className="hero-title display" aria-label="Good coffee. Slow moments.">
            {['Good coffee.', 'Slow moments.'].map((line, i) => (
              <span className="line-mask" key={line} aria-hidden="true">
                <motion.span
                  className="line-inner"
                  initial={reduce ? false : { y: '105%' }}
                  animate={ready ? { y: '0%' } : undefined}
                  transition={{ delay: i === 0 ? HERO.line1 : HERO.line2, duration: 0.95, ease: EASE }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p className="lede" initial="hidden" animate={state} variants={reduce ? undefined : rise(HERO.copy)}>
            A contemporary café for mornings that become afternoons.
          </motion.p>
          <motion.div className="hero-actions" initial="hidden" animate={state} variants={reduce ? undefined : rise(HERO.cta)}>
            <Magnetic><Link href="/menu" className="btn btn-primary">Explore menu</Link></Magnetic>
            <Link href="/about" className="btn btn-secondary">Our story</Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
