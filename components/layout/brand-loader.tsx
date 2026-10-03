'use client';

import { motion } from 'framer-motion';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { EASE, EASE_IN_OUT } from '@/lib/motion/transitions';
import { LOADER_MAX_MS } from '@/lib/motion/choreography';

// First-visit loader. An inline script in <head> marks returning sessions and
// reduced-motion visitors before first paint, so they never see it (see app/layout.tsx).
// A CSS failsafe hides it even if JavaScript never runs.

let introDone = false;
const listeners = new Set<() => void>();

function finishIntro() {
  if (introDone) return;
  introDone = true;
  listeners.forEach((listener) => listener());
}

/** True once the loader has gone (or was never shown). Hero choreography waits on this. */
export function useIntroDone(): boolean {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => introDone,
    () => false,
  );
}

const LETTERS = ['T', 'R', 'E', 'S', 'O', 'R'];

export function BrandLoader() {
  const [phase, setPhase] = useState<'hidden' | 'playing' | 'leaving'>('playing');

  useEffect(() => {
    if (document.documentElement.dataset.intro === 'seen') {
      setPhase('hidden');
      finishIntro();
      return;
    }
    try { sessionStorage.setItem('tresor:intro', '1'); } catch {}
    const leave = () => setPhase((p) => (p === 'playing' ? 'leaving' : p));
    const timer = setTimeout(leave, LOADER_MAX_MS - 300);
    window.addEventListener('keydown', leave, { once: true });
    window.addEventListener('pointerdown', leave, { once: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', leave);
      window.removeEventListener('pointerdown', leave);
    };
  }, []);

  if (phase === 'hidden') return null;

  return (
    <motion.div
      className="brand-loader"
      role="status"
      aria-label="Loading Tresor"
      initial={{ clipPath: 'inset(0% 0% 0% 0%)' }}
      animate={phase === 'leaving' ? { clipPath: 'inset(0% 0% 100% 0%)' } : { clipPath: 'inset(0% 0% 0% 0%)' }}
      transition={{ duration: 0.42, ease: EASE_IN_OUT }}
      onAnimationComplete={() => {
        if (phase === 'leaving') { setPhase('hidden'); finishIntro(); }
      }}
    >
      <div className="loader-mark" aria-hidden="true">
        {LETTERS.map((letter, i) => (
          <motion.span key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 + i * 0.05, duration: 0.4, ease: EASE }}>
            {letter}
          </motion.span>
        ))}
      </div>
      <motion.p className="loader-line" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25, duration: 0.3 }}>
        Preparing something good.
      </motion.p>
      <div className="loader-track" aria-hidden="true">
        <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.55, ease: EASE }} />
      </div>
    </motion.div>
  );
}
