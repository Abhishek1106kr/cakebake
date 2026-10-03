# Tresor Café — Mock Commerce Frontend

A high-fidelity, interactive mock website for the Tresor café/bakery proposal.

## What is included

- Animated homepage / storytelling sections
- Customer-facing menu catalogue
- Semantic-style local search (“something chocolatey”, “a cold coffee”, etc.)
- Category filters and sorting
- Product detail pages
- Persistent local cart with quantity updates
- Mock checkout with UPI / Card / Pay-at-door states
- Mock payment processing and order creation
- Order confirmation page
- Live order tracking timeline
- About and Contact pages
- Zomato / Swiggy handoff buttons
- Simple account page (guest-first; production auth can replace it later)
- Responsive mobile / tablet / desktop layout

## Business logic mocked in-browser

The frontend persists the cart and latest order in `localStorage`.
Checkout creates a mock order ID and moves the order to `CONFIRMED` after a simulated payment delay.

No real payment is processed. Replace the checkout action with the backend payment intent / Razorpay flow when the API is ready.

## Environment variables

```bash
NEXT_PUBLIC_ZOMATO_URL=https://www.zomato.com/<actual-restaurant-link>
NEXT_PUBLIC_SWIGGY_URL=https://www.swiggy.com/<actual-restaurant-link>
NEXT_PUBLIC_API_URL=/api
```

## Stack

Next.js 15 · React 19 · TypeScript · Lucide React · CSS tokens/animations

## Run

```bash
npm install
npm run dev
```

The project intentionally uses CSS motion instead of requiring a heavy animation dependency so the mock stays easy to run and hand over.
