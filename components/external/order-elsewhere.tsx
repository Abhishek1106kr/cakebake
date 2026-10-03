'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { site } from '@/data/site';
import { EASE } from '@/lib/motion/transitions';

const REDIRECT_MS = 350; // brief: 150–400 ms, never a fake loading sequence

type Destination = { name: string; url?: string };

export function useExternalRedirect() {
  const reduce = useReducedMotion();
  const [target, setTarget] = useState<Destination | null>(null);

  const go = (destination: Destination) => (event: React.MouseEvent) => {
    if (!destination.url) return;
    event.preventDefault();
    if (reduce) { window.location.assign(destination.url); return; }
    setTarget(destination);
    window.setTimeout(() => window.location.assign(destination.url!), REDIRECT_MS);
  };

  const overlay = (
    <AnimatePresence>
      {target && (
        <motion.div className="redirect-overlay" role="status" aria-live="assertive" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
          <span className="eyebrow">Ordering through</span>
          <motion.strong initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.28, ease: EASE }}>{target.name}</motion.strong>
          <span className="redirect-note">Redirecting…</span>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return { go, overlay };
}

/** Quiet secondary order path: Zomato and Swiggy, configured per environment. */
export function OrderElsewhere({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const { go, overlay } = useExternalRedirect();
  const destinations: Destination[] = [
    { name: 'Zomato', url: site.links.zomato },
    { name: 'Swiggy', url: site.links.swiggy },
  ];
  return (
    <div className={`order-elsewhere ${compact ? 'is-compact' : ''} ${className}`}>
      {destinations.map((destination) =>
        destination.url ? (
          <a key={destination.name} href={destination.url} onClick={go(destination)} className="btn btn-ghost btn-sm" rel="noopener noreferrer">
            {destination.name} <ArrowUpRight size={14} strokeWidth={1.5} />
          </a>
        ) : (
          <span key={destination.name} className="btn btn-ghost btn-sm is-unavailable" title="Link not configured yet">
            {destination.name} · soon
          </span>
        ),
      )}
      {overlay}
    </div>
  );
}
