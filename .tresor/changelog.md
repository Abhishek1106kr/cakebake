# Tresor Changelog

## Unreleased

### Added
- **Research:** `REFERENCES.md` and `THIRD_PARTY_NOTICES.md` (study of five reference sites and a licence audit; no assets used).
- **Project setup:** Next.js 16.3 project with React 19.3, Framer Motion 14, TypeScript 7 and lucide-react.
- **Data:**
  - `data/products.ts`: 16 products. The first eight names, descriptions and prices come from Figma V2.
  - `data/site.ts`: Whitefield address, 08:00–23:00 hours, environment-driven external links.
  - `data/media.ts`: video slots.
- **Business logic (browser only):**
  - pricing
  - cart store with cross-tab sync
  - IST delivery slots
  - PIN serviceability
  - checkout validation
  - simulated payment service
  - orders and tracking schedule
  - deterministic mood search
- **Motion system:** shared timings, easing and variants in `lib/motion/`, plus reveal, text, image, stagger, magnetic, cart-count, animated-number and parallax primitives.
- **Site shell:**
  - brand loader
  - page veil
  - header (layout-animated nav underline, mobile sheet)
  - footer
  - fly-to-bag and toast feedback
  - Zomato/Swiggy redirect overlay
- **Pages:**
  - home (hero choreography, texture slit, hover-preview index, evening section)
  - menu (mood search with layout re-ranking)
  - product (gallery, "Inside" anatomy, disclosures, related, recently viewed)
  - cart
  - checkout (delivery/pickup, slots, payment states)
  - confirmation
  - tracking
  - about
  - contact
  - account
  - 404 and error pages
- **SEO:** per-page metadata, product JSON-LD, robots, sitemap, generated Open Graph image.
- **Project state:** `.tresor/` directory.

### Tested
- `next build` passed on a one-page smoke-test app before feature code existed.
- `npx tsc --noEmit`: 0 errors.
- `npx next build`: success, 28 pages generated.
- Not yet exercised in a browser.

### Known Issues
- No real photography or video; tonal drawings and fallbacks stand in.
- Menu stories, anatomy details, About copy and the delivery PIN list are drafts awaiting café confirmation.
