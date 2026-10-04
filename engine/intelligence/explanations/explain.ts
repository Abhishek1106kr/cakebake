// Explanations: WHAT happened, WHY, on what EVIDENCE, with what CONFIDENCE,
// and what to do NEXT. Customer-facing reasons stay short and plain; the full
// structure is for the admin and for debugging.

import type { Evidence } from '../core/contract';

export type Explanation = {
  what: string;
  why: string[];
  evidence: Evidence[];
  confidence: number;
  next: string | null;
};

export function explanation(what: string, why: string[], evidence: Evidence[], confidence: number, next: string | null = null): Explanation {
  return { what, why: why.filter(Boolean), evidence, confidence: Math.round(confidence * 100) / 100, next };
}

/** Joins up to `max` short reasons into one line for a product card ("Nutty · warm from the oven"). */
export function reasonLine(reasons: string[], max = 3): string | null {
  const unique = [...new Set(reasons.filter(Boolean))].slice(0, max);
  if (!unique.length) return null;
  const line = unique.join(' · ');
  return line.charAt(0).toUpperCase() + line.slice(1);
}

export function confidenceLabel(c: number): 'high' | 'medium' | 'low' {
  return c >= 0.75 ? 'high' : c >= 0.45 ? 'medium' : 'low';
}
