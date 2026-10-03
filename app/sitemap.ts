import type { MetadataRoute } from 'next';
import { products } from '@/data/products';
import { site } from '@/data/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['', '/menu', '/about', '/contact'].map((path) => ({ url: `${site.url}${path}`, changeFrequency: 'weekly' as const, priority: path === '' ? 1 : 0.8 }));
  const items = products.map((product) => ({ url: `${site.url}/product/${product.slug}`, changeFrequency: 'weekly' as const, priority: 0.6 }));
  return [...pages, ...items];
}
