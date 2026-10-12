# Tresor Bakery — Mock Commerce Frontend

A high-fidelity, interactive mock website for the Tresor bakery proposal.

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

## CI/CD

`.github/workflows/ci.yml` runs on every push and pull request:

1. **Check:** `npm ci`, typecheck, unit tests, `mock:validate`, production build.
2. **Browser end-to-end:** `tests/demo/data_e2e.py` and `tests/demo/demo_e2e.py` against that build (Playwright + Chrome).
3. **Deploy (Vercel):** after both pass, pull requests get a preview deployment and `main` goes to production.

Deployments need three repository secrets (GitHub → Settings → Secrets and variables → Actions):

| Secret | Where to find it |
|---|---|
| `VERCEL_TOKEN` | vercel.com/account/tokens |
| `VERCEL_ORG_ID` | `orgId` in `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | `projectId` in the same file |

Without them the deploy job skips with a note. `vercel.json` turns off Vercel's own Git deployments so each commit deploys once, from CI. CI builds come from git, so the git-ignored reference photos are never in them; the site shows the illustrated fallbacks. Server-side variables (`OPENROUTER_API_KEY` …) stay in the Vercel project settings.

Dependabot (`.github/dependabot.yml`) opens weekly dependency updates, each checked by the same pipeline.

The project intentionally uses CSS motion instead of requiring a heavy animation dependency so the mock stays easy to run and hand over.
