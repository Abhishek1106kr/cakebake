// Our Story content. Copy, structure and media roles live here as data so the
// story can be edited without touching layout code. Media are referenced by
// manifest id (see lib/story-media.ts).
//
// Facts used: Tresor is a bakery with 8+ years of baking (from the owner).
// No dates, founders or events are invented. Lines about mornings and finishing
// by hand describe the craft, not specific history.

export const STORY_YEARS = '8+';

export const opening = {
  wordmark: 'Tresor',
  lines: ['Baked with time.', 'Shared with people.'],
  years: `${STORY_YEARS} years of baking`,
  film: 'story.video.oven-rise',
};

export const years = {
  numeral: STORY_YEARS,
  label: ['Years', 'of baking'],
  maskImage: 'story.cake.drip-tiered',
  body: 'Eight years of early mornings, butter on the counter and ovens warm before sunrise. Cakes made for ordinary days, and for the ones people never forget.',
  orbit: [
    { asset: 'story.celebration.bento-birthday', caption: 'Baked' },
    { asset: 'story.cake.box-strawberry', caption: 'Boxed' },
  ],
};

export type CraftStep = { id: string; label: string; line: string; media: string };
export const craft: { eyebrow: string; steps: CraftStep[] } = {
  eyebrow: 'The craft',
  steps: [
    { id: 'ingredient', label: 'Ingredient', line: 'Every cake starts with flour, butter and patience.', media: 'story.video.flour-sift' },
    { id: 'process', label: 'Process', line: 'Every morning starts before the doors open.', media: 'story.video.oven-brownie' },
    { id: 'finish', label: 'Finish', line: 'Every cake is finished by hand.', media: 'story.cake.drip-tiered' },
    { id: 'serve', label: 'Serve', line: 'Every celebration deserves something sweet.', media: 'story.celebration.sparkler' },
  ],
};

export const people = {
  eyebrow: 'The people',
  title: 'Baked for other people’s moments.',
  body: 'Birthdays and anniversaries, a Tuesday coffee, a box carried carefully across the city. Most of what leaves the counter is for someone else.',
  media: 'story.celebration.candles-wish',
};

/**
 * Memory wall composition. Positions are percentages of the wall (desktop);
 * `motion` picks a distinct reveal per piece so nothing animates the same way.
 */
export type WallItem =
  | { kind: 'media'; id: string; asset: string; x: number; y: number; w: number; ratio: string; rotate?: number; depth?: number; motion: 'rise' | 'slide' | 'scale' | 'clip' | 'still'; caption?: string; focus?: string }
  | { kind: 'text'; id: string; text: string; x: number; y: number; size: 'xl' | 'md' | 'meta'; depth?: number; vertical?: boolean };

export const memoryWall: { eyebrow: string; title: string; meta: string; items: WallItem[] } = {
  eyebrow: 'Tresor archive',
  title: 'Made over time.',
  meta: 'Baked / Shared / Remembered',
  items: [
    { kind: 'media', id: 'w-box', asset: 'story.cake.box-strawberry', x: 2, y: 6, w: 34, ratio: '4 / 5', depth: 40, motion: 'rise', caption: 'Boxed for the drive home' },
    { kind: 'text', id: 't-baked', text: 'Baked.', x: 27, y: 2, size: 'xl', depth: -30 },
    { kind: 'media', id: 'w-gold', asset: 'story.celebration.gold-candles', x: 44, y: 14, w: 22, ratio: '3 / 4', rotate: -1.5, depth: -60, motion: 'slide' },
    { kind: 'media', id: 'w-oven', asset: 'story.video.oven-brownie', x: 72, y: 4, w: 18, ratio: '9 / 14', depth: 80, motion: 'clip', caption: 'Before opening' },
    { kind: 'text', id: 't-shared', text: 'Shared.', x: 56, y: 50, size: 'xl', depth: 30 },
    { kind: 'media', id: 'w-drip', asset: 'story.cake.drip-tiered', x: 30, y: 56, w: 20, ratio: '1 / 1', depth: 50, motion: 'scale', focus: '50% 30%' },
    { kind: 'media', id: 'w-bento', asset: 'story.celebration.bento-birthday', x: 76, y: 52, w: 20, ratio: '3 / 4', rotate: 2, depth: -40, motion: 'rise' },
    { kind: 'text', id: 't-remembered', text: 'Remembered.', x: 6, y: 86, size: 'xl', depth: -20 },
    { kind: 'text', id: 't-meta', text: 'Tresor archive · no. 01–05', x: 92, y: 30, size: 'meta', vertical: true },
  ],
};

export const today = {
  eyebrow: 'The bakery today',
  title: 'Same early start. Still finished by hand.',
  body: 'The counter still changes through the day: cakes finished in the morning, celebration orders boxed by evening.',
  film: 'story.video.counter-cakes',
};

export type Review = {
  id: string;
  quote: string;
  author: string;
  moment: string;
  product: string | null;
  rating: number | null;
  image: string | null;
  date: string | null;
  featured: boolean;
  /** Placeholder words for layout. Never shown in production builds. Replace with real reviews. */
  mock: boolean;
};

export const reviews: Review[] = [
  { id: 'review-001', quote: 'The cake was gone in twelve minutes.', author: 'Customer', moment: 'Birthday', product: null, rating: null, image: null, date: null, featured: true, mock: true },
  { id: 'review-002', quote: 'It made our anniversary.', author: 'Customer', moment: 'Anniversary', product: 'Rose Chocolate Truffle', rating: null, image: null, date: null, featured: true, mock: true },
  { id: 'review-003', quote: 'Everyone asked where we ordered it from.', author: 'Customer', moment: 'Family lunch', product: null, rating: null, image: null, date: null, featured: true, mock: true },
  { id: 'review-004', quote: 'The pistachio didn’t last long.', author: 'Customer', moment: 'Coffee break', product: 'Pistachio', rating: null, image: null, date: null, featured: false, mock: true },
  { id: 'review-005', quote: 'Bought it for a colleague. Kept one slice.', author: 'Customer', moment: 'Gift', product: null, rating: null, image: null, date: null, featured: false, mock: true },
];

/**
 * Reviews safe to show: real ones always; placeholders only in development or in the labelled
 * client preview (NEXT_PUBLIC_LOCAL_MEDIA=1), where the page says they are sample words.
 */
export function visibleReviews(env = process.env.NODE_ENV, preview = process.env.NEXT_PUBLIC_LOCAL_MEDIA === '1'): Review[] {
  return reviews.filter((r) => !r.mock || env === 'development' || preview);
}

export const love = {
  eyebrow: 'Customer love',
  title: 'Made for moments.',
  sub: 'People rarely remember the cake. They remember the day it was for.',
  /** The wall interleaves these photos with whichever reviews are visible. */
  photos: [
    { asset: 'story.celebration.heart-cake', moment: 'Anniversary' },
    { asset: 'story.celebration.sparkler', moment: 'Birthday' },
    { asset: 'story.celebration.birthday-to-me', moment: 'Just because' },
    { asset: 'story.celebration.bento-birthday', moment: 'Office birthday' },
    { asset: 'story.celebration.gold-candles', moment: 'Late evening' },
  ],
};

export const finale = {
  lines: [`${STORY_YEARS} years.`, 'Countless cakes.', 'Even more memories.'],
  wordmark: 'Tresor',
  cta: { title: 'Ready for something sweet?', primary: { label: 'Explore the menu', href: '/shop' }, secondary: { label: 'Order a cake', href: '/shop?q=cake' } },
};

/**
 * 10 · The people behind the cake: the final chapter, just above the footer.
 * Person → process → product, twice, then one strong portrait. No names or roles
 * are given: none were supplied, and the photographs are reference material.
 * Desktop placement is a 12-column grid (col / row / offsets); mobile follows the
 * array order on a 6-column grid with its own columns.
 */
export type TeamTile = {
  id: string;
  asset: string;
  ratio: string;
  col: string;
  row?: string;
  mt?: string;
  mr?: string;
  mcol: string;
  rotate?: number;
  depth?: number;
  z?: number;
  reveal: 'rise' | 'slide' | 'scale' | 'clip' | 'wipe' | 'still';
  caption?: string;
  focus?: string;
};

export const team = {
  eyebrow: 'The people behind the cake',
  headline: ['The people', 'behind', 'the cake.'],
  support: 'Made by people who care about every layer.',
  opening: [
    { id: 'tm-loaves', asset: 'story.team.loaves', ratio: '3 / 4', col: '7 / 12', row: '1 / 3', mcol: '1 / 6', depth: 40, reveal: 'clip' },
    { id: 'tm-layering', asset: 'story.team.layering', ratio: '4 / 5', col: '1 / 5', row: '2', mt: '6vh', mcol: '3 / 7', depth: 20, reveal: 'wipe', caption: 'Every layer, by hand' },
    { id: 'tm-sift', asset: 'story.video.flour-sift', ratio: '9 / 14', col: '5 / 7', row: '2', mt: '22vh', mr: '-3vw', mcol: '1 / 4', depth: -60, z: 3, reveal: 'scale' },
  ] as TeamTile[],
  interlude: ['The hands.', 'The heat.', 'The wait.'],
  middle: [
    { id: 'tm-opera', asset: 'story.team.opera-tray', ratio: '4 / 5', col: '2 / 6', row: '1', mcol: '2 / 7', depth: 30, reveal: 'rise' },
    { id: 'tm-huddle', asset: 'story.team.huddle', ratio: '4 / 3', col: '7 / 13', row: '1', mt: '14vh', mcol: '1 / 7', depth: -40, reveal: 'clip', caption: 'All hands' },
    { id: 'tm-duo', asset: 'story.team.rolls-duo', ratio: '4 / 5', col: '6 / 9', row: '2', mt: '-12vh', mcol: '3 / 6', rotate: 1.5, depth: 70, z: 3, reveal: 'slide' },
  ] as TeamTile[],
  years: ['8+ years.', 'Still baking by hand.'],
  // Square on desktop so face and cake fit one screen; portrait on phones (see CSS).
  final: { id: 'tm-final', asset: 'story.team.strawberry-cake', ratio: '1 / 1', col: '4 / 10', mcol: '1 / 7', reveal: 'scale', focus: '50% 30%' } as TeamTile,
  closing: 'The people make the place.',
  signature: 'Tresor',
};
