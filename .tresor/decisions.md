# Tresor Decisions

## DEC-001 — v2 storefront is the final base

Date: 2026-10-04

Status: accepted

Context:
Four codebases existed:
- v1
- v2 (warm palette, storefront + admin)
- the sage Figma V2 site ("v3")
- a fresh sage build (commit 4b6b5f4)

The owner reviewed them side by side.

Decision:
`tresor-frontend-v2` is final; the others were deleted locally. The sage build remains in git history at 4b6b5f4.

Consequences:
- v2's visual design (warm palette, existing routes `/shop/[id]`, `/track-order`, `/order-confirmed`) is kept. The work adds behaviour, not a redesign.
- CLAUDE.md describes a different design (sage, Framer Motion, other routes), so it is not imported here until the owner decides how it applies.

Related: commits 99aae89, 4b6b5f4.

## DEC-002 — All business logic in the browser

Date: 2026-10-04

Status: accepted

Context:
The owner's requirement: Next.js, with business logic only in the frontend.

Decision:
- No API routes, server actions or database.
- Cart, orders, inventory and stock movements are stored in `localStorage` and synced across tabs with the `storage` event.
- Pure logic lives in `lib/orders.ts` and `lib/inventory.ts`; React state lives in `components/store-provider.tsx`.

Consequences:
- Admin pages see only orders placed in the same browser. That's fine for a demo; a real café needs a backend later.
- Swapping in a backend means replacing the provider's persistence, not the UI.

Related: TRESOR-COMMERCE-ORDERS, TRESOR-INVENTORY, TRESOR-COMMERCE-STORE.

## DEC-003 — Rich sage palette from CLAUDE.md applied to v2

Date: 2026-10-04

Status: accepted

Context:
The owner asked to "follow the color palette and make it rich using the same color" and chose the CLAUDE.md sage palette over v2's warm browns.

Decision:
- Root tokens are replaced (`--brand` `#657876` for white-text contrast, `--brand-dark` `#4A5957`, `--deep` `#2E3938`, `--sage` `#7E9291`, mist `#E8EEEC`, cream `#F8F4EC`, warm `#EFE8DD`).
- The 12 product-art gradients run from palette lights to deep sage.
- Other warm literals are remapped: browns become sage of equal lightness, creams stay in the palette's cream/warm range.
- Semantic colours (success, error, Zomato/Swiggy hovers) are unchanged.

Reasoning:
Richness comes from layering tones of one hue rather than adding new hues (CLAUDE.md §4).

Consequences:
v2 keeps its layout and typography; only colour changes.

Related: TRESOR-EXPERIENCE-PALETTE, `app/globals.css`.

## DEC-004 — Tresor is a bakery

Date: 2026-10-04

Status: accepted

Context:
Owner instruction: "it is a bakery not a cafe".

Decision:
- All copy, metadata and docs say bakery.
- Coffee and drinks remain on the menu.
- `hello@tresor.cafe` is left as-is pending the owner's decision, because changing it would invent a new address.

Related: TRESOR-CONTENT-BAKERY.

## DEC-005 — No images from the reference corpus

Date: 2026-10-04

Status: accepted

Context:
The owner suggested using images from the reference zips as site assets.

Decision:
Declined.

Reasoning:
- They are other brands' copyrighted product photography, several showing their logos and packaging.
- Using them would misrepresent those products as Tresor's.
- The owner's own reference brief forbids it.

Alternatives:
- Tresor's own photography.
- Commercially licensed stock (Unsplash/Pexels), recorded in THIRD_PARTY_NOTICES.
- Higgsfield generation (needs credits).

Related: TRESOR-MEDIA-ASSETS.


## DEC-006 · Intelligence engine runs locally with deterministic-first rules
Date: 2026-10-04

Decision:
Search, recommendations, insights and forecasts run in the browser on rules, a hashed local vector provider and exponential smoothing. Remote models can be registered behind the provider interfaces later.

Reasoning:
- The owner requires frontend-only business logic: no backend, database or API routes.
- Rules are explainable: every result carries evidence and a confidence score.
- Each pipeline still works with no provider at all (tested).

Alternatives:
- A hosted embedding or LLM API. Needs a server to keep keys secret, so it's not possible frontend-only.

Related: TRESOR-INTEL-ENGINE.

## DEC-007 · Search never bypasses availability or exclusions
Date: 2026-10-04

Decision:
Search and recommendations never show something the kitchen can't make. They never break a stated exclusion ("no nuts", "no caffeine"), even in fallback. Budget, category, group size and "today" may be relaxed, and the UI says which one was.

Related: TRESOR-INTEL-ENGINE.


## DEC-008 · Nothing that changes data runs without approval
Date: 2026-10-04

Decision:
The policy table has no EXECUTE-level action. Restocks are APPROVAL_REQUIRED and need a two-step Approve → Confirm. Kitchen, search and product findings are RECOMMEND only. Every verdict goes to an append-only local decision log and the event stream. The engine returns a plan; the store applies it.

Related: TRESOR-INTEL-NEXT.

## DEC-009 · public/our-story kept local
Date: 2026-10-04

Decision:
public/our-story/ is git-ignored and not published. It holds third-party downloads and personal-looking photos the owner added. Asked the owner how to use it.

Related: TRESOR-OUR-STORY.


## DEC-010 · Story media is local prototype; reviews are dev-only placeholders
Date: 2026-10-04

Decision:
The owner's Pinterest/Klickpin downloads drive the Story page through a manifest of roles and ids. The files stay git-ignored and are never deployed. Sample customer quotes are flagged `mock`, render only in development under a visible note, and are attributed to "Customer", never a named person.

Reasoning:
Rights are unknown, and fabricated reviews must never reach customers. One image shows an identifiable child.

Related: TRESOR-STORY.

## DEC-011 · Story lives at /about
Date: 2026-10-04

Decision:
Kept the existing /about route (already labelled "Our story" in the transition labels) instead of adding /our-story. That path would also collide with the public/our-story media folder. The header link now points to /about; the footer is untouched, as the brief requires.

Related: TRESOR-STORY.


## DEC-012 · Cake Playground pricing authority without a backend
Date: 2026-10-04

Decision:
`lib/cake/engine.ts` is the only place a custom cake is priced. Cart lines are rebuilt from their configuration on every load, and add-to-bag re-validates against live stock and season. Customer photos stay in IndexedDB. Share links carry the design but never the photo.

Reasoning:
The owner requires frontend-only business logic. The brief asks for an authoritative price and safe handling of uploads.

Related: TRESOR-CAKE-PLAYGROUND.

## DEC-013 · 2D layered SVG preview, not 3D
Date: 2026-10-04

Decision:
The preview is a layered 2D SVG renderer (extruded side view and flat top view) driven only by `CakeConfiguration`. Three.js was not added.

Reasoning:
It looks good, stays instant, and is accessible. The configuration is renderer-agnostic, so a future 3D view needs no data changes.

Related: TRESOR-CAKE-PLAYGROUND.

## DEC-014 · Keep Lenis (measured, not assumed)
Date: 2026-10-04

Decision:
Lenis stays on for desktop fine pointers, unchanged. It remains off for touch, reduced motion and /admin.

Reasoning:
Measured A (Lenis on) against B (Lenis forced off, same build) on home, story, menu, product and Cake Playground at 1440 and 1024 (2x CPU throttle).
- Lenis costs main-thread script: home 533 vs 412 ms per scroll, story 752 vs 680 ms. Most of it is its per-frame `window.scrollTo` (130–165 ms in a CPU profile).
- Native scrolling was not smoother. Dropped frames: home 0.0% with Lenis vs 1.02% without; story 0.0% vs 1.19%; product 0.98% vs 0.0%. Every difference was within about 1%.
- The brief's rule was "remove it if native is smoother", and it is not.
- Idle cost of its always-on rAF loop measured about 4 ms of script per 4 s, so it was not worth changing.

Related: TRESOR-PERF.

## DEC-015 · One scroll source instead of per-element useScroll
Date: 2026-10-04

Decision:
Every scroll-linked scene (ScrollScene, HorizontalTrack, Parallax, cake strip, story years/finale/team portrait) reads progress from `components/scroll-progress.ts`.
- One passive scroll listener feeds one shared motion value.
- Element positions are measured on mount and resize only, through a ResizeObserver on the body and on the element.
- Offsets keep Framer's meaning and are measured the same way (offsetTop chain, clientHeight).

Reasoning:
- Framer's `useScroll({ target })` re-measures its target on every scroll frame, once per hook (`calcInset` offsetParent walk plus clientWidth/clientHeight).
- The story page has about 15 such hooks. A CPU profile put this work as the largest scroll-time script cost.
- After the change, script during one scroll fell from 752 to 319 ms (story at 1440) and from 985 to 382 ms (story at 390). Home went from 533 to 276 ms. CPU-profile busy time on story at 390 went from 835 to 208 ms.
- Framer's ScrollTimeline acceleration was not in play here: it only applies to opacity/clipPath/filter/transform/backgroundColor keys, and every scroll-linked style here uses x/y/scale or a transformer.
- Pixel diffs of home, story and product at 14 scroll positions, at 1440 and 390, are identical except DEC-016.

Related: TRESOR-PERF.

## DEC-016 · Story craft line reserves the tallest line (one intentional visual change)
Date: 2026-10-04

Decision:
`.craft-line-wrap` stacks invisible copies of every craft line in one grid cell, so its height is always that of the tallest line.

Reasoning:
- The line swaps between sentences of different lengths, which resized the copy column and moved the frame beside it.
- Measured CLS was 0.03 on phones, from two shifts with sources `craft-frame` and `craft-copy`.
- With the reservation, nothing moves when the line changes.
- The visible consequence: while a short line shows, the copy block sits about 15 px higher on desktop, and on phones the whole stage sits about 30 px higher. Visual diff frames: story-1440-022/030 and story-390-015/022.
- This is the only frame-level difference in the visual regression.

Related: TRESOR-PERF.

## DEC-017 · StoreProvider not split; AnimatedNumber writes to the DOM
Date: 2026-10-04

Decision:
StoreProvider stays one context. The count-up in `AnimatedNumber` writes in-between values to its own text node. React renders only the final value.

Reasoning:
- StoreProvider: the profiler counted 0–8 React commits during a full-page scroll on every page, and the store does not change while scrolling. localStorage writes happen only when cart/orders/inventory change, so splitting it was not justified by measurement.
- AnimatedNumber: Cake Playground clicks were the outlier, with 142–164 commits for 8 option clicks. The cause was `AnimatedNumber` calling setState on every animation frame (about 27 re-renders of the studio per price change). After the change: 10–12 commits. Main-thread time for 6 clicks on a throttled phone fell from 485 to 338 ms.
- Remaining click latency is 40–160 ms to next paint at 4x CPU throttle, within the INP "good" threshold. It is mostly Framer layout projection for the sliding selection indicators, which is part of the design, so it was left alone.

Related: TRESOR-PERF.

## DEC-018 · Orders are restored exactly as sold (snapshots)
Date: 2026-10-04

Decision:
`normalizeOrder` restores each stored line as sold: product name, unit price and the custom cake spec are the order's own. Custom cake lines also freeze the option names and price breakdown (`custom.snapshot`). Only lines saved before unit prices existed fall back to the menu.

Reasoning:
- Before, every stored order went through `normalizeCart`, which re-priced lines from the live menu and rebuilt custom cakes from the current cake config. That was harmless while prices were code constants. Once the admin can edit prices, it would have rewritten history and made invoices disagree with what was charged.
- Current price = configuration (admin). Historical price = order snapshot. Invoices are rebuilt from the snapshot, so a regenerated invoice still matches the order.

Related: TRESOR-ADMIN.

## DEC-019 · Live catalogue through module bindings, applied after hydration
Date: 2026-10-04

Decision:
`lib/data.ts` `products` and the `lib/cake/config.ts` option lists are `export let` bindings. `lib/catalog/live.ts` replaces them with admin overrides from browser storage after hydration, and again when another tab saves. The store exposes `catalogRevision` so memoised menus re-read.

Reasoning:
- Every consumer (shop, search index, studio, pricing, rules, production sheet) already imports these lists. Live bindings let them follow admin changes without rewriting the customer site around a new context, which the brief ruled out.
- The engine's product index caches by array identity, so replacing the array (not mutating it) invalidates the cache correctly.
- Applying after hydration keeps the server-rendered first paint identical to the client's first render. The cost: an overridden price can show its default for one frame on a hard load. A backend serving the catalogue removes that gap.
- Archived options stay in the lists (hidden from customers, refused on new designs) so old designs and orders still resolve.

Related: TRESOR-ADMIN.

## DEC-020 · One admin action path; permissions in three layers
Date: 2026-10-04

Decision:
Every management mutation goes through `AdminProvider.act()`: authorize (business permission) → run → append the audit record → toast. Destructive or financial actions confirm first, showing their impact and asking for a reason. Permissions are an explicit matrix (`lib/admin/permissions.ts`), checked in three places: UI (what's shown), business (`authorize`, before any change) and future server authorization (same permission names).

Reasoning:
- One path means no silent failures and no change without an audit entry, and it is the seam where an API repository slots in later.
- Hidden links are not security. In this frontend-only phase `authorize()` is the guard, documented as such; it is not a security boundary against someone editing browser storage.

Related: TRESOR-ADMIN.

## DEC-021 · Paid cancellations wait for a person to complete the refund
Date: 2026-10-04

Decision:
Cancelling a paid order sets payment to `REFUND_PENDING`. A person with `finance.refund` marks it `REFUNDED` after confirming, with a reason. Cash-on-delivery cancellations become `VOID`.

Reasoning:
The brief requires approval for refunds and financial actions. Setting `REFUNDED` automatically claimed money had moved when nothing had.

Related: TRESOR-ADMIN.

## DEC-022 · Auto-confirm stays the default, as a setting
Date: 2026-10-04

Decision:
Orders still arrive `CONFIRMED` by default; Settings → Ordering → "Auto-confirm new orders" turns that off so orders wait in `NEW` for staff (bulk confirm supported).

Reasoning:
The customer tracking flow and its tests start at "confirmed". Changing the default would change the customer experience. The kitchen board's New column therefore stays empty unless the bakery turns auto-confirm off, and the board says so.

Related: TRESOR-ADMIN.

## DEC-023 · Admin has its own shell; content slots modelled, one wired
Date: 2026-10-04

Decision:
The shop header and footer no longer render under `/admin`. The admin has its own dense shell: Cormorant Garamond + Inter loaded for the admin only, no Lenis, no cinematic scenes, functional motion of 120–250 ms, CSS scoped to `.ad-shell`. Content slots (hero, featured cakes and products, story, customer love, seasonal) are stored and resolvable. Only the announcement bar is wired to the storefront. It renders nothing unless an announcement is live.

Reasoning:
- The brief: operational, not cinematic; don't redesign the customer site. Wiring every slot into the cinematic home would change designed pages, so that is a deliberate next step, labelled as such on the Content page.
- Internal production notes are stored apart from orders (`tresor-internal-notes`) so they can never reach invoices, tracking or any customer page.

Related: TRESOR-ADMIN.

## DEC-024 · Public demo stays frontend-only; the server build is parked on a branch
Date: 2026-10-05

Decision:
`main` is a frontend-only public demonstration. The admin operating system server work (Prisma schema, migration with an append-only audit trigger, Docker Compose, server env/db/redis/storage modules) is parked on branch `admin-os-server`. The admin sign-in on `main` is a mock (`lib/admin/mock-auth.ts`, demo credentials shown on the login page), gated above AdminShell/AdminProvider, with open-redirect protection, and labelled as not real security in code and on screen. The site is noindex everywhere (metadata, robots.txt, X-Robots-Tag) and shows a one-time demonstration warning.

Reasoning:
- The owner asked for a public frontend-only demo after starting the server move the same day. Keeping the server work on a branch loses nothing and keeps the deployment buildable without PostgreSQL.
- Frontend authentication can't protect anything; saying so plainly is the honest version. No fake anti-scraping tricks (right-click blocking etc.): they don't work and hurt usability.

Related: TRESOR-DEMO-DEPLOY, TRESOR-ADMIN-OS.

## DEC-025 · A deterministic shipped dataset, moved in time on load
Date: 2026-10-05

Decision:
`public/mock-data/*.json` holds 1,000 orders and their linked records, generated by `scripts/generate-mock-data.ts` with the app's own pricing, cake engine, recipes, invoice builder and slot parser (same seed and anchor give byte-identical files) and checked by `scripts/validate-mock-data.ts` (also a unit test). Seed records are read-only; a visitor's changes are small localStorage overlays, cleared by Reset demo or once when the shipped version changes. On load, history shifts by whole days so the anchor day becomes today (bakery hours and weekday patterns intact); today's live orders keep their "minutes ago"; dated custom cake slots are rewritten; when it is earlier in the day than the anchor time, today's records compress into midnight–now so nothing is dated in the future. The storefront loads only the 2 KB manifest; the admin loads the dataset (about 500 KB gzipped) and waits for it.

Reasoning:
- Fixed dates would leave the demo empty "today" within days; a continuous shift would move orders to the middle of the night. Whole days plus a live window keeps both history and the kitchen board believable.
- Generating with the app's own functions means totals, invoices, payments and stock can't disagree with what the shop computes; the validator proves it.
- Visits, views and searches are modelled from the orders (about 2–3% conversion) and said to be modelled on the Analytics page; orders, revenue, payments and stock movements are exact records.

Related: TRESOR-MOCK-DATA.

## DEC-026 · Reference images stay local; the pipeline is ready for licensed photos
Date: 2026-10-05

Decision:
The images in `public/mock-assets` (other bakeries' photos, identifiable people, unknown rights) remain git-ignored and are never deployed, even though the site is a demo. `npm run media:variants` builds AVIF/WebP variants, thumbnails and blurred placeholders for them locally; `<Media>` uses them on the development server only, and admin tables use thumbnails. Deployed builds keep the tone-gradient art until licensed photography exists; the same script processes a licensed folder.

Reasoning:
- Publishing would redistribute copyrighted photos and images of real people (including a child) whatever the site's purpose.

Related: TRESOR-MOCK-DATA.

## DEC-027 · The admin copilot calls OpenRouter through a guarded server route
Date: 2026-10-05

Decision:
`app/api/ai/copilot` reads `OPENROUTER_API_KEY` from the server environment only (never `NEXT_PUBLIC_`, never committed: `.env.local`). Requests must be same-origin; question ≤ 400 characters, context ≤ 16 KB, ≤ 350 output tokens, 20 s timeout, 10 questions per visitor per 10 minutes and 300 per day (in memory per instance). Model routing: primary `anthropic/claude-haiku-4.5`, fallbacks `anthropic/claude-sonnet-5.5` then `google/gemini-3.8-flash` via OpenRouter's `models` list; the route also promotes the first fallback if OpenRouter rejects the primary outright (a mistyped id) and retries once on network or server errors. The model sees a compact summary without phone numbers or emails; the rule-based answer and facts stay visible as the evidence, and the model answer is labelled.

Reasoning:
- On a public demo with a mock sign-in, the key's credits need protecting on the server; in-memory limits are a demo-grade measure (a shared store would be needed for strict limits across instances).

Related: TRESOR-AI-COPILOT.
