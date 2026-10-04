// Media library: every asset the site's registries know (scenes, product images,
// cake roles, Our Story), with provenance and where each is used. Paths stay in the
// registries (lib/media.ts, lib/cake-assets.ts, lib/story-media.ts); the admin keeps
// an overlay of decisions (archive, alt text, assignment, replacement) on top.

import { media, productMedia, type MediaAsset } from '@/lib/media';
import { cakeManifest, cakeScenes } from '@/lib/cake-assets';
import { storyAsset, storyAssetIds } from '@/lib/story-media';
import type { ProductRecord } from './catalog';
import type { Campaign, ContentSlot } from './marketing';

export type MediaType = 'image' | 'video' | 'poster';
export type MediaStatus = 'ACTIVE' | 'ARCHIVED';

export type LibraryAsset = {
  id: string;
  type: MediaType;
  role: string;
  productId: string | null;
  aspect: string;
  desktop: string;
  mobile: string | null;
  alt: string;
  source: string;
  provenance: string;
  /** Rights are unknown for every asset in the prototype; nothing here may be published. */
  licensed: boolean;
  codeUsage: string[];
};

export type MediaOverlay = { status?: MediaStatus; alt?: string; productId?: string | null; campaignId?: string | null; replacedBy?: string | null; note?: string };
export type MediaEntry = LibraryAsset & { status: MediaStatus; campaignId: string | null; replacedBy: string | null; note: string };

const MOCK_PROVENANCE = 'Reference image from the owner’s local mock folder. Rights unknown: local prototype only, never committed or deployed.';
const STORY_PROVENANCE = 'Supplied by the owner as downloads (rights unknown). Local prototype only, git-ignored, never deployed. Replace with licensed Tresor photography under the same id.';

const SCENE_USAGE: Record<string, string> = {
  heroFilm: 'Home · hero film', craftFlour: 'Home · craft scene', craftButter: 'Home · craft scene', craftTime: 'Home · craft scene',
  glaze: 'Home · texture band', story: 'Home · story', visit: 'Home · visit', brunch: 'Home · brunch',
};

export function registryAssets(): LibraryAsset[] {
  const out: LibraryAsset[] = [];
  for (const a of Object.values(media) as MediaAsset[]) {
    out.push({ id: a.id, type: a.type === 'video' ? 'video' : 'image', role: a.motionRole, productId: null, aspect: a.aspect, desktop: a.src, mobile: a.mobile ?? null, alt: a.alt, source: a.src, provenance: MOCK_PROVENANCE, licensed: false, codeUsage: [SCENE_USAGE[a.id] ?? 'Home'] });
  }
  for (const key of ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11', 'c12']) {
    const a = productMedia(key, `Product image ${key}`);
    out.push({ id: a.id, type: 'image', role: 'product', productId: null, aspect: a.aspect, desktop: a.src, mobile: null, alt: a.alt, source: a.src || 'none (tone gradient)', provenance: a.src ? MOCK_PROVENANCE : 'No image yet: the product shows its tone gradient.', licensed: false, codeUsage: ['Menu card and product page'] });
  }
  for (const a of cakeManifest) {
    out.push({ id: a.id, type: 'image', role: a.role, productId: null, aspect: a.aspect, desktop: a.desktop, mobile: a.mobile ?? null, alt: a.alt, source: a.desktop, provenance: MOCK_PROVENANCE, licensed: false, codeUsage: [a.role === 'hero' ? 'Cake page hero' : a.role === 'macro' ? 'Cake page detail' : 'Cakes collection and product page'] });
  }
  for (const a of Object.values(cakeScenes)) {
    out.push({ id: a.id, type: 'image', role: a.motionRole, productId: null, aspect: a.aspect, desktop: a.src, mobile: null, alt: a.alt, source: a.src, provenance: MOCK_PROVENANCE, licensed: false, codeUsage: ['Cakes page scene'] });
  }
  for (const id of storyAssetIds) {
    const a = storyAsset(id);
    out.push({ id: a.id, type: a.type, role: id.split('.')[1] ?? 'story', productId: null, aspect: a.aspect, desktop: a.src, mobile: a.mobile ?? null, alt: a.alt, source: a.src, provenance: STORY_PROVENANCE, licensed: false, codeUsage: ['Our Story'] });
    if (a.type === 'video' && a.poster) out.push({ id: `${a.id}.poster`, type: 'poster', role: 'poster', productId: null, aspect: a.aspect, desktop: a.poster, mobile: null, alt: `${a.alt} (poster frame)`, source: a.poster, provenance: STORY_PROVENANCE, licensed: false, codeUsage: ['Our Story (video poster)'] });
  }
  return out;
}

export function libraryEntries(assets: LibraryAsset[], overlay: Record<string, MediaOverlay>, catalog: ProductRecord[]): MediaEntry[] {
  return assets.map((a) => {
    const o = overlay[a.id] ?? {};
    const assignedTo = catalog.find((p) => Object.values(p.media).includes(a.id) || p.gallery.includes(a.id));
    return { ...a, alt: o.alt ?? a.alt, productId: o.productId !== undefined ? o.productId : assignedTo?.id ?? null, status: o.status ?? 'ACTIVE', campaignId: o.campaignId ?? null, replacedBy: o.replacedBy ?? null, note: o.note ?? '' };
  });
}

export type Usage = { where: string; active: boolean };

/** Everywhere an asset is referenced: code placements, products, campaigns, content slots. */
export function usageOf(entry: MediaEntry, catalog: ProductRecord[], campaigns: Campaign[], slots: ContentSlot[], now: Date): Usage[] {
  const out: Usage[] = entry.codeUsage.map((where) => ({ where: `${where} (code)`, active: true }));
  for (const p of catalog) {
    const roles = Object.entries(p.media).filter(([, id]) => id === entry.id).map(([role]) => role);
    if (roles.length || p.gallery.includes(entry.id)) out.push({ where: `Product · ${p.name} (${[...roles, ...(p.gallery.includes(entry.id) ? ['gallery'] : [])].join(', ')})`, active: p.status === 'ACTIVE' });
  }
  for (const c of campaigns) if (c.heroMediaId === entry.id) out.push({ where: `Campaign · ${c.name}`, active: !c.archived && Date.parse(c.end) > now.getTime() });
  for (const s of slots) if (s.mediaId === entry.id) out.push({ where: `Content · ${s.id}`, active: true });
  return out;
}

export const aspectLabel = (aspect: string) => {
  const [w, h] = aspect.split('/').map((x) => Number(x.trim()));
  if (!w || !h) return aspect;
  const r = w / h;
  return r > 1.6 ? 'wide' : r > 1.1 ? 'landscape' : r > 0.9 ? 'square' : r > 0.6 ? 'portrait' : 'tall';
};
