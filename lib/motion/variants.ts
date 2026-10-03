import type { Variants } from 'framer-motion';
import { DURATION, EASE } from './transitions';

export const revealUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.page, ease: EASE } },
};

/** Masked line: the text rises from behind its own baseline. */
export const lineRise: Variants = {
  hidden: { y: '105%' },
  visible: { y: '0%', transition: { duration: 0.9, ease: EASE } },
};

/** Image unmasks from the bottom while settling from a slight scale. */
export const imageUnmask: Variants = {
  hidden: { clipPath: 'inset(100% 0% 0% 0%)', scale: 1.04 },
  visible: { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, transition: { duration: 1.1, ease: EASE } },
};

export function stagger(gap = 0.08, delay = 0): Variants {
  return { hidden: {}, visible: { transition: { staggerChildren: gap, delayChildren: delay } } };
}

/**
 * Returns a copy whose `visible` transition starts later. Needed because a
 * transition defined inside a variant wins over the component's transition prop.
 */
export function withDelay(variants: Variants, delay: number): Variants {
  if (!delay) return variants;
  const visible = variants.visible as { transition?: object } & Record<string, unknown>;
  return { ...variants, visible: { ...visible, transition: { ...(visible.transition ?? {}), delay } } };
}

/** Reduced-motion stand-ins: information arrives, nothing travels. */
export const quietFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
};
