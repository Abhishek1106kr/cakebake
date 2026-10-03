// The Tresor motion scale (CLAUDE.md §7). Components import these values
// instead of inventing their own.

export const EASE = [0.22, 1, 0.36, 1] as const; // entering UI
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const; // exits and veils

export const DURATION = {
  micro: 0.13,
  button: 0.18,
  card: 0.24,
  dropdown: 0.22,
  modal: 0.3,
  page: 0.5,
  hero: 1.0,
  cinematic: 1.6,
} as const;

export const SPRING = {
  tactile: { type: 'spring', stiffness: 320, damping: 26, mass: 0.6 },
  soft: { type: 'spring', stiffness: 140, damping: 20 },
  magnetic: { type: 'spring', stiffness: 220, damping: 18, mass: 0.4 },
} as const;

export const transition = {
  micro: { duration: DURATION.micro, ease: EASE },
  button: { duration: DURATION.button, ease: EASE },
  card: { duration: DURATION.card, ease: EASE },
  modal: { duration: DURATION.modal, ease: EASE },
  page: { duration: DURATION.page, ease: EASE },
  hero: { duration: DURATION.hero, ease: EASE },
} as const;
