'use client';

// The journey as a list. Past steps are done, the current one is dominant, future
// ones are muted. A change draws the connector forward, grows the new dot and
// slides its description in (about 0.7 s). Fully readable without motion.

import { AnimatePresence, motion } from 'framer-motion';
import { statusTime, type Order } from '@/lib/orders';
import { JOURNEY, statusCopy, type TrackingStatus } from '@/lib/tracking/status';
import { EASE } from '@/lib/motion';

const time = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '');

export function TrackingTimeline({ order, status, reduce }: { order: Order; status: TrackingStatus; reduce: boolean }) {
  const cake = order.items.some((l) => l.custom);
  const stopped = status === 'CANCELLED' || status === 'PAYMENT_FAILED';
  const reachedBeforeStop = stopped ? Math.max(0, ...order.history.map((h) => JOURNEY.indexOf(h.status))) : -1;
  const steps: TrackingStatus[] = stopped ? [...JOURNEY.slice(0, reachedBeforeStop + 1), status] : JOURNEY;
  const current = steps.indexOf(status);
  const t = reduce ? { duration: 0 } : { duration: 0.7, ease: EASE };
  return (
    <ol className="track-timeline" aria-label="Order progress">
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'upcoming';
        const copy = statusCopy(s, { cake });
        const when = time(statusTime(order, s as never));
        return (
          <li key={s} className={`tl-step is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <div className="tl-rail" aria-hidden="true">
              <motion.span className="tl-dot" initial={false} animate={{ scale: state === 'current' ? 1 : 0.8 }} transition={t}>
                {state === 'done' && <svg viewBox="0 0 12 12"><path d="M2.5 6.2 l2.3 2.3 4.7 -5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </motion.span>
              {state === 'current' && !stopped && s !== 'DELIVERED' && <span className="tl-pulse" />}
              {i < steps.length - 1 && <span className="tl-line"><motion.span className="tl-line-fill" initial={false} animate={{ scaleY: i < current ? 1 : 0 }} transition={t} /></span>}
            </div>
            <div className="tl-body">
              <div className="tl-head">
                <strong>{copy.label}</strong>
                <span className="sr-only">{state === 'done' ? ', done' : state === 'current' ? ', happening now' : ', next'}</span>
                {when && state !== 'upcoming' && <time dateTime={statusTime(order, s as never)}>{when}</time>}
              </div>
              <AnimatePresence initial={false}>
                {state === 'current' && (
                  <motion.p key={s} className="tl-doing" initial={reduce ? false : { opacity: 0, y: -6, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={t}>{copy.doing}</motion.p>
                )}
              </AnimatePresence>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
