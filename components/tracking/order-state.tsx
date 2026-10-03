'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { formatTimeIST, pad2 } from '@/lib/format';
import { EASE } from '@/lib/motion/transitions';
import { statusCopy, statusSteps, type Order, type OrderStatus } from '@/lib/orders/orders';

/** Animated status timeline. Only the current step pulses. */
export function OrderState({ order, status }: { order: Order; status: OrderStatus }) {
  const reduce = useReducedMotion();
  const steps = statusSteps(order.fulfilment);
  const current = steps.indexOf(status);

  return (
    <ol className="order-state" aria-label="Order progress">
      {steps.map((step, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'upcoming';
        const copy = statusCopy(step, order.fulfilment);
        const at = order.schedule.find((s) => s.status === step)?.at;
        return (
          <li key={step} className={`state-row is-${state}`} aria-current={state === 'active' ? 'step' : undefined}>
            <span className="state-marker">
              {state === 'active' && !reduce && <span className="pulse-ring" aria-hidden="true" />}
              <motion.span className="state-dot" layout transition={{ duration: 0.3, ease: EASE }}>
                {state === 'done' ? <Check size={13} strokeWidth={2} /> : pad2(i + 1)}
              </motion.span>
            </span>
            <span className="state-label">{copy.label}</span>
            <motion.span key={state} className="state-copy" initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }}>
              {state === 'active' ? copy.line : state === 'done' && at ? formatTimeIST(at) : at && !order.demoTimeline ? `From ${formatTimeIST(at)}` : 'Up next'}
            </motion.span>
            {i < steps.length - 1 && (
              <span className="state-line" aria-hidden="true">
                <motion.span initial={false} animate={{ scaleY: i < current ? 1 : 0 }} transition={{ duration: reduce ? 0 : 0.6, ease: EASE }} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
