// The motion scale (CLAUDE.md §7). Components import these instead of
// inventing their own values.
import type { Variants } from 'framer-motion';

export const EASE = [0.22, 1, 0.36, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

export const DURATION = { micro: 0.13, button: 0.18, card: 0.24, modal: 0.3, page: 0.5, hero: 1.0 } as const;

// Home hero choreography, in seconds (CLAUDE.md §11).
export const HERO = { media: 0.25, line1: 0.45, line2: 0.58, copy: 0.72, cta: 0.85, detail: 1.0 } as const;

// Confirmation choreography (CLAUDE.md §22).
export const CONFIRM = { ring: 0.1, code: 0.3, headline: 0.45, badge: 0.7, eta: 0.85, cta: 1.0 } as const;

export const revealUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } },
};

export const quiet: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
};

/** Variant that rises after `delay` seconds (variant transitions win over props, so delay lives here). */
export function riseAt(delay: number, distance = 22): Variants {
  return { hidden: { opacity: 0, y: distance }, visible: { opacity: 1, y: 0, transition: { delay, duration: 0.75, ease: EASE } } };
}

export function lineAt(delay: number): Variants {
  return { hidden: { y: '105%' }, visible: { y: '0%', transition: { delay, duration: 0.95, ease: EASE } } };
}
