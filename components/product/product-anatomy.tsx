'use client';

import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { useRef, useState } from 'react';
import { ProductArt } from '@/components/media/product-art';
import type { Product } from '@/data/products';
import { EASE } from '@/lib/motion/transitions';

/**
 * "Inside": the product stays put while hairlines draw, one layer at a time,
 * from the drawing out to each label. Labels are real text in the DOM.
 */
export function ProductAnatomy({ product }: { product: Product }) {
  const layers = product.anatomy ?? [];
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(reduce ? layers.length - 1 : -1);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 65%', 'end 75%'] });

  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    if (reduce) return;
    setActive(Math.min(layers.length - 1, Math.floor(value * (layers.length + 0.4)) - 0));
  });

  if (layers.length === 0) return null;
  const y = (i: number) => 26 + (i * 48) / Math.max(1, layers.length - 1);

  return (
    <section ref={ref} className="anatomy wrap" aria-labelledby="anatomy-title">
      <div className="anatomy-stage">
        <div className="anatomy-media">
          <ProductArt product={product} view="whole" sizes="(max-width: 860px) 100vw, 50vw" />
          <svg className="anatomy-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {layers.map((layer, i) => (
              <g key={layer.label}>
                <motion.circle cx={52 - i * 1.5} cy={y(i)} r="0.8" initial={false} animate={{ opacity: i <= active ? 1 : 0 }} transition={{ duration: 0.2 }} />
                <motion.path
                  d={`M${52 - i * 1.5} ${y(i)} L 78 ${y(i)} L 100 ${y(i)}`}
                  vectorEffect="non-scaling-stroke"
                  initial={false}
                  animate={{ pathLength: i <= active ? 1 : 0, opacity: i <= active ? 1 : 0 }}
                  transition={{ duration: reduce ? 0 : 0.6, ease: EASE }}
                />
              </g>
            ))}
          </svg>
        </div>
      </div>
      <div className="anatomy-copy">
        <div className="eyebrow">Inside</div>
        <h2 id="anatomy-title" className="section-title display">What you&rsquo;re tasting.</h2>
        <ol className="anatomy-list">
          {layers.map((layer, i) => (
            <li key={layer.label} className={i <= active ? 'is-active' : ''}>
              <span className="anatomy-num">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <strong className="display">{layer.label}</strong>
                <span>{layer.detail}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
