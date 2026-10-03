'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { EASE } from '@/lib/motion/transitions';

/** Disclosure with an interruptible height animation (button + region pattern). */
export function Disclosure({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={`disclosure ${open ? 'is-open' : ''}`}>
      <button type="button" className="disclosure-trigger" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        <span>{title}</span>
        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2, ease: EASE }} className="disclosure-icon"><Plus size={16} strokeWidth={1.4} /></motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            role="region"
            className="disclosure-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.26, ease: EASE }}
          >
            <div className="disclosure-body">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
