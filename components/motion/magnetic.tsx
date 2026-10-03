'use client';

import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SPRING } from '@/lib/motion/transitions';

const MAX_PULL = 6; // px (CLAUDE.md §32: 4–8px)

/**
 * Very subtle pointer attraction for primary CTAs only.
 * Desktop with a fine pointer only; inert on touch and under reduced motion.
 */
export function Magnetic({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const [enabled, setEnabled] = useState(false);
  const x = useSpring(useMotionValue(0), SPRING.magnetic);
  const y = useSpring(useMotionValue(0), SPRING.magnetic);

  useEffect(() => {
    setEnabled(!reduce && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  }, [reduce]);

  const onMove = (event: React.PointerEvent) => {
    if (!enabled || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const dy = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    x.set(Math.max(-1, Math.min(1, dx)) * MAX_PULL);
    y.set(Math.max(-1, Math.min(1, dy)) * MAX_PULL * 0.6);
  };
  const reset = () => { x.set(0); y.set(0); };

  return (
    <motion.span ref={ref} className={`magnetic ${className ?? ''}`} style={enabled ? { x, y } : undefined} onPointerMove={onMove} onPointerLeave={reset}>
      {children}
    </motion.span>
  );
}
