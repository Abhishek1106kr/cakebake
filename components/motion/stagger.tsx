'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { quietFade, revealUp, stagger } from '@/lib/motion/variants';

export function StaggerGroup({ children, className, gap = 0.07, delay = 0 }: { children: ReactNode; className?: string; gap?: number; delay?: number }) {
  return (
    <motion.div className={className} variants={stagger(gap, delay)} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return <motion.div className={className} variants={reduce ? quietFade : revealUp}>{children}</motion.div>;
}
