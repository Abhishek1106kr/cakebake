import Image from 'next/image';
import type { ArtKind, Product, Tone } from '@/data/products';

// Original hairline drawings used until real photography arrives.
// Each sits on a soft tonal backdrop (CLAUDE.md §43: soft-colour fallback).

const drawings: Record<ArtKind, React.ReactNode> = {
  croissant: (
    <>
      <path d="M38 124c10-34 46-54 62-54s52 20 62 54" />
      <path d="M38 124c18 14 44 20 62 20s44-6 62-20" />
      <path d="M38 124c-6-4-10-12-6-18M162 124c6-4 10-12 6-18" />
      <path d="M70 84c-2 16 0 38 6 56M100 70v74M130 84c2 16 0 38-6 56" />
      <path d="M84 76c-4 18-4 44 2 66M116 76c4 18 4 44-2 66" opacity=".5" />
    </>
  ),
  cup: (
    <>
      <ellipse cx="100" cy="150" rx="56" ry="10" />
      <path d="M62 96h76v18c0 22-17 36-38 36s-38-14-38-36z" />
      <path d="M138 104h8a12 12 0 0 1 0 24h-10" />
      <ellipse cx="100" cy="96" rx="38" ry="6" />
      <path className="steam" d="M88 82c-6-8 6-14 0-24" />
      <path className="steam steam-2" d="M104 80c-6-8 6-14 0-24" />
    </>
  ),
  glass: (
    <>
      <path d="M70 56h60l-7 98a6 6 0 0 1-6 6H83a6 6 0 0 1-6-6z" />
      <path d="M74 86h52" />
      <rect x="84" y="94" width="16" height="16" rx="3" transform="rotate(-10 92 102)" />
      <rect x="102" y="112" width="15" height="15" rx="3" transform="rotate(12 110 120)" />
      <path d="M112 40l-6 62" />
      <path d="M118 66c8-2 14 4 12 10" opacity=".5" />
    </>
  ),
  tart: (
    <>
      <path d="M100 48c8 0 10 6 18 8s12-2 18 4-2 10 2 18 10 8 10 16-6 10-6 18 4 12-2 18-12 0-18 4-10 10-18 10-10-6-18-10-12 2-18-4-2-10-6-18-6-10-6-18 6-8 10-16 0-12 2-18 10-2 18-4 10-8 18-8z" />
      <circle cx="100" cy="100" r="40" />
      <circle cx="88" cy="92" r="5" /><circle cx="110" cy="88" r="4" /><circle cx="104" cy="110" r="5" /><circle cx="86" cy="112" r="3" />
    </>
  ),
  roll: (
    <>
      <path d="M100 100m-6 0a6 6 0 1 1 12 0a14 14 0 1 1-28 0a22 22 0 1 1 44 0a30 30 0 1 1-60 0a38 38 0 1 1 76 0a46 46 0 1 1-92 0" />
      <path d="M70 70c6 4 10 4 16 0M118 128c6 4 10 4 16 0" opacity=".5" />
    </>
  ),
  toast: (
    <>
      <path d="M58 150V96c-12-4-14-20-4-30 12-12 34-16 46-16s34 4 46 16c10 10 8 26-4 30v54z" />
      <ellipse cx="100" cy="112" rx="30" ry="18" />
      <path d="M84 108c6 4 14 6 22 2M92 120c6 2 12 2 18-2" opacity=".6" />
      <circle cx="80" cy="96" r="2" /><circle cx="122" cy="100" r="2" />
    </>
  ),
  slice: (
    <>
      <path d="M50 120l100-44v44z" />
      <path d="M50 120v24h100v-24" />
      <path d="M50 132h100M76 109l74-33" opacity=".55" />
      <circle cx="110" cy="96" r="2" /><circle cx="128" cy="90" r="2" /><circle cx="96" cy="104" r="2" />
    </>
  ),
  bar: (
    <>
      <path d="M52 96l64-18 34 14-64 20z" />
      <path d="M52 96v22l34 14 64-20V92" />
      <path d="M86 112v20" />
      <path d="M70 92l40-11M80 100l40-11" opacity=".55" />
    </>
  ),
  shell: (
    <>
      <path d="M100 60c30 0 54 22 54 50 0 14-10 22-24 26-10 3-20 4-30 4s-20-1-30-4c-14-4-24-12-24-26 0-28 24-50 54-50z" />
      <path d="M100 140V62M100 140L72 70M100 140l28-70M100 140L56 88M100 140l44-52" opacity=".6" />
    </>
  ),
  teacup: (
    <>
      <ellipse cx="100" cy="146" rx="58" ry="10" />
      <path d="M56 108h88c0 22-20 36-44 36s-44-14-44-36z" />
      <path d="M144 112c10 0 14 4 14 10s-6 10-16 10" />
      <ellipse cx="100" cy="108" rx="44" ry="6" />
      <path d="M96 70c10-10 24-8 28 2-10 8-22 8-28-2z" />
      <path className="steam" d="M84 94c-4-6 4-10 0-16" />
    </>
  ),
};

export const toneClass: Record<Tone, string> = {
  cream: 'tone-cream',
  warm: 'tone-warm',
  stone: 'tone-stone',
  sage: 'tone-sage',
};

type View = 'whole' | 'detail' | 'pair' | 'companion';

export function ArtDrawing({ art, view = 'whole' }: { art: ArtKind; view?: View }) {
  return (
    <svg className={`art-svg art-${view}`} viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse className="art-shadow" cx="100" cy="166" rx="54" ry="6" stroke="none" />
      {drawings[art]}
    </svg>
  );
}

type ProductArtProps = {
  product: Product;
  view?: View;
  sizes?: string;
  priority?: boolean;
  className?: string;
};

/** Product visual: real photography when supplied, otherwise the tonal drawing. */
export function ProductArt({ product, view = 'whole', sizes = '(max-width: 760px) 100vw, 33vw', priority, className = '' }: ProductArtProps) {
  if (product.image) {
    return (
      <div className={`product-art has-photo ${className}`}>
        <Image src={product.image.src} alt={product.image.alt} fill sizes={sizes} priority={priority} className="product-photo" />
      </div>
    );
  }
  return (
    <div className={`product-art ${toneClass[product.tone]} ${className}`} role="img" aria-label={product.name}>
      <ArtDrawing art={product.art} view={view} />
      {view === 'pair' && <ArtDrawing art={product.category === 'coffee' || product.category === 'drinks' ? 'croissant' : 'cup'} view="companion" />}
    </div>
  );
}
