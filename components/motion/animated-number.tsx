'use client';

import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

/** Counts smoothly to a new value: totals feel recalculated rather than swapped. */
export function AnimatedNumber({ value, format = (n) => String(n), duration = 0.45 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (reduce) { setDisplay(value); from.current = value; return; }
    const controls = animate(from.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, reduce, duration]);

  return <span className="tabular">{format(display)}</span>;
}
