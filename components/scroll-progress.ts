'use client';

// One scroll source for every scroll-linked scene.
//
// Framer's useScroll({ target }) re-measures its target on every scroll frame
// (an offsetParent walk plus clientWidth/clientHeight reads), once per hook. The
// story page had ~15 of them. Profiling showed that work as the largest script
// cost while scrolling. Here, one passive listener feeds one shared scrollY
// value; each element's position is measured only when something resizes, so a
// scroll frame costs a subtraction and a division per scene.
//
// Offsets mean exactly what they mean in Framer ('start end' = the element's top
// meets the viewport's bottom, and so on), measured the same way (offsetTop
// chain, clientHeight), so every scene keeps its timing.

import { motionValue, useTransform, type MotionValue } from 'framer-motion';
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

type Edge = 'start' | 'center' | 'end';
export type ScrollOffset = [`${Edge} ${Edge}`, `${Edge} ${Edge}`];

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

let scrollY: MotionValue<number> | null = null;
let viewport = 0;
const remeasure = new Set<() => void>();
let resizeObserver: ResizeObserver | null = null;

function source() {
  if (scrollY) return scrollY;
  scrollY = motionValue(typeof window === 'undefined' ? 0 : window.scrollY);
  if (typeof window !== 'undefined') {
    viewport = window.innerHeight;
    const y = scrollY;
    window.addEventListener('scroll', () => y.set(window.scrollY), { passive: true });
    const all = () => { viewport = window.innerHeight; remeasure.forEach((m) => m()); y.set(window.scrollY); };
    window.addEventListener('resize', all);
    window.addEventListener('load', all);
    document.fonts?.ready.then(all).catch(() => {});
    // Anything that changes the page's height (images, late content, accordions) can move scenes.
    resizeObserver = new ResizeObserver(all);
    resizeObserver.observe(document.body);
  }
  return scrollY;
}

const fraction = (edge: Edge) => (edge === 'start' ? 0 : edge === 'center' ? 0.5 : 1);

function documentTop(el: HTMLElement) {
  let top = 0;
  let node: HTMLElement | null = el;
  while (node) { top += node.offsetTop; node = node.offsetParent as HTMLElement | null; }
  return top;
}

/** Scroll position at which `${elementEdge} ${viewportEdge}` is met. */
function at(offset: string, top: number, height: number) {
  const [el, vp] = offset.split(' ') as [Edge, Edge];
  return top + fraction(el) * height - fraction(vp) * viewport;
}

/** 0→1 progress of `ref` through the viewport, like useScroll({ target, offset }).scrollYProgress. */
export function useElementScrollProgress(ref: RefObject<HTMLElement | null>, offset: ScrollOffset, remount?: unknown): MotionValue<number> {
  const y = source();
  const range = useRef({ from: 0, to: 1 });
  const progress = useTransform(y, (v) => {
    const { from, to } = range.current;
    if (to === from) return v >= to ? 1 : 0;
    return Math.min(1, Math.max(0, (v - from) / (to - from)));
  });
  const [a, b] = offset;
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const top = documentTop(el);
      const height = el.clientHeight;
      range.current = { from: at(a, top, height), to: at(b, top, height) };
    };
    measure();
    y.set(window.scrollY);
    // Re-evaluate the derived value now that the range is known.
    progress.set(Math.min(1, Math.max(0, range.current.to === range.current.from ? 0 : (window.scrollY - range.current.from) / (range.current.to - range.current.from))));
    remeasure.add(measure);
    resizeObserver?.observe(el);
    return () => { remeasure.delete(measure); resizeObserver?.unobserve(el); };
  }, [ref, a, b, y, progress, remount]);
  return progress;
}
