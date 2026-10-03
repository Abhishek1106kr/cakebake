import type { Metadata } from 'next';
import { MenuView } from '@/components/search/menu-view';
import { categories, type CategoryId } from '@/data/products';

export const metadata: Metadata = {
  title: 'Menu',
  description: 'Coffee, pastry, desserts and brunch from Tresor, Whitefield. Tell us your mood and we will pick for it.',
  alternates: { canonical: '/menu' },
};

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { q = '', category } = await searchParams;
  const initialCategory = categories.some((c) => c.id === category) ? (category as CategoryId) : 'all';
  return <MenuView initialQuery={q.slice(0, 80)} initialCategory={initialCategory} />;
}
