// Shape geometry shared by the preview: every cake top is an outline in a unit
// box centred on (0, 0), from x −0.5…0.5. Front view projects it with a vertical
// squash and extrudes it; top view draws it flat. Same outline everywhere, so the
// printable area, toppings and drips all line up.

import type { ShapeOption } from '@/lib/cake/types';

export type Pt = [number, number];
export const SQUASH = 0.42;

function heartPoint(t: number): Pt {
  const x = 16 * Math.sin(t) ** 3;
  const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
  // y spans −11.93 (top of the lobes) … 17 (the point); centre it in the unit box.
  return [x / 32, (y - 2.53) / 28.94];
}

/** Outline points, clockwise, starting at the back. */
export function outline(kind: ShapeOption['kind'], n = 72): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = (i / n) * Math.PI * 2;
    if (kind === 'round') pts.push([0.5 * Math.sin(t), -0.5 * Math.cos(t)]);
    else if (kind === 'heart') pts.push(heartPoint(t));
    else {
      // Rounded rectangle via a superellipse: soft corners like a real tin.
      const w = kind === 'rectangle' ? 0.68 : 0.5;
      const h = kind === 'rectangle' ? 0.46 : 0.5;
      const s = Math.sin(t); const c = Math.cos(t);
      const e = 0.18;
      pts.push([w * Math.sign(s) * Math.abs(s) ** e, -h * Math.sign(c) * Math.abs(c) ** e]);
    }
  }
  return pts;
}

/** Width/height of the outline's box (heart and round are 1×1, rectangle wider). */
export function extent(kind: ShapeOption['kind']): { w: number; h: number } {
  return kind === 'rectangle' ? { w: 1.36, h: 0.92 } : { w: 1, h: 1 };
}

export const toPath = (pts: Pt[]) => `M${pts.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).join('L')}Z`;

export function scalePts(pts: Pt[], k: number): Pt[] { return pts.map(([x, y]) => [x * k, y * k]); }

/** Points for decorations along the front half of the outline (what the viewer sees). */
export function frontEdge(pts: Pt[]): Pt[] {
  return pts.filter(([, y]) => y >= -0.02).sort((a, b) => a[0] - b[0]);
}

/** Evenly spaced positions on a ring inside the outline, for toppings and candles. */
export function ring(kind: ShapeOption['kind'], count: number, inset = 0.74, phase = 0): Pt[] {
  if (count <= 0) return [];
  const base = outline(kind, 360);
  const out: Pt[] = [];
  for (let i = 0; i < count; i += 1) {
    const idx = Math.floor(((i + phase) / count) * base.length) % base.length;
    const [x, y] = base[idx];
    out.push([x * inset, y * inset + (kind === 'heart' ? 0.03 : 0)]);
  }
  return out;
}

/** Normalized printable box (0–1) → outline space, matching lib/cake/engine's printable area. */
export function printBox(kind: ShapeOption['kind'], inset: number): { x: number; y: number; w: number; h: number } {
  const e = extent(kind);
  const k = 1 - 2 * inset;
  return { x: (-e.w / 2) * k, y: (-e.h / 2) * k, w: e.w * k, h: e.h * k };
}
