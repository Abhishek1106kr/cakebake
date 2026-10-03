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
