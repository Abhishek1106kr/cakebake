# Tresor Intelligence Engine

The engine is a modular library that the storefront and admin consume as clients. No intelligence lives inside React components.

## Constraint: frontend-only

By the owner's requirement, all business logic runs in the browser:
- No backend, database or Redis.
- Events and operation logs persist in bounded `localStorage` ring buffers.
- AI providers sit behind interfaces. Today every provider is local and deterministic. A server-side model can be plugged in later without changing any caller, and every pipeline still works if a provider fails.

## What already existed (inspection, 2026-10-04)
| Area | State | Decision |
|---|---|---|
| Pricing, inventory, orders, checkout validation | Deterministic (`lib/orders.ts`, `lib/inventory.ts`), untested at inspection; 38 tests added | **Kept.** The engine reads them and never re-implements them. |
| Search | Keyword + synonym scoring (`lib/search.ts`) | **Replaced** by the engine search pipeline; `lib/search.ts` and the unused `lib/api.ts` were removed. |
| Events, analytics, observability | None | Built in Phase 1. |
| Tests | None | Vitest added; every engine module has tests. |

## Layout
```
engine/intelligence/
  core/          result contract, operation runner, observability log
  context/       context engine (session, device, page, time, cart, intent…)
  events/        versioned event schemas, validation, event bus + store
  providers/     provider interfaces, registry, fallback runner, local providers
  product/       product signals (semantic metadata) and the product index
  intent/        natural language → structured intent, with evidence
  search/        hybrid search pipeline (normalise → intent → filter → match → fuzzy → vector → business rules → rank → explain)
  ranking/       explicit, versioned, explainable ranking
  explanations/  WHAT / WHY / EVIDENCE / CONFIDENCE / NEXT
  recommend/     similar, pairs-with (complements + co-purchase), cart add-ons, for-you
  analytics/     sales by day, product performance, session funnel, search analytics
  forecast/      ingredient velocity, exponential smoothing, MAE/MAPE backtest, days of cover
  insights/      admin insights with severity, evidence, confidence and next step
  content/       showcase ordering, mood prompts, media rendition choice
  decisions/     action proposals, approval policy, append-only decision log
  copilot/       plain-language questions over the engine's outputs
  __tests__/     foundation, search, operations
  index.ts       public API
```

## The contract
Every operation returns `IntelligenceResult<T>` with these fields:
- `result`
- `confidence` (0–1)
- `evidence[]`
- `provider`
- `modelVersion`
- `rankingVersion`
- `latencyMs`
- `fallbackUsed`
- `warnings`

Every call is recorded in the observability log with the operation, latency, provider, versions, cache hit, fallback, result count, confidence and any error.

## Phases
| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation: contract, context, events, providers, observability | done |
| 2 | Product intelligence: semantic signals, local hashed vectors | done |
| 3 | Search: intent, typo correction, filters, text + vector + attribute ranking, relaxation, explanations; menu and header search | done |
| 4 | Recommendations: similar, goes-with (product page), cart add-ons with free-delivery nudge, for-you (menu) | done |
| 5 | Analytics: sales, products, funnel, search | done (`/admin/analytics`) |
| 6 | Admin intelligence: insights with evidence (stock, kitchen delays, search gaps, sales anomaly, best seller, looked-not-added) | done (overview + analytics) |
| 7 | Inventory: velocity, SES forecast with MAE/MAPE, days of cover, restock suggestion | done (analytics) |
| 8 | Content and media: homepage counter ordered by time, season, stock and sales; mood prompts that always return results; video only on good connections without reduced motion | done |
| 9 | Decision engine: OBSERVE / RECOMMEND / DRAFT / APPROVAL_REQUIRED / EXECUTE; restocks need explicit approval, nothing auto-executes; decision log | done |
| 10 | Admin copilot: sales, orders, stock, forecasts, best sellers, products, search gaps, priorities; drafts actions that still need approval | done (rules, no LLM) |

## Wiring
| Surface | Engine call | Events |
|---|---|---|
| Menu search, header search | `search` with live availability and units sold | `search_completed` (debounced), `category_view` |
| Product page | `pairsWith` | `product_view`, `recommendation_shown/clicked` |
| Cart | `cartSuggestions` | `recommendation_shown/clicked` |
| Store actions | — | `product_added/removed`, `order_created`, `payment_success` (simulated), `order_cancelled`, `delivery_status_changed`, `inventory_updated`, `product_out_of_stock` |
| Checkout, tracking, every page | — | `checkout_started`, `tracking_viewed`, `page_view` |
| Homepage counter | `orderShowcase`, `moodsFor` | — |
| Menu (browsing) | `forYou` | `recommendation_shown/clicked` |
| Every `<Media>` | `selectRendition` | — |
| Admin overview, analytics | `generateInsights`, `proposeActions`, `approveAndApply`, `askCopilot`, `salesByDay`, `funnel`, `searchAnalytics`, `productPerformance`, `stockOutlook`, `operationStats` | `insight_viewed`, `action_approved/executed/rejected` |

## Known limits
- Events and the operations log live in this browser's localStorage, so analytics only see this browser's activity until a backend exists.
- Seed orders all happen "today", so forecasts start with one day of history and say so (low confidence, MAPE needs 3+ days).
- Whole cakes have no recipes yet, so they never run out in stock checks.
- The copilot is rule-based. A `GenerationProvider` can be registered later to rephrase answers; the facts and actions would still come from the engine.
- No current media asset is a video, so the video path in `<Media>` is tested but not yet seen on the site.

## Rules
- Deterministic first. No model is used for anything a rule can decide.
- Search can never bypass availability, inventory or visibility.
- Every insight or recommendation carries evidence. No unsupported claims.
- Customers never see "AI" labels. Intelligence is felt, not advertised.
- No personal data in events. Customer identifiers are opaque, local session IDs.
