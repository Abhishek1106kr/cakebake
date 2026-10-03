'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { quietFade, revealUp, withDelay } from '@/lib/motion/variants';

type RevealProps = { children: ReactNode; className?: string; delay?: number; as?: 'div' | 'section' | 'li' | 'p' };

/** Rises into place the first time it scrolls into view. */
export function Reveal({ children, className, delay = 0, as = 'div' }: RevealProps) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      variants={reduce ? quietFade : withDelay(revealUp, delay)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.25 }}
    >
      {children}
    </Tag>
  );
}
