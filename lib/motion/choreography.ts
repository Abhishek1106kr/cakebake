// Seconds from page ready. Home hero sequence (CLAUDE.md §11).
export const HERO = {
  background: 0,
  nav: 0.15,
  media: 0.25,
  line1: 0.45,
  line2: 0.58,
  copy: 0.72,
  cta: 0.85,
  detail: 1.0,
} as const;

// Order confirmation sequence (CLAUDE.md §22).
export const CONFIRMATION = {
  background: 0,
  ring: 0.1,
  orderNumber: 0.25,
  headline: 0.4,
  badge: 0.65,
  eta: 0.8,
  cta: 1.0,
} as const;

/** How long the first-visit loader may hold the page at most. */
export const LOADER_MAX_MS = 900;
