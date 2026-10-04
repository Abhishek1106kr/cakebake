'use client';

import dynamic from 'next/dynamic';
import { StoryCraft, StoryOpening, StoryPeople, StoryToday, StoryYears } from './chapters';

// The heaviest compositions load as their own chunks; they sit well below the opening.
const MemoryWall = dynamic(() => import('./memory-wall').then((m) => m.MemoryWall));
const CustomerLove = dynamic(() => import('./customer-love').then((m) => m.CustomerLove));
const StoryFinale = dynamic(() => import('./finale').then((m) => m.StoryFinale));

/**
 * Our Story, as a film in chapters:
 * 01 opening · 02 8+ years · 03 craft · 04 people · 05 memory wall ·
 * 06 the bakery today · 07 customer love · 08 final statement · 09 CTA → footer.
 * Peaks: opening, the numeral, the wall, the craft film, customer love, the wordmark.
 */
export function StoryPage() {
  return (
    <main className="story-page">
      <StoryOpening />
      <StoryYears />
      <StoryCraft />
      <StoryPeople />
      <MemoryWall />
      <StoryToday />
      <CustomerLove />
      <StoryFinale />
    </main>
  );
}
