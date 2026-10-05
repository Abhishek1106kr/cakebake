# Tresor Changelog

## Unreleased

### Added (2026-10-04, admin command centre: `.tresor/admin/GAP_ANALYSIS.md`, `.tresor/admin/ADMIN_REPORT.md`)
- **Bakery operating system admin**, 18 screens in its own shell:
  - Command Centre, Orders (+ `/admin/orders/[id]`), Kitchen, Custom Cakes
  - Products, Cake Builder, Inventory
  - Customers, Campaigns, Content, Media
  - Analytics, Intelligence
  - Automations, Invoices, Staff, Audit Log, Settings
- **Shell:**
  - permission-aware grouped nav (phone drawer), breadcrumbs, Cmd+K global search, notification centre (unread/read/resolved)
  - demo staff switcher, toasts with retry, live-region announcements
- **One action path:** permission check, then the change, then an append-only audit record, then a toast. Destructive and financial actions confirm with their impact and a reason.
- **Domain events** (`order.created`, `order.status.changed`, `inventory.changed`, `invoice.*`, `notification.*`, `customCake.*`, `campaign.published`, …) behind an `AdminEventSource`. Today it is browser-based; SSE or WebSocket later.
- **Repositories** (Order, Product, Inventory, Customer, Invoice, Campaign, Media, Staff, Audit, Settings) with browser implementations.
- **The shop follows the admin** without a redesign:
  - product price, copy and sold-out flags; disabled and archived products leave the shop
  - Cake Builder options, prices, rules and production times reach the Cake Playground
  - delivery fee, free-delivery threshold, auto-confirm and invoice tax come from Settings
  - an announcement bar appears only when one is live
- **Operational intelligence:**
  - custom cake start-by deadlines, automation failures, payment-failure trends, demand and search trends
  - the copilot answers failed automations, cakes due tomorrow, orders at risk, revenue vs yesterday, what to feature, and how cakes are doing

### Changed (2026-10-04)
- **Orders are restored exactly as sold** (DEC-018). Custom cake lines snapshot their option names and price breakdown.
- **Paid cancellations become refund pending** until someone with finance permission completes them (DEC-021).
- **Inventory:** reserved stock (Reserve/Release), available = on hand − reserved, and four stock levels.
- **Invoices** snapshot the customer and tax. Regenerating keeps the number and adds a revision.
- **The admin no longer renders the shop header and footer** (DEC-023).

### Verified (2026-10-05, admin)
- 245 unit tests, typecheck clean, admin end-to-end 63/63, visual QA 18 routes × 7 widths with no overflow or console errors.
- 100-client stress: all admin checks passed; 94 clients clean, 5 pre-existing storefront issues, 1 known flaky timeout.
- 309 orders in one browser: 19/19, counts match the records, status change 54 ms.
- Admin vs homepage: same JavaScript before load (263 vs 256 KB), near-zero idle work (1–5 ms vs 316–627 ms per 4 s), half the DOM and heap.


### Performance (2026-10-04, smoothness pass; measured: `.tresor/perf/PERFORMANCE_REPORT.md`)
- **One scroll source** (`components/scroll-progress.ts`) replaces per-element `useScroll({ target })`. Framer re-measured each target on every scroll frame. Interleaved measurement of main-thread script during one scroll: home 482 → 242 ms (1440) and 604 → 233 ms (390); Our Story 730 → 326 ms and 962 → 383 ms. Pixel-identical frames.
- **Cake Playground:** the price count-up no longer re-renders the studio on every animation frame. React commits for 8 option clicks fell from 135–155 to 10–11.
- **Grain only runs on screen:** Our Story grain animates only near the viewport, and its blended area is about 3x smaller with the same jitter. Story running animations fell from 7 to 2 at idle, and idle style work on phones from 113 to 51 ms per 4 s.
- **Hero scroll cue and empty-bag icon:** now compositor CSS loops (were Framer JS loops every frame forever). Home idle script on phones fell from 94 to 22 ms per 4 s.
- **Lenis kept:** native scrolling was measured as not smoother (DEC-014).
- **Tooling:** `tests/perf/` (profiler, paired before/after, attribution, visual diff, report).

### Fixed (2026-10-04)
- **Our Story craft scene:** no longer shifts layout when its line changes (CLS 0.028 → 0 on phones). While a short line shows, the copy sits slightly higher (DEC-016).
- **Cake Playground draft:** the autosave flushes on tab hide, page close and leaving the studio (the last edit within 400 ms used to be lost).
- **Event store:** analytics events are no longer lost on navigation or between tabs (flush on pagehide, merge by id).
- **Status changes:** rapid status clicks can no longer double-advance an order (stale state).
- **Edible print:** "Fit" now fits round and heart cakes. Custom cake titles use the sponge name; "an 8 inch".
- **Cake Playground below 1040px:** step tabs and options are no longer hidden under the sticky preview.

### Added (2026-10-04, live order tracking)
- **`/track/[orderId]`:**
  - a real-time status stream (mock source shaped like WebSocket/SSE, cross-tab)
  - one validated state machine
  - per-status scenes, an animated timeline and honest ETA ranges
  - reconnect and reconcile
  - dev-only test controls
  - `/track-order` redirects to it.
- **Mock automations (labelled simulations):** invoice and WhatsApp jobs with retries and idempotency, plus mock payments with fault injection. Admin → Automations shows jobs, invoices, the outbox and the log.

### Added (2026-10-04, testing)
- **100-client stress harness** (`tests/stress/`): seeded, replayable, with P0–P4 classification and reports in `.tresor/test-results/`.

### Added (2026-10-04, smooth scrolling)
- **Lenis** smooth wheel scrolling on desktop: off for touch, reduced motion and admin, and paused while overlays lock the page.

### Added (2026-10-04, Cake Playground)
- **`/customize`:** a live cake designer covering size, shape, sponge, filling, frosting, finish, colour, toppings, decorations, topper, candles and packaging. It includes a message editor with fit checks and an edible photo print with a safe-area outline.
- **Smarter design:** designer suggestions, style presets and "Surprise me".
- **Your designs:** undo, redo and reset; autosave with "Continue your cake?"; saved designs; share links.
- **Bag and checkout:** custom cakes in the bag (re-priced from their spec), dated checkout slots after production time, and stock drawn from real ingredients.
- **Admin:** a Custom cakes production sheet with 300 dpi print artwork, and Cake Playground analytics.
- **Old route:** `/customize-cake` now redirects to `/customize`.

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
