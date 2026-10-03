// Café details. Values marked "from Figma V2" come from the V2 prototype.
// Anything left undefined is shown as "to be announced" instead of being invented.

export const site = {
  name: 'Tresor',
  tagline: 'Good coffee. Slow moments.',
  description: 'A contemporary café and bakery in Whitefield, Bengaluru, for mornings that become afternoons.',
  city: 'Bengaluru',
  neighbourhood: 'Whitefield', // from Figma V2
  addressLines: ['Whitefield', 'Bengaluru'] as string[], // street address not yet supplied
  hours: { open: '08:00', close: '23:00', days: 'Monday to Sunday' }, // from Figma V2
  phone: undefined as string | undefined,
  email: undefined as string | undefined,
  // External destinations are configured per environment and never hard-coded.
  links: {
    zomato: process.env.NEXT_PUBLIC_ZOMATO_URL || undefined,
    swiggy: process.env.NEXT_PUBLIC_SWIGGY_URL || undefined,
    maps: process.env.NEXT_PUBLIC_MAPS_URL || undefined,
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL || undefined,
  },
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
};

// Delivery zone around Whitefield. Confirm the final list with the café before launch.
export const serviceablePins: Record<string, string> = {
  '560066': 'Whitefield',
  '560067': 'Kadugodi',
  '560048': 'Mahadevapura',
  '560037': 'Marathahalli',
  '560087': 'Varthur',
  '560036': 'K R Puram',
  '560049': 'Virgonagar',
  '560103': 'Bellandur',
  '560016': 'Ramamurthy Nagar',
  '560093': 'C V Raman Nagar',
};
