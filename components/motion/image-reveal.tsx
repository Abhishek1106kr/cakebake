'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { imageUnmask, quietFade, withDelay } from '@/lib/motion/variants';

/** Unmasks its media from the bottom edge as it enters the viewport. */
export function ImageReveal({ children, className, delay = 0, immediate = false }: { children: ReactNode; className?: string; delay?: number; immediate?: boolean }) {
  const reduce = useReducedMotion();
  const trigger = immediate ? { animate: 'visible' } : { whileInView: 'visible', viewport: { once: true, amount: 0.3 } };
  return (
    <motion.div className={className} variants={reduce ? quietFade : withDelay(imageUnmask, delay)} initial="hidden" {...trigger}>
      {children}
    </motion.div>
  );
}
