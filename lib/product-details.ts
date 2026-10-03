// Draft product details for the "Inside" module and detail panels.
// Sample copy: confirm every line with the bakery before launch.

export type Layer = { label: string; detail: string };

export const anatomy: Record<string, Layer[]> = {
  'almond-croissant': [
    { label: 'Toasted flaked almonds', detail: 'Roasted the same morning' },
    { label: 'Almond frangipane', detail: 'Baked inside and on top' },
    { label: '27 laminated layers', detail: 'Folded over three days' },
    { label: 'Cultured butter', detail: 'For depth, not just richness' },
  ],
  'pistachio-tart': [
    { label: 'Chopped pistachio', detail: 'Lightly salted' },
    { label: 'Vanilla crème', detail: 'Set overnight' },
    { label: 'Pistachio praline', detail: 'A thin, intense layer' },
    { label: 'Crisp pastry shell', detail: 'Rolled to 2 mm' },
  ],
  'chocolate-tart': [
    { label: 'Sea salt flakes', detail: 'Added last' },
    { label: 'Dark chocolate ganache', detail: 'Poured, never piped' },
    { label: 'Hazelnut praline', detail: 'Caramelised, then ground' },
    { label: 'Cocoa pastry', detail: 'Short and bitter-sweet' },
  ],
  'cinnamon-roll': [
    { label: 'Brown-butter glaze', detail: 'Brushed on while warm' },
    { label: 'Cinnamon and brown sugar', detail: 'Rolled through every turn' },
    { label: 'Soft enriched dough', detail: 'Proved slowly overnight' },
  ],
};

export function storageFor(categories: string[]): string {
  if (categories.includes('coffee') || categories.includes('drinks')) return 'Made to order. Best enjoyed straight away.';
  if (categories.includes('dessert')) return 'Keep refrigerated and enjoy within 24 hours. Bring to room temperature for 15 minutes first.';
  if (categories.includes('brunch')) return 'Made to order. Best eaten fresh.';
  return 'Best the day it is baked. Revive for 3 minutes in a hot oven.';
}
