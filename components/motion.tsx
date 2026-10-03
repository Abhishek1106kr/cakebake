'use client';

// Reusable motion primitives for the v3 variation.
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EASE, EASE_IN_OUT, quiet, revealUp } from '@/lib/motion';

/** Rises into place the first time it scrolls into view. */
export function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  const variants = reduce ? quiet : { ...revealUp, visible: { ...revealUp.visible, transition: { duration: 0.65, ease: EASE, delay } } };
  return <motion.div className={className} variants={variants} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.18 }}>{children}</motion.div>;
}

/** Editorial headline: each line rises from behind a mask. */
export function LineReveal({ lines, className = '', delay = 0, gap = 0.13, as = 'h2' }: { lines: string[]; className?: string; delay?: number; gap?: number; as?: 'h1' | 'h2' | 'p' }) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  return (
    <Tag className={className} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.5 }} aria-label={lines.join(' ')}>
      {lines.map((line, i) => (
        <span className="line-mask" key={line} aria-hidden="true">
          <motion.span className="line-inner" variants={reduce ? quiet : { hidden: { y: '105%' }, visible: { y: '0%', transition: { delay: delay + i * gap, duration: 0.9, ease: EASE } } }}>{line}</motion.span>
        </span>
      ))}
    </Tag>
  );
}

// Page transition: a sage veil sweeps away as the new page settles in.
// The first load shows the page directly.
let firstMount = true;
const LABELS: [string, string][] = [['/shop', 'Menu'], ['/customize-cake', 'Customize cake'], ['/cart', 'Your bag'], ['/checkout', 'Checkout'], ['/order-confirmed', 'Order'], ['/track-order', 'Order'], ['/about', 'Our story'], ['/contact', 'Visit'], ['/account', 'Account'], ['/admin', 'Admin']];

export function PageTransition({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const pathname = usePathname();
  const initial = firstMount;
  useEffect(() => { firstMount = false; }, []);
  if (initial) return <>{children}</>;
  if (reduce) return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>{children}</motion.div>;
  const label = LABELS.find(([prefix]) => pathname.startsWith(prefix))?.[1];
  return (
    <>
      <motion.div className="page-veil" aria-hidden="true" initial={{ y: '0%' }} animate={{ y: '-100%' }} transition={{ duration: 0.45, delay: 0.12, ease: EASE_IN_OUT }}>
        <motion.div className="veil-label" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.18, delay: 0.1 }}>
          <span>TRESOR</span>{label && <strong>{label}</strong>}
        </motion.div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.18, ease: EASE }}>{children}</motion.div>
    </>
  );
}

/** Bag count: pops 1 → 1.2 → 1 and the new number slides in. */
export function CartCount({ count }: { count: number }) {
  const reduce = useReducedMotion();
  return (
    <span className="cart-count" aria-hidden="true">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={count} initial={reduce ? { opacity: 0 } : { y: 8, opacity: 0 }} animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1, scale: [1, 1.2, 1] }} exit={reduce ? { opacity: 0 } : { y: -8, opacity: 0 }} transition={{ duration: 0.32, ease: EASE }}>
          {String(count).padStart(2, '0')}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Counts to a new value so totals feel recalculated. */
export function AnimatedNumber({ value, prefix = '₹' }: { value: number; prefix?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduce) { setShown(value); from.current = value; return; }
    const controls = animate(from.current, value, { duration: 0.45, ease: EASE, onUpdate: (v) => setShown(Math.round(v)) });
    from.current = value;
    return () => controls.stop();
  }, [value, reduce]);
  return <span className="tabular">{prefix}{shown.toLocaleString('en-IN')}</span>;
}

/** Subtle pointer attraction for primary CTAs; desktop fine pointers only. */
export function Magnetic({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const [on, setOn] = useState(false);
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 18, mass: 0.4 });
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 18, mass: 0.4 });
  useEffect(() => { setOn(!reduce && window.matchMedia('(hover: hover) and (pointer: fine)').matches); }, [reduce]);
  return (
    <motion.span
      ref={ref}
      className="magnetic"
      style={on ? { x, y } : undefined}
      onPointerMove={(e) => {
        if (!on || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set(((e.clientX - r.left) / r.width - 0.5) * 12);
        y.set(((e.clientY - r.top) / r.height - 0.5) * 7);
      }}
      onPointerLeave={() => { x.set(0); y.set(0); }}
    >
      {children}
    </motion.span>
  );
}

/** Button that locks briefly, shows progress, then draws a checkmark. */
export function AddButton({ onAdd, label, addedLabel = 'ADDED', className = 'btn btn-secondary' }: { onAdd: () => boolean; label: ReactNode; addedLabel?: string; className?: string }) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<'idle' | 'adding' | 'added'>('idle');
  const click = () => {
    if (phase !== 'idle') return;
    setPhase('adding');
    window.setTimeout(() => {
      const ok = onAdd();
      setPhase(ok ? 'added' : 'idle');
      if (ok) window.setTimeout(() => setPhase('idle'), 1400);
    }, reduce ? 0 : 220);
  };
  return (
    <motion.button type="button" className={`${className} add-btn is-${phase}`} onClick={click} layout whileTap={reduce ? undefined : { scale: 0.97 }} aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={phase} className="add-btn-content" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.15 }}>
          {phase === 'idle' && label}
          {phase === 'adding' && <span className="add-progress"><motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.22, ease: EASE }} /></span>}
          {phase === 'added' && (
            <>
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><motion.path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, ease: EASE }} /></svg>
              {addedLabel}
            </>
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
