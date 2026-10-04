// Cake image registry: one entry per cake per role. Components ask for
// `cakeImage(slug, role)` and never build paths themselves.
//
// Files live in public/mock-assets/cakes/<slug>/<role>.webp. That folder is
// git-ignored local mock imagery until Tresor's own cake photoshoot exists; to go
// live, drop the real photos into public/images/cakes/<slug>/ and change BASE.
// Missing files fall back to each asset's tone gradient (see <Media>).

import type { MediaAsset } from './media';

export type CakeRole = 'hero' | 'product' | 'macro' | 'mobile';

export type CakeImage = MediaAsset & {
  category: 'cake';
  product: string;
  role: CakeRole;
  desktop: string;
  aspectRatio: '16:9' | '4:5' | '1:1' | '9:16';
};

const BASE = '/mock-assets/cakes';

const ROLE_META: Record<CakeRole, { aspectRatio: CakeImage['aspectRatio']; aspect: string; priority: MediaAsset['priority'] }> = {
  hero: { aspectRatio: '16:9', aspect: '16 / 9', priority: 'high' },
  product: { aspectRatio: '4:5', aspect: '4 / 5', priority: 'normal' },
  macro: { aspectRatio: '1:1', aspect: '1 / 1', priority: 'lazy' },
  mobile: { aspectRatio: '9:16', aspect: '9 / 16', priority: 'normal' },
};

const CAKES: Record<string, { name: string; tone: [string, string] }> = {
  'rose-truffle': { name: 'Rose Chocolate Truffle', tone: ['#F2E4E1', '#8E2F2B'] },
  'chocolate-truffle': { name: 'Chocolate Truffle', tone: ['#EFE8DD', '#4E3426'] },
  pistachio: { name: 'Pistachio', tone: ['#EEF0E2', '#6B7D3E'] },
  'black-forest': { name: 'Black Forest Cherry', tone: ['#F2E4E1', '#7A2A2A'] },
  'hazelnut-crunch': { name: 'Hazelnut Crunch', tone: ['#EFE8DD', '#7A5A3E'] },
  'strawberry-cream': { name: 'Strawberry Cream', tone: ['#F4ECEE', '#C98A99'] },
  'vanilla-berry': { name: 'Vanilla Berry', tone: ['#EEEAF0', '#5E3A63'] },
  'mango-passion': { name: 'Mango Passion', tone: ['#F6EEDC', '#D08A1E'] },
  'salted-caramel': { name: 'Salted Caramel', tone: ['#F3EBE0', '#A86A3A'] },
};

const ALT: Record<CakeRole, (name: string) => string> = {
  hero: (n) => `${n}, photographed on a pale stone plinth`,
  product: (n) => `${n}, whole cake`,
  macro: (n) => `Close-up of the finish on the ${n}`,
  mobile: (n) => `${n}, portrait crop`,
};

export function cakeImage(slug: string, role: CakeRole): CakeImage {
  const cake = CAKES[slug] ?? { name: slug, tone: ['#DDE3E1', '#4A5957'] as [string, string] };
  const meta = ROLE_META[role];
  const desktop = `${BASE}/${slug}/${role}.webp`;
  return {
    id: `cake.${slug}.${role}`,
    type: 'image',
    category: 'cake',
    product: slug,
    role,
    desktop,
    src: desktop,
    mobile: role === 'hero' ? `${BASE}/${slug}/mobile.webp` : undefined,
    alt: ALT[role](cake.name),
    aspect: meta.aspect,
    aspectRatio: meta.aspectRatio,
    priority: meta.priority,
    motionRole: role === 'hero' ? 'hero' : role === 'macro' ? 'texture' : 'product',
    tone: cake.tone,
  };
}

/** Scene imagery that isn't tied to one cake: the cut/serving shot and the lifestyle shot. */
export const cakeScenes = {
  cut: { id: 'cake.scene.cut', type: 'image', src: `${BASE}/cut.webp`, alt: 'A slice of chocolate cake being served, knife beside it', aspect: '1 / 1', priority: 'lazy', motionRole: 'scene', tone: ['#3A2620', '#1C1412'] },
  lifestyle: { id: 'cake.scene.lifestyle', type: 'image', src: `${BASE}/lifestyle.webp`, alt: 'A cake on a stand on the bakery table, coffee beans beside it', aspect: '1 / 1', priority: 'lazy', motionRole: 'editorial', tone: ['#EFE8DD', '#7A5A3E'] },
} satisfies Record<string, MediaAsset>;

/** Full manifest, e.g. for an asset audit or preloading. */
export const cakeManifest: CakeImage[] = Object.keys(CAKES).flatMap((slug) => (['hero', 'product', 'macro', 'mobile'] as CakeRole[]).map((role) => cakeImage(slug, role)));
