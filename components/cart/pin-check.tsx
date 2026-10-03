'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { checkPin, type PinCheck as PinResult } from '@/lib/delivery/serviceability';

export function PinCheck() {
  const [pin, setPin] = useState('');
  const [result, setResult] = useState<PinResult | null>(null);
  return (
    <form className="pin-check" onSubmit={(event) => { event.preventDefault(); setResult(checkPin(pin)); }}>
      <label htmlFor="pin-check" className="eyebrow eyebrow-light">Delivering to</label>
      <div className="pin-row">
        <input id="pin-check" inputMode="numeric" maxLength={6} placeholder="PIN code" value={pin} onChange={(event) => { setPin(event.target.value.replace(/\D/g, '')); setResult(null); }} />
        <button type="submit" className="btn btn-ghost btn-sm on-dark">Check</button>
      </div>
      <AnimatePresence mode="wait">
        {result && (
          <motion.p key={result.message} className={`pin-result is-${result.status}`} role="status" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            {result.message}
          </motion.p>
        )}
      </AnimatePresence>
    </form>
  );
}
