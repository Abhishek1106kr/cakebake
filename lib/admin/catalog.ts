// Product management. The code menu (lib/data baseProducts) is the starting point;
// the bakery's changes are stored as full product records keyed by id, and the
// storefront menu is derived from them. Products are never deleted: archive keeps
// them for order history, which carries its own snapshot anyway.

import { baseProducts, type Product } from '@/lib/data';
import { recipes } from '@/lib/inventory';
import { isRecord } from '@/lib/safe-storage';

export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type StockPolicy = 'ingredients' | 'made-to-order' | 'unlimited';
export const MEDIA_ROLES = ['hero', 'product', 'macro', 'mobile', 'lifestyle', 'video', 'poster'] as const;
export type MediaRole = (typeof MEDIA_ROLES)[number];

export type ProductRecord = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  price: number;
  compareAtPrice: number | null;
  /** Manual "sold out for now". Ingredient stock is checked separately. */
  available: boolean;
  status: ProductStatus;
  stockPolicy: StockPolicy;
  prepMinutes: number;
  ingredients: string[];
  allergens: string[];
  tags: string[];
  dietary: string[];
  flavorProfile: string[];
  texture: string;
  sweetness: number | null;
  occasion: string[];
  /** Media asset ids by role (see the media library). */
  media: Partial<Record<MediaRole, string>>;
  gallery: string[];
  seoTitle: string;
  seoDescription: string;
  image: string;
  searchTerms: string[];
  featured: boolean;
  createdInAdmin: boolean;
  updatedAt: string | null;
};

export const CATEGORIES = ['Pastry', 'Bread', 'Cake', 'Dessert', 'Coffee', 'Drinks', 'Savoury'];

const ALLERGEN_HINTS: [RegExp, string][] = [[/nut|almond|pistachio|hazelnut|praline/i, 'nuts'], [/flour|sponge|pastry|croissant|bread|sourdough|brownie|tart|sablé|cookie/i, 'gluten'], [/milk|cream|butter|cheese|yogurt|ricotta|latte|parmesan|chocolate/i, 'dairy'], [/egg/i, 'egg']];

/** Allergens suggested from the product's words. A starting point; the bakery confirms them. */
export function suggestAllergens(p: Pick<Product, 'name' | 'description'> & { ingredients?: string[] }): string[] {
  const text = `${p.name} ${p.description} ${(p.ingredients ?? []).join(' ')}`;
  return [...new Set(ALLERGEN_HINTS.filter(([re]) => re.test(text)).map(([, a]) => a))];
}

export function mediaFor(p: Pick<Product, 'image' | 'cake'>): Partial<Record<MediaRole, string>> {
  if (p.cake) return { hero: `cake.${p.cake.slug}.hero`, product: `cake.${p.cake.slug}.product`, macro: `cake.${p.cake.slug}.macro`, mobile: `cake.${p.cake.slug}.mobile` };
  return p.image ? { product: `product-${p.image}` } : {};
}

export function recordFromProduct(p: Product): ProductRecord {
  return {
    id: p.id, slug: p.id, name: p.name, description: p.description, category: p.category, price: p.price, compareAtPrice: null,
    available: p.available !== false, status: 'ACTIVE',
    stockPolicy: recipes[p.id] ? 'ingredients' : p.cake ? 'made-to-order' : 'unlimited',
    prepMinutes: p.prepMinutes ?? 5, ingredients: p.cake?.ingredients ?? [], allergens: suggestAllergens({ ...p, ingredients: p.cake?.ingredients }),
    tags: p.tag ? [p.tag] : [], dietary: p.dietary ?? [], flavorProfile: p.cake?.flavorProfile ?? [], texture: p.cake?.texture ?? '',
    sweetness: p.cake?.sweetness ?? null, occasion: p.cake?.occasion ?? [], media: mediaFor(p), gallery: [],
    seoTitle: `${p.name} · Tresor Bakery`, seoDescription: p.description, image: p.image, searchTerms: p.searchTerms, featured: Boolean(p.featured),
    createdInAdmin: false, updatedAt: null,
  };
}

/** Stored records (admin changes and new products) over the code menu, code order first. */
export function buildCatalog(stored: Record<string, ProductRecord> | null | undefined, base: Product[] = baseProducts): ProductRecord[] {
  // Keep only well-formed records: stored data may come from an older version.
  const saved = Object.fromEntries(Object.entries(isRecord(stored) ? stored : {}).filter(([, r]) => isRecord(r))) as Record<string, ProductRecord>;
  const fromBase = base.map((p) => (saved[p.id] ? { ...recordFromProduct(p), ...saved[p.id] } : recordFromProduct(p)));
  const created = Object.values(saved).filter((r) => r.createdInAdmin && !base.some((p) => p.id === r.id)).sort((a, b) => (a.updatedAt ?? '').localeCompare(b.updatedAt ?? ''));
  return [...fromBase, ...created];
}

/**
 * The storefront menu: active products only (disabled and archived ones leave the shop),
 * with the bakery's price, copy and sold-out flag. Base fields the admin doesn't manage
 * (cake campaign details, imagery keys) carry over.
 */
export function storefrontProducts(catalog: ProductRecord[], base: Product[] = baseProducts): Product[] {
  return catalog.filter((r) => r.status === 'ACTIVE').map((r) => {
    const original = base.find((p) => p.id === r.id);
    return {
      ...(original ?? {}),
      id: r.id, name: r.name, category: r.category, description: r.description, price: r.price, image: r.image || original?.image || '',
      tag: r.tags[0] ?? original?.tag, searchTerms: r.searchTerms.length ? r.searchTerms : [r.name.toLowerCase(), r.category.toLowerCase()],
      dietary: r.dietary, prepMinutes: r.prepMinutes, featured: r.featured, available: r.available,
      ...(original?.cake ? { cake: { ...original.cake, flavorProfile: r.flavorProfile, texture: r.texture, sweetness: (r.sweetness ?? original.cake.sweetness) as 1 | 2 | 3 | 4 | 5, occasion: r.occasion, ingredients: r.ingredients } } : {}),
    };
  });
}

export const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 60);

export type Validation = { ok: true } | { ok: false; errors: Record<string, string> };

export function validateProduct(r: ProductRecord, all: ProductRecord[]): Validation {
  const errors: Record<string, string> = {};
  if (r.name.trim().length < 2) errors.name = 'Give the product a name.';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.slug)) errors.slug = 'Use lowercase letters, numbers and hyphens.';
  else if (all.some((o) => o.id !== r.id && o.slug === r.slug)) errors.slug = 'Another product already uses this slug.';
  if (!Number.isInteger(r.price) || r.price <= 0) errors.price = 'Enter a whole rupee price above zero.';
  if (r.price > 100000) errors.price = 'That price looks too high.';
  if (r.compareAtPrice !== null && (!Number.isInteger(r.compareAtPrice) || r.compareAtPrice <= r.price)) errors.compareAtPrice = 'A compare-at price must be higher than the price.';
  if (!CATEGORIES.includes(r.category)) errors.category = 'Choose a category.';
  if (!Number.isInteger(r.prepMinutes) || r.prepMinutes < 0 || r.prepMinutes > 72 * 60) errors.prepMinutes = 'Prep time is in whole minutes (up to 72 hours).';
  if (r.description.trim().length < 10) errors.description = 'Add a sentence describing it.';
  if (r.seoTitle.length > 70) errors.seoTitle = 'Keep the SEO title under 70 characters.';
  if (r.seoDescription.length > 160) errors.seoDescription = 'Keep the SEO description under 160 characters.';
  if (r.sweetness !== null && (r.sweetness < 1 || r.sweetness > 5)) errors.sweetness = 'Sweetness is 1 to 5.';
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true };
}

export function newProduct(all: ProductRecord[], now = new Date()): ProductRecord {
  let n = 1;
  while (all.some((r) => r.id === `new-product-${n}`)) n += 1;
  return {
    ...recordFromProduct({ id: `new-product-${n}`, name: '', category: 'Pastry', description: '', price: 0, image: '', searchTerms: [] }),
    slug: `new-product-${n}`, seoTitle: '', seoDescription: '', createdInAdmin: true, status: 'INACTIVE', updatedAt: now.toISOString(),
  };
}

export function duplicateProduct(r: ProductRecord, all: ProductRecord[], now = new Date()): ProductRecord {
  let n = 2;
  while (all.some((o) => o.slug === `${r.slug}-${n}`)) n += 1;
  return { ...r, id: `${r.slug}-${n}`, slug: `${r.slug}-${n}`, name: `${r.name} (copy)`, status: 'INACTIVE', createdInAdmin: true, updatedAt: now.toISOString() };
}

/** How many orders reference a product (why archived products are kept). */
export function ordersReferencing(productId: string, orders: { items: { product: { id: string } }[] }[]): number {
  return orders.filter((o) => o.items.some((l) => l.product.id === productId)).length;
}

export function productsCsvRows(list: ProductRecord[]): (string | number | null)[][] {
  return [
    ['Id', 'Name', 'Category', 'Price', 'Compare at', 'Status', 'Available', 'Stock policy', 'Prep minutes', 'Allergens', 'Tags'],
    ...list.map((r) => [r.id, r.name, r.category, r.price, r.compareAtPrice, r.status, r.available ? 'yes' : 'no', r.stockPolicy, r.prepMinutes, r.allergens.join('; '), r.tags.join('; ')]),
  ];
}
