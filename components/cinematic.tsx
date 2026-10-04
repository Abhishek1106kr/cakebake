'use client';

// Cinematic primitives (MOTION.md). Scenes compose these; none of them invent
// their own timings. Every primitive degrades to a static layout under reduced motion.

import { motion, useInView, useMotionValue, useReducedMotion, useScroll, useTransform, type MotionValue, type MotionStyle } from 'framer-motion';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { MediaAsset } from '@/lib/media';
import { EASE, EASE_IMAGE } from '@/lib/motion';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Image from the media registry over its tone gradient. Uses a mobile-specific
 * crop when the asset has one, and falls back silently if the file is missing.
 */
export function Media({ asset, className = '', imgStyle, eager = false, sizes = '100vw' }: { asset: MediaAsset; className?: string; imgStyle?: MotionStyle; eager?: boolean; sizes?: string }) {
  const [failed, setFailed] = useState(!asset.src);
  const img = (
    <motion.img
      src={asset.src}
      alt={asset.alt}
      sizes={sizes}
      loading={eager || asset.priority === 'high' ? 'eager' : 'lazy'}
      fetchPriority={asset.priority === 'high' ? 'high' : 'auto'}
      decoding="async"
      onError={() => setFailed(true)}
      style={imgStyle}
      draggable={false}
    />
  );
  return (
    <div className={`media ${className}`} style={{ background: `linear-gradient(145deg, ${asset.tone[0]}, ${asset.tone[1]})` }}>
      {!failed && (asset.mobile ? <picture><source media="(max-width: 760px)" srcSet={asset.mobile} />{img}</picture> : img)}
    </div>
  );
}

/** Splits text into masked characters or words that rise in sequence. */
export function SplitText({ text, by = 'word', as = 'span', className = '', delay = 0, stagger = by === 'char' ? 0.035 : 0.07, trigger = 'view' }: { text: string; by?: 'char' | 'word'; as?: 'span' | 'h1' | 'h2' | 'p'; className?: string; delay?: number; stagger?: number; trigger?: 'mount' | 'view' }) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  const units = by === 'char' ? Array.from(text) : text.split(' ');
  const activate = trigger === 'mount' ? { animate: 'visible' } : { whileInView: 'visible', viewport: { once: true, amount: 0.6 } };
  return (
    <Tag className={`split ${className}`} aria-label={text} initial={reduce ? 'visible' : 'hidden'} {...activate} variants={{ visible: { transition: { staggerChildren: stagger, delayChildren: delay } } }}>
      {units.map((unit, i) => (
        <span key={i} className="split-mask" aria-hidden="true">
          <motion.span className="split-unit" variants={{ hidden: { y: '110%', rotate: by === 'char' ? 6 : 2 }, visible: { y: '0%', rotate: 0, transition: { duration: 0.9, ease: EASE } } }}>
            {unit === ' ' ? ' ' : unit}
          </motion.span>
          {by === 'word' && i < units.length - 1 ? ' ' : null}
        </span>
      ))}
    </Tag>
  );
}

/** A pinned scene: `height` of scroll drives a 0→1 progress value for its contents. */
export function ScrollScene({ height = '300vh', className = '', children }: { height?: string; className?: string; children: (progress: MotionValue<number>) => ReactNode }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  // A function-derived value keeps transforms on the JS path. Handing scrollYProgress straight
  // to useTransform lets Framer accelerate opacity via ScrollTimeline, which ignores the clamp
  // and fades text back in past the end of its range.
  const progress = useTransform(scrollYProgress, (v) => v);
  const settled = useMotionValue(1);
  return (
    <section ref={ref} className={`scroll-scene ${className}`} style={{ height: reduce ? 'auto' : height }}>
      <div className={reduce ? 'scene-static' : 'scene-sticky'}>{children(reduce ? settled : progress)}</div>
    </section>
  );
}

/** Vertical scroll drives a horizontal track (pinned). On touch-first screens it becomes a native swipe row. */
export function HorizontalTrack({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);
  const [pinned, setPinned] = useState(false);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] });
  const x = useTransform(scrollYProgress, [0, 1], [0, -distance]);

  useIsoLayoutEffect(() => {
    const measure = () => {
      const wide = window.matchMedia('(min-width: 900px) and (pointer: fine)').matches;
      setPinned(wide && !reduce);
      if (trackRef.current) setDistance(Math.max(0, trackRef.current.scrollWidth - window.innerWidth));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [reduce]);

  if (!pinned) {
    return <section ref={sectionRef} className={`htrack htrack-native ${className}`}><div ref={trackRef} className="htrack-row">{children}</div></section>;
  }
  return (
    <section ref={sectionRef} className={`htrack ${className}`} style={{ height: `calc(100vh + ${distance}px)` }}>
      <div className="scene-sticky htrack-sticky">
        <motion.div ref={trackRef} className="htrack-row" style={{ x }}>{children}</motion.div>
      </div>
    </section>
  );
}

/**
 * Lamination: each next image is revealed by horizontal strips that open in
 * sequence. `progress` 0→1 spans all images.
 */
export function LaminationReveal({ assets, progress, strips = 7, className = '' }: { assets: MediaAsset[]; progress: MotionValue<number>; strips?: number; className?: string }) {
  const span = 1 / assets.length;
  return (
    <div className={`lamination-stack ${className}`}>
      {assets.map((asset, i) => (
        <LaminationLayer key={asset.id} asset={asset} index={i} progress={progress} span={span} strips={strips} />
      ))}
    </div>
  );
}

function LaminationLayer({ asset, index, progress, span, strips }: { asset: MediaAsset; index: number; progress: MotionValue<number>; span: number; strips: number }) {
  const start = index * span - span * 0.35;
  const scale = useTransform(progress, [Math.max(0, start), Math.min(1, start + span * 1.4)], [1.12, 1]);
  if (index === 0) {
    return <div className="lamination-layer"><Media asset={asset} imgStyle={{ scale }} /></div>;
  }
  return (
    <div className="lamination-layer">
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <clipPath id={`lam-${asset.id}`} clipPathUnits="objectBoundingBox">
            {Array.from({ length: strips }, (_, k) => <LamRect key={k} index={k} count={strips} progress={progress} start={start} span={span} />)}
          </clipPath>
        </defs>
      </svg>
      <div className="lamination-clip" style={{ clipPath: `url(#lam-${asset.id})` }}>
        <Media asset={asset} imgStyle={{ scale }} />
      </div>
    </div>
  );
}

function LamRect({ index, count, progress, start, span }: { index: number; count: number; progress: MotionValue<number>; start: number; span: number }) {
  const width = useTransform(progress, [start + (index / count) * span * 0.45, start + span * 0.55 + (index / count) * span * 0.45], [0, 1.001]);
  return <motion.rect x={0} y={index / count} height={1 / count + 0.002} width={width} />;
}

/** Glaze: a liquid-edged mask pours the image in from the top as progress goes 0→1. */
export function GlazeReveal({ asset, progress, className = '' }: { asset: MediaAsset; progress: MotionValue<number>; className?: string }) {
  const id = `glaze-${asset.id}`;
  const d = useTransform(progress, (p) => {
    const level = -0.15 + p * 1.3; // fill line moves past both edges
    const wobble = 0.06 * Math.sin(p * Math.PI);
    return `M0 0 H1 V${level + wobble} C0.82 ${level - wobble * 1.4}, 0.66 ${level + wobble * 1.8}, 0.5 ${level} S0.18 ${level - wobble * 1.6}, 0 ${level + wobble * 0.6} Z`;
  });
  const imgScale = useTransform(progress, [0, 1], [1.15, 1]);
  return (
    <div className={`glaze ${className}`}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs><clipPath id={id} clipPathUnits="objectBoundingBox"><motion.path d={d} /></clipPath></defs>
      </svg>
      <div className="glaze-clip" style={{ clipPath: `url(#${id})` }}><Media asset={asset} imgStyle={{ scale: imgScale }} /></div>
    </div>
  );
}

/** Restrained parallax wrapper. */
export function Parallax({ children, distance = 80, className = '' }: { children: ReactNode; distance?: number; className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [distance / 2, -distance / 2]);
  return <div ref={ref} className={className}><motion.div style={reduce ? undefined : { y }}>{children}</motion.div></div>;
}

/**
 * Masked image entrance used for scene handovers. Visibility is measured on an
 * unclipped outer wrapper (a clip-path on the observed element itself can keep
 * it from ever counting as visible); the clip animates on an inner layer.
 */
export function MaskedReveal({ children, className = '', from = 'bottom' }: { children: ReactNode; className?: string; from?: 'bottom' | 'center' }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });
  const hidden = from === 'center' ? 'inset(42% 42% 42% 42% round 24px)' : 'inset(100% 0% 0% 0% round 24px)';
  return (
    <div ref={ref} className={`masked ${className}`}>
      <motion.div className="masked-inner" initial={reduce ? false : { clipPath: hidden, scale: 1.08 }} animate={inView || reduce ? { clipPath: 'inset(0% 0% 0% 0% round 24px)', scale: 1 } : undefined} transition={{ duration: 1.3, ease: EASE_IMAGE }}>
        {children}
      </motion.div>
    </div>
  );
}
