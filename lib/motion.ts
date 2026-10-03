// Tresor motion tokens (see MOTION.md). Each motion family has its own feel;
// components import these instead of inventing values.
import type { Transition, Variants } from 'framer-motion';

export const EASE = [0.22, 1, 0.36, 1] as const;          // editorial: soft, deliberate
export const EASE_UI = [0.2, 0, 0, 1] as const;           // ui: quick, precise
export const EASE_IMAGE = [0.76, 0, 0.24, 1] as const;    // image: heavy, cinematic
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;   // page: smooth, immersive

export const DURATION = { micro: 0.16, ui: 0.22, component: 0.45, editorial: 0.85, image: 1.35, cinematic: 1.6 } as const;

export const T = {
  ui: { duration: DURATION.ui, ease: EASE_UI } satisfies Transition,
  editorial: { duration: DURATION.editorial, ease: EASE } satisfies Transition,
  image: { duration: DURATION.image, ease: EASE_IMAGE } satisfies Transition,
  product: { type: 'spring', stiffness: 220, damping: 24 } satisfies Transition,
  crumb: { type: 'spring', stiffness: 420, damping: 14 } satisfies Transition,
  page: { duration: 0.55, ease: EASE_IN_OUT } satisfies Transition,
};

// Home hero choreography, in seconds.
export const HERO = { media: 0.15, word: 0.55, line1: 1.05, line2: 1.18, copy: 1.35, cta: 1.5, detail: 1.65 } as const;
export const CONFIRM = { ring: 0.1, code: 0.3, headline: 0.45, badge: 0.7, eta: 0.85, cta: 1.0 } as const;

export const revealUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } },
};

export const quiet: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
};

export function riseAt(delay: number, distance = 22): Variants {
  return { hidden: { opacity: 0, y: distance }, visible: { opacity: 1, y: 0, transition: { delay, duration: 0.75, ease: EASE } } };
}

export function lineAt(delay: number): Variants {
  return { hidden: { y: '105%' }, visible: { y: '0%', transition: { delay, duration: 0.95, ease: EASE } } };
}
