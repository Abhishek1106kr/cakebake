import { cakeImage } from './cake-assets';

// Single media registry (MOTION.md "Media"). Components ask for an asset by id;
// paths live only here. Until Tresor photography exists, sources point at the
// git-ignored local mock folder. If a file is missing (production, other
// machines), the <Media> component falls back to the asset's tone gradient.

export type MotionRole = 'hero' | 'scene' | 'product' | 'texture' | 'editorial';

export type MediaAsset = {
  id: string;
  type: 'image' | 'video';
  src: string;
  mobile?: string;
  poster?: string;
  alt: string;
  aspect: string; // CSS aspect-ratio
  priority: 'high' | 'normal' | 'lazy';
  motionRole: MotionRole;
  tone: [string, string]; // gradient fallback, from the palette
};

const MOCK = '/mock-assets';
const sage: [string, string] = ['#A9B7B6', '#2E3938'];
const cream: [string, string] = ['#F8F4EC', '#7E9291'];
const warm: [string, string] = ['#EFE8DD', '#4A5957'];

export const media = {
  heroFilm: { id: 'heroFilm', type: 'image', src: `${MOCK}/hero-film.jpg`, alt: 'Lacquered pastry shells, in macro', aspect: '1440 / 700', priority: 'high', motionRole: 'hero', tone: sage },
  craftFlour: { id: 'craftFlour', type: 'image', src: `${MOCK}/c1.jpg`, alt: 'Laminated croissants', aspect: '1 / 1', priority: 'normal', motionRole: 'scene', tone: warm },
  craftButter: { id: 'craftButter', type: 'image', src: `${MOCK}/craft-tart.jpg`, alt: 'A tart slice with a crisp, buttery base', aspect: '1440 / 700', priority: 'normal', motionRole: 'scene', tone: cream },
  craftTime: { id: 'craftTime', type: 'image', src: `${MOCK}/craft-fold.jpg`, alt: 'Chocolate cream folded through pastry', aspect: '1 / 1', priority: 'normal', motionRole: 'scene', tone: sage },
  glaze: { id: 'glaze', type: 'image', src: `${MOCK}/glaze.jpg`, alt: 'Glazed chocolate domes', aspect: '1440 / 700', priority: 'lazy', motionRole: 'texture', tone: ['#4A5957', '#202625'] },
  story: { id: 'story', type: 'image', src: `${MOCK}/story.jpg`, alt: 'A small baba with whipped cream', aspect: '426 / 616', priority: 'lazy', motionRole: 'editorial', tone: warm },
  visit: { id: 'visit', type: 'image', src: `${MOCK}/poster-2.jpg`, alt: 'Pastries on the counter', aspect: '1 / 1', priority: 'lazy', motionRole: 'editorial', tone: cream },
  brunch: { id: 'brunch', type: 'image', src: `${MOCK}/mood-brunch.jpg`, alt: 'Croissant halves and a berry danish', aspect: '604 / 274', priority: 'lazy', motionRole: 'editorial', tone: warm },
} satisfies Record<string, MediaAsset>;

/** Product imagery keyed by the product's image class (c1…c12). */
const productSources: Record<string, string> = {
  c1: `${MOCK}/c1.jpg`, c2: `${MOCK}/c2.jpg`, c5: `${MOCK}/c5.jpg`, c6: `${MOCK}/c6.jpg`, c7: `${MOCK}/c7.jpg`, c8: `${MOCK}/c8.jpg`, c11: `${MOCK}/c11.jpg`,
};

const productTones: Record<string, [string, string]> = {
  c1: ['#EFE8DD', '#657876'], c2: ['#C9D3D1', '#3E4C4A'], c3: ['#F6F8F7', '#7E9291'], c4: ['#A9B7B6', '#2E3938'],
  c5: ['#F8F4EC', '#657876'], c6: ['#DDE3E1', '#4A5957'], c7: ['#EFE8DD', '#4A5957'], c8: ['#E8EEEC', '#7E9291'],
  c9: ['#A9B7B6', '#3E4C4A'], c10: ['#F8F4EC', '#4A5957'], c11: ['#DDE3E1', '#3E4C4A'], c12: ['#C9D3D1', '#2E3938'],
};

export function productMedia(imageKey: string, name: string): MediaAsset {
  if (imageKey.startsWith('cake:')) return cakeImage(imageKey.slice(5), 'product');
  return {
    id: `product-${imageKey}`,
    type: 'image',
    src: productSources[imageKey] ?? '',
    alt: name,
    aspect: '4 / 5',
    priority: 'normal',
    motionRole: 'product',
    tone: productTones[imageKey] ?? sage,
  };
}
