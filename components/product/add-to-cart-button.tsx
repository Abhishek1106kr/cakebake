'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { EASE } from '@/lib/motion/transitions';

type Phase = 'idle' | 'adding' | 'added';

type AddToCartButtonProps = {
  label: string;
  /** Performs the add; returns false if nothing could be added. */
  onAdd: () => boolean;
  className?: string;
};

/**
 * Locks briefly, shows progress, then draws a checkmark (CLAUDE.md §18).
 * The lock is a short, honest beat: the add itself is instant and local.
 */
export function AddToCartButton({ label, onAdd, className = '' }: AddToCartButtonProps) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('idle');

  const click = () => {
    if (phase !== 'idle') return;
    setPhase('adding');
    window.setTimeout(() => {
      const ok = onAdd();
      setPhase(ok ? 'added' : 'idle');
      if (ok) window.setTimeout(() => setPhase('idle'), 1500);
    }, reduce ? 0 : 260);
  };

  return (
    <motion.button type="button" className={`btn btn-light btn-block add-cta is-${phase} ${className}`} onClick={click} aria-busy={phase === 'adding'} aria-live="polite" whileTap={reduce ? undefined : { scale: 0.985 }}>
      <AnimatePresence mode="wait" initial={false}>
        {phase === 'idle' && (
          <motion.span key="idle" className="cta-content" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}>
            <ShoppingBag size={16} strokeWidth={1.5} /> {label}
          </motion.span>
        )}
        {phase === 'adding' && (
          <motion.span key="adding" className="cta-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
            <span className="cta-progress" aria-hidden="true"><motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.26, ease: EASE }} /></span>
            <span className="sr-only">Adding</span>
          </motion.span>
        )}
        {phase === 'added' && (
          <motion.span key="added" className="cta-content" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <motion.path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, ease: EASE }} />
            </svg>
            Added to your bag
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
