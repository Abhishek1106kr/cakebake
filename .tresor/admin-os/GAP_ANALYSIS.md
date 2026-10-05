# Admin operating system: gap analysis

Date: 2026-10-05. Brief: "TRESOR — ADMIN OPERATING SYSTEM". Previous phase: `.tresor/admin/ADMIN_REPORT.md` (browser-local admin, DEC-018 to DEC-023).

## The one big change

Until now every business rule ran in the browser and state lived in `localStorage` (the original brief required it). This brief requires the opposite for anything that matters: server-side authentication, authorization, pricing, payments, refunds, invoices and audit, on PostgreSQL + Prisma + Redis + BullMQ + Better Auth. That is a change of architecture, not a feature, and it is recorded as DEC-024.

Consequences:

- The site needs PostgreSQL and Redis running to take an order. Locally they run in Docker (`docker compose up -d`); Docker Desktop is present on this machine.
- Orders stop being per-browser. The admin sees every customer's orders, from any device.
- The customer UI stays as designed. What changes is where its data comes from.

## What exists and what each part becomes

| Area | Today | Gap | Plan |
|---|---|---|---|
| Authentication | None. A "staff switcher" picks a demo role. | Everything. | Better Auth: email OTP sign-in (`disableSignUp`), TOTP 2FA with backup codes and trusted devices, database sessions in HTTP-only cookies, expiry, revocation, rate limits. Admin accounts are provisioned by a CLI, never by signup. `/admin/login`. Passkeys: the schema and flow have room for the Better Auth passkey plugin; not switched on in this phase. |
| Authorization | `lib/admin/permissions.ts`: 5 roles, checked in the browser. | Seven roles; server enforcement; step-up. | Same permission names, now enforced in every server action and API route (`requirePermission`). Roles OWNER, ADMIN, MANAGER, KITCHEN, BAKER, DELIVERY, SUPPORT. Step-up: refunds, role/permission changes, payment settings, exports and sensitive settings need a TOTP code from the last 10 minutes. |
| Staff | Seeded demo accounts in localStorage. | Real accounts. | `Staff` linked to the auth user: role, active, invited by, last sign-in. Owner-only role changes; last owner protected (rule kept from `validateStaffChange`). |
| Customers | Derived from browser orders by phone. | Records, addresses, issues, notifications. | `Customer` (unique phone, optional email), `Address`. Created or matched at checkout. Detail page with orders, payments, invoices, custom cakes, saved designs, issues, notifications, preferences, internal notes. No inferred characteristics. |
| Orders | `lib/orders.ts` (pure, isomorphic) + `StoreProvider` (localStorage). Snapshots per line. | Server creation with server prices; tabs in detail; discounts, tax. | `Order` + `OrderItem` (snapshot JSON) + `OrderEvent`. Checkout posts the cart; the server re-prices from the database catalogue with the same pure functions (`lib/orders.ts`, `lib/cake/engine.ts`), reserves stock in a transaction and creates a payment. Client totals are ignored. State machine from `lib/tracking/status.ts`, enforced on the server. |
| Order issues | None. | Everything. | `Issue`, `IssueNote` (internal), `IssueMessage` (customer-visible), six statuses with explicit transitions, assignment, refund and payment-investigation links, audit. |
| Payments | `lib/automation/payment.ts` simulates success in the browser and the browser marks the order paid. | Server truth, provider abstraction, webhooks. | `PaymentProvider` interface with `RazorpayProvider` (REST + HMAC signature checks, test mode) and `SimulatedProvider` (local only, labelled everywhere, signs its webhooks with a local secret so the same verification path runs). Flow: create provider order → client checkout → signature verification → webhook with signature check → `PaymentEvent` persisted (idempotent on provider event id) → payment and order updated → outbox event. Eight payment states from the brief. Stripe: interface only. |
| Refunds | `REFUND_PENDING` then a button marks it refunded in the browser. | Provider refunds, partial refunds. | `Refund` (amount, reason, status, provider reference). Created by a server action that needs `payments.refund` + step-up; the provider call and webhook drive the status; the customer is notified through the automation engine. |
| Invoices | Built in the browser as HTML; numbers from a counter in localStorage. | Server generation, PDF, storage. | Invoice number from a PostgreSQL sequence (unique, gapless per year is not promised). PDF built with `pdf-lib` from the order snapshot; stored through a `FileStorage` interface (local disk under `storage/`, outside `public/`, served through an authorized route). S3/R2 later behind the same interface. |
| Kitchen / custom cakes | Admin screens over browser orders. | Server data and permissions. | Same screens, server data, `kitchen.*` permissions, status changes through the order service. |
| Products / Cake Builder | Overrides in localStorage applied to ESM live bindings (DEC-019). | Database catalogue the server prices from. | `Product` table and a `CakeCatalogConfig` record (versioned JSON), seeded from `lib/data.ts` and `lib/cake/config.ts`. Price changes audited. The storefront reads the catalogue from an API; the live-binding mechanism stays as the client cache. |
| Inventory | `lib/inventory.ts` pure + localStorage. | Transactions, reservations. | `Ingredient`, `StockMovement`. Reservation on order creation in the same transaction (row lock), release on cancel, consumption on preparation. |
| Notifications | Derived attention list. | Stored, typed, per staff. | `AdminNotification` with the seven brief types, UNREAD/READ/RESOLVED, created by the outbox consumers. |
| Automations | Browser runner with fixed invoice/WhatsApp jobs. | Workflow engine. | `Workflow` (trigger, ordered steps JSON, enabled, version), `WorkflowRun` and `WorkflowStepRun` (attempts, error, logs). Triggers and actions from the brief. Idempotency key `(workflowId, eventId)`. Retries with backoff through BullMQ. Test-run mode runs a workflow against a sample event with side effects replaced by dry-run logs. WhatsApp and email go through provider interfaces; without credentials they use labelled simulated providers. |
| Outbox | Domain events in the browser. | Durable events. | `OutboxEvent` written in the same transaction as the business change; a dispatcher moves pending events to BullMQ; consumers run workflows and notifications; Redis pub/sub feeds the admin's live stream (SSE). |
| Analytics | Browser events + derived numbers. | Server figures. | Revenue, orders, payments, refunds and delivery figures from SQL. The client intelligence engine keeps working on browser events (unchanged in this phase). |
| Audit | localStorage, append-only by convention. | Tamper-resistant, with IP and session. | `AuditLog` table; a PostgreSQL trigger rejects UPDATE and DELETE. Every service mutation appends actor, action, resource, resourceId, metadata, IP, sessionId. |
| Settings | Schema-driven, localStorage. | Server storage; secrets never in the client. | `Setting` rows validated by the existing schema. Provider secrets only in environment variables, never in the database or the browser. |

## What stays as it is

- The customer site's design, the cinematic homepage, Cake Playground and tracking page UI.
- The pure domain modules (`lib/orders.ts`, `lib/cake/engine.ts`, `lib/inventory.ts`, `lib/tracking/status.ts`, `lib/admin/*` rules), which now run on the server as well.
- The intelligence engine and copilot (they read whatever data the admin passes them).
- The admin's visual language and the "one action path" idea (now a server action path).

## Honest limits from the start

- No email, WhatsApp or Razorpay credentials exist here. Email OTP goes to a development mailbox (server log + `/admin/dev-mailbox`, development only) unless `RESEND_API_KEY` is set. Payments use the simulated provider unless Razorpay test keys are set. Nothing claims to be live.
- BullMQ workers need a long-running process (`npm run worker`). Serverless hosting would need a separate worker host.
- Passkeys: architecture-ready (table and plugin slot), not enabled.

## Order of work

1. Infrastructure: Docker Compose, Prisma schema and migrations, seed, environment template.
2. Auth + RBAC + step-up + audit + login screens.
3. Domain services: catalogue, customers, orders, inventory, payments, refunds, invoices, issues, notifications, outbox.
4. Customer site moves to the API (checkout, payment, tracking), design unchanged.
5. Workers: outbox dispatcher, workflow engine, providers.
6. Admin screens move to server data; new screens: login, security, payments, issues, customer detail, order tabs, workflow editor.
7. Tests named in the brief, then the 100-client concurrency simulation.
