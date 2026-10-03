'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { lineRise, quietFade, withDelay } from '@/lib/motion/variants';

type TextRevealProps = {
  lines: string[];
  as?: 'h1' | 'h2' | 'h3' | 'p';
  className?: string;
  /** Seconds before the first line. */
  delay?: number;
  /** Seconds between lines. */
  gap?: number;
  /** Animate on mount instead of when scrolled into view. */
  immediate?: boolean;
  id?: string;
};

/** Editorial headline: each line rises from behind a mask, one after another. */
export function TextReveal({ lines, as = 'h2', className, delay = 0, gap = 0.13, immediate = false, id }: TextRevealProps) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  const trigger = immediate ? { animate: 'visible' } : { whileInView: 'visible', viewport: { once: true, amount: 0.6 } };
  return (
    <Tag id={id} className={className} initial="hidden" {...trigger} aria-label={lines.join(' ')}>
      {lines.map((line, i) => (
        <span className="line-mask" key={`${line}-${i}`} aria-hidden="true">
          <motion.span className="line-inner" variants={reduce ? quietFade : withDelay(lineRise, delay + i * gap)}>
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}
