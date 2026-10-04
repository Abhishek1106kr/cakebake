import type { Metadata } from 'next';
import { StoryPage } from '@/components/story/story-page';

export const metadata: Metadata = {
  title: 'Our story · Tresor Bakery',
  description: 'Eight years of early mornings, cakes finished by hand, and the birthdays, anniversaries and small moments they were made for. The Tresor story.',
  openGraph: {
    title: 'Our story · Tresor Bakery',
    description: 'Baked with time. Shared with people. 8+ years of baking at Tresor.',
    type: 'article',
  },
};

export default function AboutPage() {
  return <StoryPage />;
}
