'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef, type ReactNode } from 'react';

/** Restrained parallax: the child drifts up to `distance` px across the viewport. */
export function Parallax({ children, distance = 60, className }: { children: ReactNode; distance?: number; className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [distance / 2, -distance / 2]);
  return (
    <div ref={ref} className={className}>
      <motion.div style={reduce ? undefined : { y }} className="parallax-inner">{children}</motion.div>
    </div>
  );
}
