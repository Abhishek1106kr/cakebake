# Admin gap analysis (2026-10-04)

Inspected before any admin code changed: `app/admin/*`, `components/admin/*`, `components/store-provider.tsx`,
`lib/orders.ts`, `lib/inventory.ts`, `lib/automation/*`, `lib/tracking/*`, `lib/cake/*`, `lib/data.ts`,
`engine/intelligence/*`, `app/globals.css` (admin rules), and the admin selectors the stress/tracking harnesses rely on.

## What exists today

| Area | Current state |
|---|---|
| Shell | `app/admin/layout.tsx`: sidebar with 8 links plus Customers/Settings marked "soon". Rendered **under the customer header and above the customer footer** (root layout), so the admin carries shop chrome. No global search, notifications, staff identity, breadcrumbs or mobile drawer (below 1000px the nav becomes a horizontal scroller). |
| State | `StoreProvider` (root): cart, orders, inventory, movements in localStorage, synced across tabs by `storage` events. One validated transition path (`applyTransition`) publishes status events and triggers automations. |
| Orders | Model: id, customer {name, phone, email}, address, slot (free text: `18:00–20:00` or `Sat, 10 Oct · 10:00–12:00`), payment {method, status PAID/DUE/REFUNDED/VOID}, totals, status + history, items (cart lines incl. custom cake spec), source. Admin list: 8 filter chips, search (id/name/phone), row actions advance + cancel (two-click confirm), CSV of view. **No detail view, sorting, pagination, bulk, priority or due time.** |
| Order lifecycle | `TRANSITIONS` state machine (tracking/status.ts). Orders are created already `CONFIRMED` (auto-confirm), so a NEW column would always be empty. Payment failures never create an order (only a `payment_failure` analytics event). Cancel sets payment straight to `REFUNDED`, with no refund step. |
| Kitchen | 3 columns (Incoming/Preparing/Ready), tickets with elapsed and late flag, Framer layout springs. Custom cake tickets look the same as others; no spec on the ticket, no due time, no pause. |
| Custom cakes | List and production sheet (side and top preview, full spec, message, print artwork from IndexedDB). No views (today/upcoming/urgent), no due date, no internal notes, no status actions. |
| Products | Read-only table from static `lib/data.ts`; "Add product" disabled. |
| Cake config | Static `lib/cake/config.ts` (options, prices, rules, print rules). Engine, studio, preview and designer import it directly. |
| Inventory | Table (on hand, reorder point, Out/Low/Healthy), manual movement form (Restock/Wastage/Correction), last 50 movements. No reserved/available, usage, cover, detail, or audit. |
| Automations | Per-order grid (invoice, WhatsApp, updates) with retry, invoice/outbox detail, event log. Jobs: requested/retrying/succeeded/failed with attempts and last error. |
| Invoices | Built by the automation runner and stored per order (`tresor-invoices`); only visible inside Automations. No list, download or regenerate. |
| Analytics | 7-day revenue, funnel, search, product performance, Cake Playground, stock outlook, engine health. |
| Intelligence | Insights (stock, kitchen, search, sales anomaly, products), decision engine (OBSERVE…EXECUTE, approval, append-only decision log), copilot (sales/orders/stock/forecast/best sellers/product/search gaps). Lives on Overview and Analytics. |
| Customers, Campaigns, Content, Media, Staff, Audit, Settings, Cake Builder, Invoices page, notifications, global search | **Do not exist.** |

## Classification

### CURRENT (keep, extend in place)
- Order state machine and `applyTransition` (single path for status, tracking event and WhatsApp trigger).
- Mock automation runner (idempotent jobs, retries, fault injection) and its invoice builder.
- Inventory consumption on order and restore on early cancel.
- Intelligence engine contract (evidence, confidence, provider, versions), decision levels and approval log.
- Custom cake production sheet (`.cc-item` / `.spec-row` / `.cc-artwork` are harness contracts).
- Cross-tab sync (storage events + BroadcastChannel) as the mock real-time transport.

### NEEDS REFACTOR
1. **Historical snapshots are not stable.** `normalizeOrder` runs every stored order through `normalizeCart`, which re-prices lines from the live menu and rebuilds custom cakes from the current cake config. Harmless while prices are code constants, but it would rewrite history once admin edits prices. Order lines must be restored as stored snapshots (product name, unit price, custom spec, option names).
2. **Cancel → refund.** Paid cancellations should go to `REFUND_PENDING`, and a person with finance permission marks the refund complete (`REFUNDED`).
3. **Auto-confirm** becomes a setting (default on, the current behaviour) so NEW orders can require staff confirmation.
4. **Kitchen** loses the Framer layout springs (functional 150–250 ms CSS only) and gains due times, priority, pause, and distinct custom cake tickets.
5. **Admin shell** gets its own full-height layout: the customer header and footer stop rendering under `/admin`. The customer site itself is unchanged.
6. **Static catalogues become overridable.** `lib/data.ts` products and `lib/cake/config.ts` options become live module bindings that a catalogue layer replaces after hydration, with admin overrides persisted locally.
7. **Business constants** (delivery fee, free-delivery threshold) move behind a settings getter; the rest of `lib/orders.ts` stays pure.
8. **Inventory** gains `reserved` (Reserve/Release movements). Available = on hand − reserved feeds shop availability; there are 4 levels (Healthy/Low/Critical/Out).

### NEEDS NEW MODEL
- Staff + roles + explicit permission matrix (`can(actor, permission)`); a demo session switcher.
- Append-only audit log (actor, action, entity, before, after, reason, source, time).
- Domain events (`order.created`, `order.status.changed`, `inventory.changed`, `invoice.generated/failed`, `notification.sent/failed`, `customCake.created/updated`, `campaign.published`) behind an `AdminEventSource` interface (browser now; SSE/WebSocket later).
- Notifications derived from state (new order, low stock, custom cake due, invoice/WhatsApp/payment failure, delivery delay, system issue) with UNREAD/READ/RESOLVED.
- Customers derived from orders (keyed by normalised phone) + profile overlay (preferences, notes) + deterministic lifecycle rules.
- Product records (status ACTIVE/INACTIVE/ARCHIVED, compare-at, stock policy, SEO, media roles…) as overrides on the base menu.
- Cake option overrides (price, availability, status, production hours, allergens, ingredients, season, topping limits), print rules, compatibility rules, base production time.
- Campaigns (DRAFT/SCHEDULED/LIVE/PAUSED/ENDED, archive), content slots (manual / intelligence / campaign), media asset records with provenance and usage.
- Business settings (17 sections), each field marked **live** (read by the app today) or **stored** (kept for the backend phase).
- Internal production notes (stored apart from the order, so they can never reach invoices or customer pages).
- Repository interfaces (Order, Product, Inventory, Customer, Invoice, Campaign, Media, Staff, Audit, Settings) with Browser implementations.
- Invoice revisions (regenerate keeps the number, bumps the revision, audited) and customer/tax snapshots.
- Order priority, required-by (parsed from the slot), due state (on track / at risk / late), timeline merging status history, automations and audit.

### NEEDS ONLY UI
- Command Center layout (today KPIs, attention, live orders, kitchen counts, inventory, intelligence).
- Order filters (NEW, PAYMENT FAILED), sort, pagination, bulk confirm/ready/export, detail drawer and page.
- Automations as a job monitor (filters ALL/RUNNING/SUCCESS/RETRYING/FAILED).
- Invoices list (data already exists).
- Intelligence page (engine outputs exist; add operational insight kinds).
- Analytics sections for payments, checkout, delivery, notifications, recommendations, categories, campaigns.
- Global search, notification centre, toasts, confirmations with impact, mobile drawer and cards.

## Harness contracts to preserve
- `/admin/orders`: order id visible on the default view; the first `button.btn-sm` in an order's row advances it.
- `/admin` overview: a `.table` containing the newest orders.
- `/admin/automations`: `tr[data-order="<id>"]`.
- `/admin/custom-cakes`: `.cc-item` (has the order id), `.spec-row` ≥ 10, `.cc-artwork img`.
- Tracking: the initial state after checkout stays "confirmed" (auto-confirm default on).

## Honest limits of the mock phase
- Permissions are enforced in the UI and in the admin action layer, not by a server. Anyone with the browser's devtools can change local data. The permission layer is shaped so server-side authorisation replaces it.
- Data is per browser. Catalogue and settings overrides apply after hydration, so an overridden price can show its default for one frame on a hard load.
- No provider credentials exist or are stored. WhatsApp, email, payments and invoices are simulations.
- Media library entries for `public/mock-assets` and `public/our-story` are reference-only (rights unknown, never shipped).
