'use client';

// Object-preserving transitions (MOTION.md):
// - ProductTransition: the tapped product image travels to where the product
//   page's hero image sits, then the page takes over underneath it.
// - CartMorph: the product image arcs into the bag; the bag badge answers.

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { EASE_IMAGE, EASE } from '@/lib/motion';

type Visual = { src?: string; tone: [string, string] };
type Travel = { id: number; from: DOMRect; to: { left: number; top: number; width: number; height: number }; visual: Visual };
type Flight = { id: number; from: DOMRect; to: DOMRect; visual: Visual };

type Ctx = {
  travelTo: (href: string, source: HTMLElement | null, visual: Visual) => void;
  flyToBag: (source: HTMLElement | null, visual: Visual) => void;
};

const TransitionContext = createContext<Ctx | null>(null);

function backdrop(v: Visual) {
  return { backgroundImage: `${v.src ? `url(${v.src}), ` : ''}linear-gradient(145deg, ${v.tone[0]}, ${v.tone[1]})`, backgroundSize: 'cover', backgroundPosition: 'center' };
}

export function TransitionProvider({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const router = useRouter();
  const [travel, setTravel] = useState<Travel | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const ids = useRef(0);

  const travelTo = useCallback((href: string, source: HTMLElement | null, visual: Visual) => {
    if (reduce || !source) { router.push(href as never); return; }
    const from = source.getBoundingClientRect();
    // Where the product page hero image lives (left column below the header).
    const wide = window.innerWidth > 900;
    const to = wide
      ? { left: Math.max(24, (window.innerWidth - 1200) / 2), top: 120, width: Math.min(1200, window.innerWidth - 48) * 0.52, height: window.innerHeight * 0.74 }
      : { left: 16, top: 96, width: window.innerWidth - 32, height: window.innerHeight * 0.5 };
    setTravel({ id: (ids.current += 1), from, to, visual });
    window.setTimeout(() => router.push(href as never), 520);
    window.setTimeout(() => setTravel(null), 1350);
  }, [reduce, router]);

  const flyToBag = useCallback((source: HTMLElement | null, visual: Visual) => {
    if (reduce || !source) return;
    const target = Array.from(document.querySelectorAll<HTMLElement>('[data-bag-target]')).find((el) => el.offsetParent !== null);
    if (!target) return;
    setFlights((f) => [...f, { id: (ids.current += 1), from: source.getBoundingClientRect(), to: target.getBoundingClientRect(), visual }]);
  }, [reduce]);

  return (
    <TransitionContext.Provider value={{ travelTo, flyToBag }}>
      {children}
      <AnimatePresence>
        {travel && (
          <motion.div
            key={travel.id}
            className="travel-layer"
            style={backdrop(travel.visual)}
            initial={{ left: travel.from.left, top: travel.from.top, width: travel.from.width, height: travel.from.height, borderRadius: 24 }}
            animate={{ left: travel.to.left, top: travel.to.top, width: travel.to.width, height: travel.to.height, borderRadius: 30 }}
            exit={{ opacity: 0, transition: { duration: 0.35 } }}
            transition={{ duration: 0.75, ease: EASE_IMAGE }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>
      <div className="flight-layer" aria-hidden="true">
        {flights.map((f) => {
          const size = 72;
          const sx = f.from.left + f.from.width / 2 - size / 2;
          const sy = f.from.top + f.from.height / 2 - size / 2;
          const ex = f.to.left + f.to.width / 2 - size / 2;
          const ey = f.to.top + f.to.height / 2 - size / 2;
          return (
            <motion.div
              key={f.id}
              className="flight"
              style={backdrop(f.visual)}
              initial={{ x: sx, y: sy, scale: 1, opacity: 1, rotate: 0 }}
              animate={{ x: [sx, (sx + ex) / 2, ex], y: [sy, Math.min(sy, ey) - 120, ey], scale: [1, 0.85, 0.22], rotate: [0, -12, 0], opacity: [1, 1, 0.7] }}
              transition={{ duration: 0.75, ease: EASE, times: [0, 0.45, 1] }}
              onAnimationComplete={() => {
                setFlights((all) => all.filter((x) => x.id !== f.id));
                document.querySelectorAll('[data-bag-target]').forEach((el) => {
                  el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(0.96)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' });
                });
              }}
            />
          );
        })}
      </div>
    </TransitionContext.Provider>
  );
}

export function useTransitions(): Ctx {
  const ctx = useContext(TransitionContext);
  if (!ctx) throw new Error('useTransitions must be used inside <TransitionProvider>');
  return ctx;
}
