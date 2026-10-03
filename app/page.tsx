import type { Metadata } from 'next';
import { Hero } from '@/components/home/hero';
import { Evening, ExploreIndex, Signatures, TextureSlit, TheHouse, ThisWeek, VisitBlock } from '@/components/home/sections';
import { site } from '@/data/site';

export const metadata: Metadata = {
  title: { absolute: `${site.name} · ${site.tagline}` },
  alternates: { canonical: '/' },
};

export default function HomePage() {
  return (
    <main>
      <Hero />
      <Signatures />
      <TextureSlit />
      <TheHouse />
      <ExploreIndex />
      <ThisWeek />
      <Evening />
      <VisitBlock />
    </main>
  );
}
