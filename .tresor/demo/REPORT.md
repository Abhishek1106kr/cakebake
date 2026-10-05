# Tresor public demo: deployment, dataset and copilot (report)

Date: 2026-10-05 · Briefs: "Mock deployment auth + demo protection", "Shippable mock data + visual quality pass", the admin copilot on OpenRouter with model fallback. Decisions: DEC-024 to DEC-027.

## What a visitor gets

- **First visit:** a one-time warning that this is a demonstration (focus on "I understand", page behind inert, Escape doesn't dismiss, still works with storage blocked). A small "Demo environment" chip in the shop header.
- **Shop:** the designed storefront, now with 47 products (Bread category, gift boxes, seasonal items off the menu out of season). Checkout labels payments as simulated and its card/UPI fields are read-only demo values.
- **Admin:** `/admin` → `/admin/login` (demo credentials on the page) → the Command Centre with 15 months of history: 1,000 orders, 640 customers, 112 custom cake designs, payments with failed attempts and refunds, 951 invoices, 76 support issues (some still open), 555 automation jobs, stock with a day-by-day history, campaigns, and 980 audit records. "Demo · Command centre" label, a visible "Demo role" switcher and Log out.
- **Copilot (Intelligence page):** a short model-written answer above the rule-based facts, from a summary of the records.

## Dataset

| File | Contents |
|---|---|
| orders.json | 1,000 orders TRS-08142 … TRS-09141 (Aug 2025 → today), weekday and weekend rhythm, morning and evening peaks, festival spikes, growth, a live board of 8 today |
| customers.json | 640 customers CUS-00001… · synthetic 5550… phones · example.* emails · real Bengaluru localities, fictional addresses · lifetime values reconciled |
| products.json | 47 products (catalogue lives in code; exported for validation) |
| custom-cakes.json | 112 designs validated by the cake engine, linked to orders |
| payments.json | one payment per order, failed first attempts, refunds (full on cancellation, partial from issues) |
| invoices.json | one per non-cancelled order, built with the app's invoice builder |
| issues.json | delivery delays, missing/wrong items, quality, payment and refund questions, custom cake changes; open queue |
| notifications.json | low stock, payment failures, issues, delivery delays, automation failures, cake deadlines |
| automations.json | invoice and WhatsApp jobs for the last 30 days with retries and failures; 7-day event log |
| inventory.json | 33 ingredients and 6,086 movements (daily/weekly sales split online/counter, deliveries, wastage, counts) |
| analytics.json | daily visits, views, cart, checkout, searches, Cake Playground, recommendations (modelled); orders and revenue exact |
| staff.json · campaigns.json · audit.json | demo role accounts; 9 campaigns with attributed orders; staff actions |

`npm run mock:generate` regenerates (deterministic); `npm run mock:validate` checks every reference and total. The admin shows the dataset plus this browser's changes; **Reset demo** removes the changes.

## Evidence (production build `.next-test`)

| Check | Result |
|---|---|
| Type check / unit tests | clean · **289/289** |
| Data validator | consistent (all references, totals, invoices, payments, refunds, lifetime values, stock replay, analytics, campaign attribution, no orphans, nothing after "now") |
| Dataset end-to-end (`tests/demo/data_e2e.py`) | **40/40** |
| Demo deployment end-to-end (`tests/demo/demo_e2e.py`) | **71/71** |
| Admin end-to-end (`tests/admin/admin_e2e.py`) | **63/63** (one earlier run had a timing failure on a live tracking update; it passed on every re-run) |
| Screens (`tests/admin/smoke.py`) | **140/140** (20 admin pages × 7 widths): no sideways scroll, no console errors |
| Storage blocked / malformed | site and warning still work; 336/336 malformed-storage cases render |
| Copilot | live answers from Claude Haiku 4.5; with a mistyped primary, Claude Sonnet 5.5 answered and was flagged as fallback |
| Images (dev, local) | homepage images 120 KB at 1440 px and 47 KB at 390 px as AVIF (from 200 KB+ JPEGs); admin tables load 4 KB thumbnails |

Admin pages load in about 0.2 s after navigation on the production build; Custom Cakes about 0.5 s (it draws each cake; the list renders 20 at a time).

## Honest limits

- **Not real security.** The admin sign-in is a browser check with public demo credentials; all data is mock data in the visitor's browser. robots/noindex is a request to crawlers, not a barrier.
- **Images.** The reference photos are not deployed (other bakeries' images, unknown rights, identifiable people). The deployed site shows the illustrated tone art; licensed photography can drop into the same registry and pipeline.
- **Modelled traffic.** Visits, views, searches and recommendation clicks are modelled from the orders; orders, revenue, payments, stock and jobs are records.
- **Copilot limits** are kept in memory per server instance; on a host with several instances a visitor could exceed them slightly. The key must be set as a host environment variable for the deployed copilot to answer; without it the rule-based answers show.
- **Time shift.** History moves to today by whole days; festival spikes drift by the number of days since the dataset was generated (regenerate before a long-lived deployment to realign). Visiting earlier in the day than 4 pm compresses today's records into midnight–now.
- **Server build** (Prisma, Better Auth, payments, workers) is parked on `admin-os-server`, not on `main`.
