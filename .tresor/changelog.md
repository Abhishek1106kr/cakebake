# Tresor Changelog

## Unreleased

### Changed (2026-10-04, f59f041)
- Menu page: editorial mood-led header, underlined search, sticky text-tab filter bar with live counts and minimal sort. Prototype "mock catalogue" copy removed.
- Homepage cake reveal rebuilt full-bleed with a push-in; title on a soft scrim beside the cake.

### Fixed (2026-10-04)
- Scroll-driven opacity faded text back in past the end of its range (Framer's ScrollTimeline acceleration ignored the clamp). ScrollScene now passes a function-derived progress value.

### Added
- **Frontend business logic** (browser-only, synced across tabs):
  - order model and status flow
  - single pricing source
  - checkout validation
  - ingredient inventory with recipes and stock consumption
  - demo seed orders
  - CSV export
- **Admin wired to real data:**
  - overview stats
  - orders table (filters, search, advance, cancel)
  - kitchen board (late flags)
  - inventory movements
  - product availability
- **Storefront:**
  - sold-out states and stock-capped quantities
  - order confirmation and tracking looked up by order ID, with an order lookup form
  - "Your orders" on the account page
- Admin styles (none existed before).
- "Customize cake" navbar link with a coming-soon placeholder page (`/customize-cake`).
- v3 variation on branch `v3-variation` (real orders and tracking, Framer Motion system).

### Changed
- v2 storefront imported unchanged as the final base (commit 99aae89).
- Colour palette switched to the CLAUDE.md sage palette, made richer with its own tones.
- Copy now says "bakery" instead of "café".
- `next.config.ts`: `typedRoutes` moved out of `experimental`; `outputFileTracingRoot` set.

### Fixed
- Large drinks were shown at +₹40 but charged at the regular price.
- `next build` failed on the `typedRoutes` error in `app/admin/layout.tsx`.
- `next build` failed because `useSearchParams` had no Suspense boundary in `/order-confirmed`, `/track-order` and `/shop`.

### Tested
- `npx tsc --noEmit`: 0 errors.
- `npx next build`: 17 pages.
- 10 business-logic assertions passed. The test script ran from a scratch folder and is not committed.
- All 15 routes return 200 in dev.
- The UI has not yet been reviewed visually in a browser.

### Known Issues
- Product imagery is still gradient placeholders.
- `hello@tresor.cafe` still uses a café domain.
- Inventory levels, recipes and fees are sample values.
