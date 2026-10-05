// Responsive variants for local images (scripts/build-media-variants.ts writes the index).
// Read where the local photos exist: the dev server, or a deployment made with them
// (NEXT_PUBLIC_LOCAL_MEDIA=1). Other builds never request the index and keep the tone-gradient fallbacks.

import { useEffect, useState } from 'react';
import { LOCAL_MEDIA } from './local-media';

export type MediaVariant = { width: number; height: number; avif: string[]; webp: string[]; thumb: string; placeholder: string };
type Index = Record<string, MediaVariant>;

let index: Index | null = null;
let loading: Promise<Index> | null = null;
const listeners = new Set<() => void>();

function load(): Promise<Index> {
  if (index) return Promise.resolve(index);
  if (!LOCAL_MEDIA || typeof window === 'undefined') return Promise.resolve((index = {}));
  loading ??= fetch('/mock-assets/_v/variants.json')
    .then((r) => (r.ok ? (r.json() as Promise<Index>) : {}))
    .catch(() => ({}))
    .then((v) => { index = v; listeners.forEach((l) => l()); return v; });
  return loading;
}

/**
 * Variants for an image path: the variant, null when there is none, or undefined while the index is
 * still loading on the development server (so a caller can avoid downloading the original first).
 */
export function useMediaVariant(src: string | undefined): MediaVariant | null | undefined {
  const [, bump] = useState(0);
  useEffect(() => {
    if (index) return;
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    void load();
    return () => { listeners.delete(l); };
  }, []);
  if (!index) return LOCAL_MEDIA ? undefined : null;
  return src ? index[src] ?? null : null;
}
