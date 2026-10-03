'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { pad2 } from '@/lib/format';

/** Bag count: the number pops 1 → 1.2 → 1 and the new value slides in. */
export function CartCount({ count }: { count: number }) {
  const reduce = useReducedMotion();
  return (
    <span className="cart-count" aria-hidden="true">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={count}
          initial={reduce ? { opacity: 0 } : { y: 8, opacity: 0, scale: 1 }}
          animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1, scale: [1, 1.2, 1] }}
          exit={reduce ? { opacity: 0 } : { y: -8, opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          {pad2(count)}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
