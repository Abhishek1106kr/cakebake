'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { EASE } from '@/lib/motion';

// Quiet secondary order path (REFERENCES.md §6, from Paris Baguette): one primary
// Tresor CTA, with Zomato/Swiggy behind a short "Ordering through…" transition.
// URLs come from env and are never invented; unset links show as "soon".
const DESTINATIONS = [
  { name: 'ZOMATO', url: process.env.NEXT_PUBLIC_ZOMATO_URL },
  { name: 'SWIGGY', url: process.env.NEXT_PUBLIC_SWIGGY_URL },
];

export function OrderElsewhere() {
  const reduce = useReducedMotion();
  const [target, setTarget] = useState<string | null>(null);
  const go = (name: string, url: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (reduce) { window.location.assign(url); return; }
    setTarget(name);
    window.setTimeout(() => window.location.assign(url), 350);
  };
  return (
    <div className="order-links">
      {DESTINATIONS.map((d) => (d.url
        ? <a key={d.name} className="btn btn-secondary" href={d.url} rel="noopener noreferrer" onClick={go(d.name, d.url)}>{d.name} ↗</a>
        : <span key={d.name} className="btn btn-secondary is-soon" title="Link not configured yet">{d.name} · SOON</span>))}
      <AnimatePresence>
        {target && (
          <motion.div className="redirect-overlay" role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
            <span className="eyebrow" style={{ color: 'rgba(255,255,255,.8)' }}>ORDERING THROUGH</span>
            <motion.strong className="font-display" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.28, ease: EASE }}>{target}</motion.strong>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Redirecting…</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
