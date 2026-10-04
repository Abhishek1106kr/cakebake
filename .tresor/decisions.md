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
