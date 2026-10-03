# Tresor

Customer website for Tresor, a café and bakery in Whitefield, Bengaluru. Built from the Figma V2 art direction (see `CLAUDE.md`).

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Framer Motion · lucide-react. Plain CSS with design tokens is in `app/globals.css`.

**All business logic runs in the browser.** There is no backend, no API routes and no database. The cart, orders, profile and addresses are stored in `localStorage`.

## Run

```bash
npm install
cp .env.example .env.local   # optional: Zomato / Swiggy / Maps links
npm run dev                  # http://localhost:3000
npm run build && npm start   # production
npm run typecheck
```

## The journey

1. **Home**
2. **Menu:** search by mood ("something chocolatey", "not too sweet").
3. **Product page**
4. **Bag:** includes a PIN-code check.
5. **Checkout:**
   - delivery or pickup
   - time slots in Bengaluru time
   - simulated payment
6. **Confirmation**
7. **Live tracking**

There are also About, Visit and Account pages. The account page has order history, saved addresses and privacy controls.

### Trying the payment states (simulated, no money moves)

| Method | Succeeds | Declined |
|---|---|---|
| UPI | any `name@bank` | an ID containing `fail`, e.g. `fail@upi` |
| Card | `4242 4242 4242 4242` | `4000 0000 0000 0002` |
| Pay at the door / counter | always | — |

- **ASAP orders:** tracking runs on a compressed demo clock (about 2 minutes).
- **Scheduled orders:** tracking follows real times.
- **Development mode:** the tracking page shows a "skip to next step" button.

## Where things live

| Path | What |
|---|---|
| `data/products.ts` | The menu: the single source of product data |
| `data/site.ts` | Café details, delivery PIN codes, external links |
| `data/media.ts` | Video slots (empty until media exists) |
| `lib/cart/pricing.ts` | The only place totals and fees are calculated |
| `lib/delivery/` | IST slot cut-offs, PIN serviceability |
| `lib/orders/` | Orders, tracking schedule, **payment service boundary** |
| `lib/search/semantic.ts` | Deterministic mood search |
| `lib/validation/checkout.ts` | Checkout rules |
| `lib/motion/` | Motion timings, easing, variants, choreography |
| `components/motion/` | Reveal, TextReveal, ImageReveal, Magnetic, Parallax… |
| `.tresor/` | Agent state, task graph, decisions, changelog, events |

## Adding real media

- **Product photos:** add `image: { src: '/images/products/<slug>.jpg', alt: '…' }` to the product in `data/products.ts`.
- **Videos:** put MP4/WebM loops (4–10 s, ideally under 4 MB) and posters in `public/media/`, then fill in `src` / `poster` for the slot in `data/media.ts`.

Layouts don't change in either case.

## Before launch: content to confirm with the café

- [ ] Street address, phone, email (`data/site.ts`)
- [ ] Delivery PIN codes (`data/site.ts`)
- [ ] Delivery fee ₹70 / free from ₹999; Large +₹40 (`lib/cart/pricing.ts`)
- [ ] Menu items 9–16, every product story, "Inside" layer details, allergens (`data/products.ts`)
- [ ] About page copy
- [ ] Zomato / Swiggy / Maps URLs (`.env.local`)
- [ ] Replace the simulated payment in `lib/orders/payment.ts` with a real gateway (server-side) before taking money

## Notes

- **References:** `REFERENCES.md` and `THIRD_PARTY_NOTICES.md` record the reference study. No reference assets are used.
- **No trackers:** there are no analytics or third-party trackers.
