'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { motion, useMotionTemplate, useTransform } from 'framer-motion';
import { useElementScrollProgress } from '@/components/scroll-progress';
import { SplitText, useReducedMotionSafe } from '@/components/cinematic';
import { finale } from '@/lib/story';
import type { Route } from 'next';

/** 08 + 09: the closing statement, the wordmark filling in, then the way to the counter. */
export function StoryFinale() {
  const reduce = useReducedMotionSafe();
  const markRef = useRef<HTMLDivElement>(null);
  const scrollYProgress = useElementScrollProgress(markRef, ['start end', 'center center']);
  const fill = useTransform(scrollYProgress, [0.25, 1], [0, 100]);
  // The wordmark fills like ink rising through outlined letters.
  const bg = useMotionTemplate`linear-gradient(0deg, var(--ink) ${fill}%, transparent ${fill}%)`;
  return (
    <section className="story-finale" aria-labelledby="finale-title">
      <div className="container finale-lines">
        <h2 id="finale-title" className="sr-only">{finale.lines.join(' ')}</h2>
        {finale.lines.map((line, i) => <SplitText key={line} as="p" text={line} className={`finale-line finale-line-${i}`} delay={i * 0.15} />)}
      </div>
      <div ref={markRef} className="finale-mark-wrap" aria-hidden="true">
        <motion.div className="finale-mark" style={reduce ? { backgroundImage: 'linear-gradient(var(--ink), var(--ink))' } : { backgroundImage: bg }}>{finale.wordmark}</motion.div>
      </div>
      <div className="container finale-cta">
        <p className="finale-cta-title">{finale.cta.title}</p>
        <div className="finale-cta-actions">
          <Link className="btn btn-brand" href={finale.cta.primary.href as Route}>{finale.cta.primary.label} <ArrowRight size={15} /></Link>
          <Link className="finale-cta-link" href={finale.cta.secondary.href as Route}>{finale.cta.secondary.label}</Link>
        </div>
      </div>
    </section>
  );
}
