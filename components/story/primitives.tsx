'use client';

// Story primitives (MOTION.md vocabulary, story chapter). Every piece degrades to a
// still, readable layout under reduced motion, and video never blocks rendering.

import { motion, type MotionStyle, type TargetAndTransition } from 'framer-motion';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Media, Parallax, useReducedMotionSafe } from '@/components/cinematic';
import { storyAsset, type StoryVideo } from '@/lib/story-media';
import { browserContext } from '@/engine/intelligence';
import { EASE, EASE_IMAGE } from '@/lib/motion';

/** Video only when motion is welcome and the connection can carry it. Decided after mount. */
function useFilmAllowed() {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    const c = browserContext();
    setAllowed(!c.reducedMotion && c.network !== 'slow');
  }, []);
  return allowed;
}

/**
 * Marks an element `.is-live` while it is near the viewport, so its decorative loops
 * (grain) only run when they can be seen. Toggles the class directly: no re-render.
 */
export function useLiveWhileVisible<T extends HTMLElement>(onChange?: (live: boolean) => void) {
  const ref = useRef<T>(null);
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      el.classList.toggle('is-live', e.isIntersecting);
      cb.current?.(e.isIntersecting);
    }, { rootMargin: '150px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

/**
 * A short film fragment: muted, looping, inline, poster first. Loads nothing until it is
 * near the viewport, pauses when it leaves, and stays a still poster for reduced motion
 * or reduced data.
 */
export function FilmLoop({ id, className = '', eager = false, focus, style }: { id: string; className?: string; eager?: boolean; focus?: string; style?: CSSProperties }) {
  const asset = storyAsset(id) as StoryVideo;
  const allowed = useFilmAllowed();
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const objectPosition = focus ?? asset.focus;
  // One observer drives both the video and the grain over it.
  const frame = useLiveWhileVisible<HTMLDivElement>((live) => {
    const v = ref.current;
    if (!v) return;
    if (live) v.play().catch(() => { /* autoplay refused: the poster stays */ });
    else v.pause();
  });

  // The video mounts after the observer (allowed is decided after mount): start it if already in view.
  useEffect(() => {
    const v = ref.current;
    if (allowed && v && frame.current?.classList.contains('is-live')) v.play().catch(() => {});
  }, [allowed, frame]);

  return (
    <div ref={frame} className={`film ${className}`} style={{ background: `linear-gradient(160deg, ${asset.tone[0]}, ${asset.tone[1]})`, ...style }}>
      {allowed && !failed ? (
        <video ref={ref} src={asset.src} poster={asset.poster} muted loop playsInline preload={eager ? 'auto' : 'none'} aria-label={asset.alt} onError={() => setFailed(true)} style={{ objectPosition }} />
      ) : !posterFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={asset.poster} alt={asset.alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setPosterFailed(true)} style={{ objectPosition }} />
      )}
      <span className="film-grain" aria-hidden="true" />
    </div>
  );
}

/** Any story asset by id: images through <Media> (mobile crop, fallback), videos through <FilmLoop>. */
export function StoryMedia({ id, className = '', focus, eager, sizes }: { id: string; className?: string; focus?: string; eager?: boolean; sizes?: string }) {
  const asset = storyAsset(id);
  if (asset.type === 'video') return <FilmLoop id={id} className={className} focus={focus} eager={eager} />;
  return <Media asset={asset} className={`story-img ${className}`} eager={eager} sizes={sizes} imgStyle={{ objectPosition: focus ?? asset.focus } as MotionStyle} />;
}

export type RevealKind = 'rise' | 'slide' | 'scale' | 'clip' | 'wipe' | 'still';

const REVEALS: Record<RevealKind, { initial: TargetAndTransition; animate: TargetAndTransition; duration: number }> = {
  rise: { initial: { opacity: 0, y: 70 }, animate: { opacity: 1, y: 0 }, duration: 1.1 },
  slide: { initial: { opacity: 0, x: -60 }, animate: { opacity: 1, x: 0 }, duration: 1.0 },
  scale: { initial: { opacity: 0, scale: 0.94 }, animate: { opacity: 1, scale: 1 }, duration: 1.2 },
  clip: { initial: { clipPath: 'inset(100% 0% 0% 0%)' }, animate: { clipPath: 'inset(0% 0% 0% 0%)' }, duration: 1.3 },
  wipe: { initial: { clipPath: 'inset(0% 100% 0% 0%)' }, animate: { clipPath: 'inset(0% 0% 0% 0%)' }, duration: 1.3 },
  still: { initial: { opacity: 0 }, animate: { opacity: 1 }, duration: 1.4 },
};

/**
 * Reveals its children once, in one of five distinct ways, on entering the viewport.
 * The viewport is observed on an untransformed, unclipped outer wrapper: an element
 * clipped to nothing never registers as intersecting, so the clip reveal would never fire.
 */
export function Reveal({ kind = 'rise', delay = 0, className = '', style, children, amount = 0.25 }: { kind?: RevealKind; delay?: number; className?: string; style?: CSSProperties; children: ReactNode; amount?: number }) {
  const reduce = useReducedMotionSafe();
  const r = REVEALS[kind];
  if (reduce) return <div className={className} style={style}>{children}</div>;
  return (
    <motion.div className={className} style={style} initial="hidden" whileInView="show" viewport={{ once: true, amount }}>
      <motion.div className="reveal-inner" variants={{
        hidden: r.initial,
        show: { ...r.animate, transition: { duration: r.duration, ease: kind === 'clip' || kind === 'wipe' || kind === 'scale' ? EASE_IMAGE : EASE, delay } },
      }}>
        {children}
      </motion.div>
    </motion.div>
  );
}

/** A collage piece: placed, optionally tilted (1–3°), with its own depth and reveal. */
export function CollageItem({ style, rotate = 0, depth = 0, kind = 'rise', delay = 0, className = '', children }: { style?: CSSProperties; rotate?: number; depth?: number; kind?: RevealKind; delay?: number; className?: string; children: ReactNode }) {
  const inner = <Reveal kind={kind} delay={delay}><div style={{ transform: rotate ? `rotate(${rotate}deg)` : undefined }}>{children}</div></Reveal>;
  return (
    <div className={`collage-item ${className}`} style={style}>
      {depth ? <Parallax distance={depth}>{inner}</Parallax> : inner}
    </div>
  );
}
