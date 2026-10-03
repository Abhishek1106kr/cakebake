'use client';

import { motion, useReducedMotion } from 'framer-motion';

/** Shown only while the (simulated) payment request is in flight. */
export function ProcessingOverlay() {
  const reduce = useReducedMotion();
  return (
    <motion.div className="processing-overlay" role="status" aria-live="assertive" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <div className="orbit" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <motion.span
            key={i}
            style={{ rotate: i * 90 }}
            animate={reduce ? undefined : { rotate: i * 90 + 360 }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'linear', delay: i * 0.08 }}
          >
            <i />
          </motion.span>
        ))}
      </div>
      <p className="display">Preparing your order</p>
      <span className="processing-note">A little moment… confirming your simulated payment.</span>
    </motion.div>
  );
}
