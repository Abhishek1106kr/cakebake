// Context engine: one reusable description of "who, where, when, what" that
// search, recommendations, personalisation, content and media all consume.
// Pure builders plus a guarded browser reader (safe during SSR).

export type DeviceClass = 'mobile' | 'tablet' | 'desktop';
export type NetworkClass = 'slow' | 'medium' | 'fast' | 'unknown';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';
export type Season = 'summer' | 'monsoon' | 'post-monsoon' | 'winter'; // Bengaluru calendar

/** `I` is the structured intent type (kept generic so context has no dependency on the intent engine). */
export type IntelligenceContext<I = unknown> = {
  sessionId: string;
  customerId: string | null;
  device: DeviceClass;
  viewport: { width: number; height: number };
  network: NetworkClass;
  page: string;
  productId: string | null;
  category: string | null;
  searchQuery: string | null;
  intent: I | null;
  cart: { productId: string; qty: number }[];
  orderHistory: { productId: string; qty: number; at: string }[];
  now: string;
  timeOfDay: TimeOfDay;
  dayOfWeek: number; // 0 = Sunday, IST
  season: Season;
  campaign: string | null;
  reducedMotion: boolean;
  experiments: Record<string, string>;
};

const IST_OFFSET_MIN = 330;

function ist(date: Date) {
  return new Date(date.getTime() + (IST_OFFSET_MIN + date.getTimezoneOffset()) * 60000);
}

export function timeOfDayFor(date: Date): TimeOfDay {
  const h = ist(date).getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

export function seasonFor(date: Date): Season {
  const m = ist(date).getMonth(); // 0 = Jan
  if (m >= 2 && m <= 4) return 'summer';
  if (m >= 5 && m <= 8) return 'monsoon';
  if (m >= 9 && m <= 10) return 'post-monsoon';
  return 'winter';
}

export function deviceFor(width: number): DeviceClass {
  if (width < 768) return 'mobile';
  if (width < 1100) return 'tablet';
  return 'desktop';
}

export function networkFor(effectiveType?: string, saveData?: boolean): NetworkClass {
  if (saveData) return 'slow';
  if (!effectiveType) return 'unknown';
  if (effectiveType === 'slow-2g' || effectiveType === '2g') return 'slow';
  if (effectiveType === '3g') return 'medium';
  return 'fast';
}

/** Pure builder: fills sensible defaults so every consumer gets a complete context. */
export function buildContext(input: Partial<IntelligenceContext> & { at?: Date } = {}): IntelligenceContext {
  const at = input.at ?? new Date(input.now ?? Date.now());
  const viewport = input.viewport ?? { width: 1440, height: 900 };
  return {
    sessionId: input.sessionId ?? 'anonymous',
    customerId: input.customerId ?? null,
    device: input.device ?? deviceFor(viewport.width),
    viewport,
    network: input.network ?? 'unknown',
    page: input.page ?? '/',
    productId: input.productId ?? null,
    category: input.category ?? null,
    searchQuery: input.searchQuery ?? null,
    intent: input.intent ?? null,
    cart: input.cart ?? [],
    orderHistory: input.orderHistory ?? [],
    now: at.toISOString(),
    timeOfDay: input.timeOfDay ?? timeOfDayFor(at),
    dayOfWeek: input.dayOfWeek ?? ist(at).getDay(),
    season: input.season ?? seasonFor(at),
    campaign: input.campaign ?? null,
    reducedMotion: input.reducedMotion ?? false,
    experiments: input.experiments ?? {},
  };
}

/** Opaque, per-tab session id. Never derived from personal data. */
export function sessionId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = window.sessionStorage.getItem('tresor-session');
    if (existing) return existing;
    const id = `s-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem('tresor-session', id);
    return id;
  } catch {
    return 'anonymous';
  }
}

/** Reads what the browser can legitimately tell us. Safe to call during SSR (returns defaults). */
export function browserContext(extra: Partial<IntelligenceContext> = {}): IntelligenceContext {
  if (typeof window === 'undefined') return buildContext(extra);
  const conn = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
  return buildContext({
    sessionId: sessionId(),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    network: networkFor(conn?.effectiveType, conn?.saveData),
    page: window.location.pathname,
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    ...extra,
  });
}
