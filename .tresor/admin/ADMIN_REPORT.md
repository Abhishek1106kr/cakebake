# Tresor admin: bakery operating system (report)

Date: 2026-10-04 · Scope: the admin brief ("Admin command center + bakery management system"), mock-first and backend-ready. Gap analysis: `GAP_ANALYSIS.md`. Decisions: DEC-018 to DEC-023.

## What was built

Eighteen screens in a dedicated admin shell. None of them is a placeholder.

| Area | Screen | What staff can do |
|---|---|---|
| Today | Command Centre | Today's revenue, orders, average order, active, ready, out for delivery, custom cakes, urgent, low stock, failed automations. Needs-attention list, live kitchen counts, stock to watch, live orders (newest first, updates without refresh), intelligence. |
| | Orders + `/admin/orders/[id]` | 12 filters with counts (incl. NEW, PAYMENT FAILED, REFUND PENDING, URGENT). Search by number, name, phone, email, product or custom cake. Sort newest / oldest / value / delivery time / priority. Paginated (25). Bulk confirm, mark ready and export. CSV of the current filter. Detail: customer (contact masked by role), items as sold, payment and reference, fulfilment, invoice (view, download, regenerate), WhatsApp jobs with retry, full timeline. Explicit status steps; cancel shows the stock and payment impact and requires a reason; refunds are completed by a person. |
| | Kitchen | NEW / CONFIRMED / PREPARING / READY board sorted by urgency then due time. Due time, elapsed time (pause-aware), priority. Start, pause, resume, ready, hand to rider. Custom cake tickets are visually distinct and carry the full spec and staff notes. |
| | Custom Cakes | Views: all, urgent, today, upcoming, in production, ready, completed. Start-by time = slot minus production hours. Production sheet: side and top preview, full spec from the order snapshot, message, font, colour, photo print, print artwork download, customer notes, staff-only production notes, print. |
| Catalogue | Products | Filters (active, sold out, disabled, archived), category, search. Bulk available / sold out / archive / export. Editor: copy, slug, category, tags, price and compare-at (price changes need `products.price` and a reason), stock policy, prep time, availability, ingredients, allergens, dietary, flavour, texture, sweetness, occasion, search terms, media by role from the library, SEO. Create, duplicate, disable, archive, restore; never delete. |
| | Cake Builder | Sizes, shapes, sponges, fillings, frostings, finishes, colours, toppings, decorations, toppers, candles, packaging, message fonts, message colours, photo print rules, compatibility rules, production times, seasonal availability. Add (from an existing option so the preview can draw it), edit, duplicate, disable, archive, restore. Usage counts per option. Price changes are confirmed and audited; the print minimum size drives its rule. |
| | Inventory | On hand, reserved, available, reorder point, use per day, days of cover, and four levels (healthy / low / critical / out). Restock, wastage, stock count, reserve, release, reorder point, all audited. Bulk review. Detail: 14-day trend, what consumes it, orders using it, forecast, suggested restock, "why is this low?". |
| Customers & growth | Customers | One customer per phone number. Orders, spend, average, last order. Lifecycle from fixed rules (new, active, returning, high value, at risk, inactive). Favourites, custom cakes, marketing preferences (opt-in, default off), staff notes, CSV (contact details only with permission). |
| | Campaigns | Draft, scheduled, live, paused, ended; archive. Publishing requires `campaigns.publish`, confirmation and a reason. Audience, featured products, category, hero image, call to action (internal links only), priority, duplicate. Performance from recorded events. |
| | Content | Slots (hero, featured cakes and products, story, customer love, seasonal) with source: as designed / manual / intelligence / campaign. Announcements with dates, live on the shop. |
| | Media | Every registry asset (scenes, product images, cake roles, Our Story) with type, role, aspect, variants, alt text, provenance, licence status and usage. Assign to a product role, record a replacement, archive (warns when the asset is in active use). |
| Insight | Analytics | Period selector with previous-period deltas; revenue by day; journey; products; categories; checkout and payments (failed attempts, refunds, COD due); delivery stage times; notification reliability; search; recommendations; Cake Playground; inventory; campaigns; engine health; CSV. |
| | Intelligence | Insights (what, why, evidence, confidence, action), anomalies, forecasts with backtest error, recommendations by decision level, decision log, engine health. The copilot answers from structured data. |
| System | Automations | Jobs monitor (running, success, retrying, failed) with attempts and last error, retry, details with the mock WhatsApp message, event log. |
| | Invoices | Status per order, view, download, regenerate (same number, new revision, rebuilt from the order snapshot). |
| | Staff | Demo accounts per role (no invented names), role changes (owner only, last owner protected), deactivate, sign in as, explicit permission matrix. |
| | Audit Log | Append-only: who, action, record, before → after, time, reason, source. Filters, search, CSV. |
| | Settings | 17 sections from one schema. Each field is labelled **live** (read by the app now) or **saved for later**. Strings shaped like keys or tokens are refused. |

## How it fits together

- **Same records as the shop.** Orders and inventory stay in `StoreProvider`. The admin changes them through `transition`, `refund` and `recordMovement`, which publish the same status events the tracking page and automations use.
- **One action path** (`AdminProvider.act`): business permission check, then the change, then an audit record, then a toast. Nothing fails silently and nothing changes without an audit entry.
- **Permissions in three layers.**
  1. UI (what's shown).
  2. Business (`authorize`, before every mutation).
  3. Future server authorization, using the same permission names.
- **Domain events** go through the `AdminEventSource` interface. The browser implementation uses a same-tab event, BroadcastChannel and a short log. An SSE or WebSocket source plugs in without screen changes.
- **Repositories** have interfaces per entity, with browser implementations today. An API repository implements the same `read` / `write` / `subscribe` against a cache it reconciles.
- **Snapshots.** Orders keep what was sold (DEC-018); invoices keep customer, lines and tax. The live catalogue is configuration; history is the snapshot.
- **The live catalogue** (DEC-019): admin overrides replace the shop's live bindings after hydration, so the shop and Cake Playground follow without a redesign.

## Honest limits of this phase

- Data is per browser. Permissions are enforced in the browser, which is not a security boundary: anyone with devtools can edit storage. Server-side authorization with the same permission names is the production answer.
- Payments, invoices, WhatsApp and email are simulations; no provider credentials exist anywhere in the frontend.
- Content slots other than the announcement are stored but not yet wired into the cinematic home (wiring them would change the designed pages; see DEC-023).
- Media "replace" records the intent; the storefront follows the registry, so the swap is applied by updating the asset files under the same id.
- Overridden prices can show their code default for one frame on a hard load (DEC-019).
- Every media asset is reference imagery with unknown rights; nothing is cleared for publication and none is committed.

## Evidence

From `.tresor/test-results/` (production build `.next-test`).

| Test | Result |
|---|---|
| Unit tests (`npm test`) | 245/245 pass (31 admin domain + 9 copilot/operational insight tests added) |
| Typecheck | clean |
| Admin end-to-end (`tests/admin/admin_e2e.py`) | **63/63** checks pass. Covers every flow in brief §51 (order → admin → tracking → automations → analytics; custom cake → production sheet → notes kept private → completion; stock down on order, restored on early cancel, manual movements audited; products, Cake Builder, settings reaching the shop; permissions; search; bulk; export; failure → retry; invoices; campaigns; audit). The first run found a real bug (product page ignored admin price changes and archives), now fixed. |
| Visual QA (`tests/admin/smoke.py`) | 18 routes × 7 widths (1440–375): no console errors. Staff overflowed on phones; fixed and re-verified at 430/390/375 (0 px). |
| 100-client stress (`tests/stress/run_clients.py`) | **Incomplete: stopped by the system at 69/100 clients (low memory).** 61 clean. 5 with one failed check each, all pre-existing and unrelated to the admin: covered studio controls on share links (CLIENT-016, -060), blur warning on a tablet (CLIENT-028), checkout overflow after resize (CLIENT-047, -053). CLIENT-066 timed out (the same flaky client as the previous run). Every admin check passed in all 69. |
| Accumulation at ~300 orders (`tests/admin/scale.py`) | **Not run yet** (written; waiting for memory). |
| Admin vs homepage cost (`tests/admin/weight.py`) | **Not run yet** (written; waiting for memory). |
