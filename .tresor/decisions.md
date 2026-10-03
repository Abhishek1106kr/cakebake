# Tresor Decisions

## DEC-001 — Fresh Next.js project on the current toolchain

Date: 2026-10-04

Status: accepted

Context:
Three earlier versions existed:
- v1 was deleted.
- v2 had a warm brown palette, no Framer Motion and `shop/[id]` routes.
- v3 was rejected by the owner ("not looking good").

CLAUDE.md requires Figma V2 identity and Framer Motion.

Decision:
Start a new project at `Desktop\tresor`, chosen by the owner. Installed versions: Next.js 16.3.8 (App Router, Turbopack), React 19.3, Framer Motion 14.0.0, TypeScript 7.0.2, lucide-react 1.51. Routes follow CLAUDE.md: `/menu`, `/product/[slug]`, `/cart`, `/checkout`, `/order/[id]`, `/track/[id]`, `/about`, `/contact`, `/account`.

Reasoning:
- Converting v2 would have meant replacing its palette, motion and routing anyway.
- Starting clean avoids carrying that debt.

Alternatives considered:
- Restore v3 from the zip.
- Build on v2.

Consequences:
- These versions are newer than the agent's training data. Bundled docs (`node_modules/next/dist/docs`) and installed type definitions are the reference.
- Request APIs are async (`params` and `searchParams` are awaited).
- `error.tsx` receives `retry`, not `reset`.

Related: TRESOR-INFRA-SCAFFOLD.

## DEC-002 — All business logic in the frontend; no backend

Date: 2026-10-04

Status: accepted

Context:
The owner stated repeatedly that business logic must live in the frontend.

Decision:
- No API routes, server actions or database.
- Cart, orders, profile, saved addresses and recently viewed are stored in `localStorage` under `tresor:*` keys, synced across tabs with the `storage` event.
- Pure logic lives in `lib/`; React state lives in `components/providers/store-provider.tsx`.

Reasoning:
- This meets the requirement.
- Keeping logic in plain `lib/` modules lets a backend replace them later without UI changes.

Alternatives considered:
- Next.js API routes with a database. Rejected by the requirement.

Consequences:
- Orders exist only in the browser that placed them. An order link opened elsewhere shows "We couldn't find that order on this device."
- No cross-device account.

Related: TRESOR-COMMERCE, `lib/`, `components/providers/store-provider.tsx`.

## DEC-003 — One pricing module with V2-derived values

Date: 2026-10-04

Status: accepted

Context:
- Earlier versions disagreed on delivery fees: v2 charged ₹70, free from ₹999; v3 charged ₹40, free above ₹1000.
- v2 showed a Large size surcharge that the cart never charged.

Decision:
`lib/cart/pricing.ts` is the only place prices are computed:
- Delivery: ₹70, free from ₹999.
- Pickup: free.
- Large drinks: +₹40.
- Maximum 10 of one item.
- Box note: 60 characters.
- Prices include GST; no other fees.

The cart stores only slug, size and quantity, so prices always come from the live menu.

Reasoning:
- CLAUDE.md §45 forbids duplicated pricing logic.
- No hidden fees.

Alternatives considered:
- v3 values.

Consequences:
- Changing a fee is a one-line edit.
- The café should confirm the values.

Related: `lib/cart/pricing.ts`.

## DEC-004 — Simulated payment behind a service boundary

Date: 2026-10-04

Status: accepted

Context:
CLAUDE.md §39 requires payment to be explicitly simulated, with idle, processing, success, failure and retry states.

Decision:
- `lib/orders/payment.ts` exposes `processPayment()` with about 1.1 s of simulated latency.
- Deterministic failure triggers: a UPI ID containing "fail", or a card number ending in 0002.
- Card data is validated (Luhn check, expiry, CVC) and then discarded, never persisted.
- The UI labels payment as simulated in checkout, confirmation, account and footer.

Reasoning:
- A real gateway (e.g. Razorpay) can replace one function.
- Testers can reach the failure path on purpose.

Alternatives considered:
- Random failures. Rejected because they are not reproducible.

Consequences:
- No real transactions until the boundary is replaced server-side.

Related: `lib/orders/payment.ts`, `components/checkout/checkout-view.tsx`.

## DEC-005 — Tracking timeline: compressed demo for ASAP, real clock for scheduled windows

Date: 2026-10-04

Status: accepted

Context:
- There is no kitchen system to drive status.
- CLAUDE.md §38 allows timed progression or dev debug controls.

Decision:
- Each order stores a `schedule` of status start times, and tracking derives the current status from it every second.
- ASAP orders run a compressed demo (about 2 minutes end to end), labelled "Prototype timeline".
- Scheduled orders use real times worked back from the window.
- A "skip to next step" control appears only in development.

Reasoning:
- The full journey can be demonstrated without implying real delivery times for scheduled orders.

Alternatives considered:
- Manual-only progression.
- A fake real-time ASAP timeline.

Consequences:
- Must be replaced by real order events when a backend exists.

Related: `lib/orders/orders.ts`, `components/tracking/`.

## DEC-006 — Delivery slots computed from Bengaluru time in the browser

Date: 2026-10-04

Status: accepted

Context:
The Amintiri reference showed slot logic tied to IST. Customers need honest cut-offs.

Decision:
- Opening hours are 08:00–23:00 (from Figma V2), with two-hour windows from 09:00.
- A slot closes at window start minus (longest prep time in the cart + 15 min buffer + 30 min ride for delivery).
- Unavailable slots show their reason ("Order by 16:15", "Too soon to prepare").
- The chosen slot is re-checked at submit.
- The calculation uses a fixed +05:30 offset (India has no DST), independent of the visitor's timezone.

Alternatives considered:
- Fetching slots from a server. Rejected by DEC-002.

Consequences:
- Buffer and ride constants live in `lib/delivery/slots.ts` and should be confirmed with the café.

Related: `lib/delivery/slots.ts`.

## DEC-007 — Deterministic mood search instead of a model

Date: 2026-10-04

Status: accepted

Context:
CLAUDE.md §40 asks for semantic-style search without "AI-powered" claims.

Decision:
`lib/search/semantic.ts` scores products by:
- direct mood-tag matches (+4);
- text matches (+3);
- intent synonym expansion (+1.5);
- a `sweetness` (1–5) signal for "not too sweet" phrasing.

It returns match reasons that the UI shows as "Picked for …".

Reasoning:
- Same query, same order.
- Works offline.
- It can be swapped for embeddings later behind the same function signature.

Alternatives considered:
- Embedding or vector search. That needs a backend or model provider, which DEC-002 rules out.

Consequences:
- No validation set exists yet, so no relevance quality is claimed.

Related: TRESOR-INTELLIGENCE-SEARCH.

## DEC-008 — Page transitions: entry veil via template.tsx; first visit gets the brand loader

Date: 2026-10-04

Status: accepted

Context:
- CLAUDE.md §8 asks for a sage veil transition.
- The App Router has no native exit animations between routes.

Decision:
- `app/template.tsx` remounts on navigation and renders a sage veil (Tresor + route label) that sweeps away in about 0.45 s while content enters.
- The first page load shows the brand loader instead. It is capped at about 900 ms, can be interrupted, and is skipped for returning sessions and reduced-motion visitors by a pre-paint inline script. A CSS failsafe hides it without JavaScript.

Alternatives considered:
- Exit animations by freezing the router. Rejected as fragile with framework internals.

Consequences:
- No exit animation.
- Reduced motion gets a 150 ms fade only.

Related: `components/layout/page-transition.tsx`, `components/layout/brand-loader.tsx`, `app/layout.tsx`.

## DEC-009 — Primary buttons use #657876 for contrast

Date: 2026-10-04

Status: accepted

Context:
White text on `#7E9291` measures about 3.3:1 contrast, below WCAG AA's 4.5:1 for normal-size text (CLAUDE.md §28/§49).

Decision:
- Primary buttons and small text on sage use `#657876` (about 4.7:1 with white).
- `#7E9291` stays for large display areas, panels and accents.

Alternatives considered:
- Using `#7E9291` everywhere. Rejected because it fails contrast.

Consequences:
- Sage still reads as the signature colour; CTAs are slightly deeper.

Related: `app/globals.css`.

## DEC-010 — Media slots with soft-colour fallbacks until assets exist

Date: 2026-10-04

Status: accepted

Context:
- No Tresor photography or video exists.
- The Higgsfield account has 0 credits.
- The owner chose "placeholders now, swap later".

Decision:
- `data/media.ts` lists the video slots.
- `LazyVideo` renders a poster or fallback first, attaches sources only near the viewport, plays one video at a time and never autoplays under reduced motion.
- Products render original hairline drawings on tonal backgrounds until `product.image` is set.

Reasoning:
- CLAUDE.md §42 says to replace placeholders without changing layout logic.

Consequences:
- Adding real media is a data-only change.

Related: TRESOR-MEDIA-GENERATION, `components/media/`.

## DEC-011 — No reference-corpus assets and no third-party trackers

Date: 2026-10-04

Status: accepted

Context:
- The reference master instruction forbids copying.
- Licences of the reference assets are proprietary or unclear.
- The Bakingo capture showed 30+ ad-tech domains.

Decision:
- Zero reference assets in the repository.
- No analytics or ad scripts.
- Fonts are self-hosted at build time via `next/font` (SIL OFL).

Consequences:
- Analytics, if wanted, must be added deliberately later.

Related: REFERENCES.md §7, THIRD_PARTY_NOTICES.md.

## DEC-012 — Delivery zone around Whitefield

Date: 2026-10-04

Status: proposed

Context:
- Figma V2 places the café in Whitefield.
- No delivery radius has been supplied.

Decision:
Ten East Bengaluru PIN codes are serviceable (`data/site.ts`). Other 560xxx PINs are offered pickup instead.

Consequences:
Must be confirmed with the café before launch.

Related: `data/site.ts`, `lib/delivery/serviceability.ts`.
