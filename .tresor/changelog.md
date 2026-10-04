# Tresor Changelog

## Unreleased

### Added (2026-10-04, Our Story chapter 10)
- **"The people behind the cake":** an editorial collage of the team and cake-making photos, placed just above the footer. The rest of the page is unchanged.

### Added (2026-10-04, Our Story)
- **/about rebuilt as a cinematic editorial archive:**
  - opening film behind the TRESOR wordmark
  - the 8+ numeral with photography inside it
  - a scroll-driven craft essay and a people interlude
  - a hand-placed memory wall and the bakery today
  - candlelit Customer Love, the closing statement and a CTA
- **Homepage:** a compact Customer Love section closes it, directly above the footer.
- **Content:** `assets/manifest/images.json` and `videos.json` (roles, crops, alt text, license status), with `lib/story.ts` content and STORY.md.
- **Favicon** (`app/icon.svg`).

### Fixed
- Reduced-motion branches no longer cause hydration mismatches (`useReducedMotionSafe`).
- The header "Our story" link now goes to /about.

### Added (2026-10-04, phases 8-10)
- **Homepage counter:** ordered for the moment (time of day, season, stock, sales), with a reason on each item. Mood prompts change with the time and always return results.
- **Menu:** "This morning / This evening" for-you row while browsing.
- **Media:** a video plays only on good connections without reduced motion; otherwise a still image is shown.
- **Admin insights:** carry proposed actions. Restocks need Approve → Confirm; anything can be dismissed for a day. All decisions are logged.
- **Ask Tresor:** plain-language questions on the admin overview, answered from live numbers, with the facts shown.

### Fixed
- The homepage counter heading overlapped the mood form.

### Added (2026-10-04)
- **Tests:** Vitest with 111 tests covering pricing, orders, checkout, inventory and every engine module. Run with `npm test`.
- **Search engine:** understands moods ("warm, nutty, not too sweet"), negation, budget, group size and "today". It corrects typos and never shows unavailable items. Each result comes with a short reason, and relaxed matches say what was dropped.
- **Recommendations:** "Goes well with" on product pages; cart add-ons with a free-delivery nudge.
- **Event tracking:** across shop, product, cart, checkout, orders, kitchen and inventory. Events carry no personal data.
- **Admin:** "What needs you" insights on the overview, and a new Analytics page (sales, journey, search, products, stock outlook with forecast error, engine health).
- **Footer:** styling, which had been missing.

### Removed
- `lib/search.ts` (replaced by the engine) and the unused `lib/api.ts`.

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
