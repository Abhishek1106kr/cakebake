// Integrity checks for the shipped demo dataset. Pure: give it the parsed files, get back a list
// of problems (empty = consistent). Used by scripts/validate-mock-data.ts and by the unit tests.

import { DEFAULT_RULES } from '@/lib/config/business';
import { invoiceNumberFor } from '@/lib/automation/automation';
import { needsFor } from '@/lib/inventory';
import type { MockDataset, SeedOrder } from './types';

const near = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

export type ValidationReport = { problems: string[]; stats: Record<string, number> };

export function validateDataset(ds: MockDataset): ValidationReport {
  const problems: string[] = [];
  const fail = (msg: string) => { if (problems.length < 200) problems.push(msg); };

  // ── Counts and uniqueness ──
  if (ds.orders.length !== 1000) fail(`orders: expected exactly 1000, found ${ds.orders.length}`);
  if (ds.customers.length < 600) fail(`customers: expected at least 600, found ${ds.customers.length}`);
  if (ds.products.length < 40 || ds.products.length > 50) fail(`products: expected 40–50, found ${ds.products.length}`);
  if (ds.customCakes.length < 100) fail(`custom cakes: expected at least 100, found ${ds.customCakes.length}`);
  const unique = (name: string, ids: string[]) => { const seen = new Set<string>(); for (const id of ids) { if (seen.has(id)) fail(`${name}: duplicate id ${id}`); seen.add(id); } return seen; };
  const orderIds = unique('orders', ds.orders.map((o) => o.id));
  const customerIds = unique('customers', ds.customers.map((c) => c.id));
  const productIds = unique('products', ds.products.map((p) => p.id));
  const designIds = unique('custom cakes', ds.customCakes.map((c) => c.id));
  const paymentIds = unique('payments', ds.payments.map((p) => p.id));
  const refundList = ds.payments.flatMap((p) => p.refunds);
  const refundIds = unique('refunds', refundList.map((r) => r.id));
  const issueIds = unique('issues', ds.issues.map((i) => i.id));
  const staffIds = unique('staff', ds.staff.map((s) => s.id));
  const ingredientIds = unique('ingredients', ds.inventory.ingredients.map((i) => i.id));
  unique('invoices', ds.invoices.map((i) => i.invoiceNumber));
  unique('notifications', ds.notifications.map((n) => n.id));
  unique('jobs', ds.automations.jobs.map((j) => j.id));
  unique('movements', ds.inventory.movements.map((m) => m.id));
  unique('campaigns', ds.campaigns.map((c) => c.id));
  for (const o of ds.orders) if (!/^TRS-\d{5}$/.test(o.id)) fail(`order id format: ${o.id}`);
  for (const c of ds.customers) if (!/^CUS-\d{5}$/.test(c.id)) fail(`customer id format: ${c.id}`);

  // ── Synthetic contact details only ──
  for (const c of ds.customers) {
    if (!/^5550\d{6}$/.test(c.phone)) fail(`${c.id}: phone is not in the synthetic 5550… range`);
    if (c.email && !/@example\.(com|net|org)$/.test(c.email)) fail(`${c.id}: email is not an example.* address`);
  }

  // ── Orders: customers, products, designs, totals ──
  const byOrder = new Map(ds.orders.map((o) => [o.id, o]));
  for (const o of ds.orders) {
    if (!customerIds.has(o.customerId)) fail(`${o.id}: unknown customer ${o.customerId}`);
    const subtotal = o.items.reduce((s, l) => s + l.unitPrice * l.qty, 0);
    if (subtotal !== o.subtotal) fail(`${o.id}: subtotal ${o.subtotal} ≠ lines ${subtotal}`);
    const delivery = subtotal === 0 || subtotal >= DEFAULT_RULES.freeDeliveryFrom ? 0 : DEFAULT_RULES.deliveryFee;
    if (delivery !== o.delivery) fail(`${o.id}: delivery ${o.delivery} ≠ rule ${delivery}`);
    if (o.total !== o.subtotal + o.delivery) fail(`${o.id}: total ≠ subtotal + delivery`);
    for (const l of o.items) {
      if (l.custom) { if (!designIds.has(l.custom.designId)) fail(`${o.id}: custom cake design ${l.custom.designId} missing`); }
      else if (!productIds.has(l.product.id)) fail(`${o.id}: unknown product ${l.product.id}`);
    }
    if (o.history.length === 0 || o.history[o.history.length - 1].status !== o.status) fail(`${o.id}: timeline does not end at its status`);
    for (let i = 1; i < o.history.length; i += 1) if (o.history[i].at < o.history[i - 1].at) fail(`${o.id}: timeline goes backwards`);
    if (o.history[0]?.at !== o.createdAt) fail(`${o.id}: timeline does not start at creation`);
  }
  for (const cc of ds.customCakes) {
    const o = byOrder.get(cc.orderId);
    if (!o) { fail(`custom cake ${cc.id}: unknown order ${cc.orderId}`); continue; }
    const line = o.items.find((l) => l.custom?.designId === cc.id);
    if (!line) fail(`custom cake ${cc.id}: not on order ${cc.orderId}`);
    else if (line.unitPrice !== cc.price) fail(`custom cake ${cc.id}: price ${cc.price} ≠ order line ${line.unitPrice}`);
    if (o.customerId !== cc.customerId) fail(`custom cake ${cc.id}: customer disagrees with its order`);
  }

  // ── Payments and refunds ──
  const paymentsByOrder = new Map<string, typeof ds.payments>();
  for (const p of ds.payments) {
    if (!orderIds.has(p.orderId)) { fail(`${p.id}: unknown order ${p.orderId}`); continue; }
    (paymentsByOrder.get(p.orderId) ?? paymentsByOrder.set(p.orderId, []).get(p.orderId)!).push(p);
    const o = byOrder.get(p.orderId)!;
    if (p.customerId !== o.customerId) fail(`${p.id}: customer disagrees with its order`);
    if (p.amount !== o.total) fail(`${p.id}: amount ${p.amount} ≠ order total ${o.total}`);
    if (p.method !== o.paymentMethod) fail(`${p.id}: method ${p.method} ≠ order ${o.paymentMethod}`);
    const refunded = p.refunds.filter((r) => r.status === 'PROCESSED').reduce((s, r) => s + r.amount, 0);
    if (refunded !== p.refundedAmount) fail(`${p.id}: refundedAmount ${p.refundedAmount} ≠ processed refunds ${refunded}`);
    if (refunded > p.amount) fail(`${p.id}: refunded more than was paid`);
    if (p.status === 'REFUNDED' && refunded !== p.amount) fail(`${p.id}: REFUNDED but only ${refunded} of ${p.amount} refunded`);
    if (p.status === 'PARTIALLY_REFUNDED' && !(refunded > 0 && refunded < p.amount)) fail(`${p.id}: PARTIALLY_REFUNDED with ${refunded}`);
    if (p.status === 'REFUND_PENDING' && !p.refunds.some((r) => r.status === 'PENDING')) fail(`${p.id}: REFUND_PENDING without a pending refund`);
    for (const r of p.refunds) {
      if (r.paymentId !== p.id || r.orderId !== p.orderId) fail(`${r.id}: refund points at the wrong payment or order`);
      if (r.issueId && !issueIds.has(r.issueId)) fail(`${r.id}: unknown issue ${r.issueId}`);
      if (!staffIds.has(r.by)) fail(`${r.id}: unknown staff ${r.by}`);
    }
  }
  for (const o of ds.orders) {
    const ps = paymentsByOrder.get(o.id) ?? [];
    if (!ps.length) { fail(`${o.id}: no payment record`); continue; }
    const final = ps.filter((p) => p.status !== 'FAILED');
    if (final.length !== 1) fail(`${o.id}: expected one non-failed payment, found ${final.length}`);
    const p = final[0];
    if (!p) continue;
    const expected: Record<string, string[]> = {
      PAID: o.paymentMethod === 'COD' ? ['CAPTURED'] : ['CAPTURED', 'PARTIALLY_REFUNDED'],
      DUE: ['CREATED'], VOID: ['CANCELLED'], REFUNDED: ['REFUNDED'], REFUND_PENDING: ['REFUND_PENDING'],
    };
    if (!(expected[o.paymentStatus] ?? []).includes(p.status)) fail(`${o.id}: order payment ${o.paymentStatus} disagrees with payment ${p.id} ${p.status}`);
    if (o.paymentReference && p.reference !== o.paymentReference) fail(`${o.id}: payment reference disagrees`);
  }

  // ── Invoices ──
  const invoiceByOrder = new Map(ds.invoices.map((i) => [i.orderId, i]));
  for (const inv of ds.invoices) {
    const o = byOrder.get(inv.orderId);
    if (!o) { fail(`${inv.invoiceNumber}: unknown order ${inv.orderId}`); continue; }
    if (inv.invoiceNumber !== invoiceNumberFor(o.id)) fail(`${inv.invoiceNumber}: number does not follow the order`);
    if (inv.total !== o.total || inv.subtotal !== o.subtotal || inv.delivery !== o.delivery) fail(`${inv.invoiceNumber}: amounts disagree with ${o.id}`);
    const lineSum = inv.lines.reduce((s, l) => s + l.amount, 0);
    if (lineSum !== inv.subtotal) fail(`${inv.invoiceNumber}: lines ${lineSum} ≠ subtotal ${inv.subtotal}`);
    if (o.status === 'CANCELLED') fail(`${inv.invoiceNumber}: issued for cancelled order ${o.id}`);
  }
  for (const o of ds.orders) if (o.status !== 'CANCELLED' && !invoiceByOrder.has(o.id)) fail(`${o.id}: eligible order without an invoice`);

  // ── Customers reconcile with their orders ──
  const ordersByCustomer = new Map<string, SeedOrder[]>();
  for (const o of ds.orders) (ordersByCustomer.get(o.customerId) ?? ordersByCustomer.set(o.customerId, []).get(o.customerId)!).push(o);
  const processedByOrder = new Map<string, number>();
  for (const r of refundList) if (r.status === 'PROCESSED') processedByOrder.set(r.orderId, (processedByOrder.get(r.orderId) ?? 0) + r.amount);
  for (const c of ds.customers) {
    const mine = (ordersByCustomer.get(c.id) ?? []).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (!mine.length) fail(`${c.id}: customer with no orders (orphan)`);
    if (c.orderIds.join() !== mine.map((o) => o.id).join()) fail(`${c.id}: orderIds disagree with the orders`);
    const kept = mine.filter((o) => o.status !== 'CANCELLED');
    if (c.orderCount !== kept.length) fail(`${c.id}: orderCount ${c.orderCount} ≠ ${kept.length}`);
    const spend = kept.reduce((s, o) => s + o.total, 0);
    if (c.totalSpend !== spend) fail(`${c.id}: totalSpend ${c.totalSpend} ≠ orders ${spend}`);
    const refunded = mine.reduce((s, o) => s + (processedByOrder.get(o.id) ?? 0), 0);
    if (c.refunded !== refunded) fail(`${c.id}: refunded ${c.refunded} ≠ ${refunded}`);
    if (c.firstOrderAt !== (mine[0]?.createdAt ?? null) || c.lastOrderAt !== (mine[mine.length - 1]?.createdAt ?? null)) fail(`${c.id}: first/last order dates disagree`);
    for (const id of c.customCakeIds) if (!designIds.has(id)) fail(`${c.id}: unknown custom cake ${id}`);
    for (const id of c.issueIds) if (!issueIds.has(id)) fail(`${c.id}: unknown issue ${id}`);
    const nameMatches = mine.every((o) => o.customer.phone === c.phone);
    if (!nameMatches) fail(`${c.id}: an order carries a different phone number`);
  }

  // ── Issues ──
  for (const x of ds.issues) {
    const o = byOrder.get(x.orderId);
    if (!o) { fail(`${x.id}: unknown order ${x.orderId}`); continue; }
    if (o.customerId !== x.customerId) fail(`${x.id}: customer disagrees with its order`);
    if (x.assignedTo && !staffIds.has(x.assignedTo)) fail(`${x.id}: unknown staff ${x.assignedTo}`);
    if (x.refundId) { const r = refundList.find((y) => y.id === x.refundId); if (!r || r.issueId !== x.id || r.orderId !== x.orderId) fail(`${x.id}: refund ${x.refundId} does not point back`); }
    if ((x.status === 'RESOLVED' || x.status === 'CLOSED') !== Boolean(x.resolvedAt)) fail(`${x.id}: resolvedAt disagrees with status ${x.status}`);
    if (!ds.customers.find((c) => c.id === x.customerId)?.issueIds.includes(x.id)) fail(`${x.id}: missing from the customer's issues`);
  }

  // ── Notifications and automations ──
  const jobIds = new Set(ds.automations.jobs.map((j) => j.id));
  for (const n of ds.notifications) {
    const ok = n.resourceType === 'order' ? orderIds.has(n.resourceId) : n.resourceType === 'ingredient' ? ingredientIds.has(n.resourceId)
      : n.resourceType === 'issue' ? issueIds.has(n.resourceId) : n.resourceType === 'payment' ? paymentIds.has(n.resourceId) : jobIds.has(n.resourceId);
    if (!ok) fail(`${n.id}: unknown ${n.resourceType} ${n.resourceId}`);
    if ((n.state === 'RESOLVED') !== Boolean(n.resolvedAt)) fail(`${n.id}: resolvedAt disagrees with state`);
  }
  for (const j of ds.automations.jobs) {
    if (!orderIds.has(j.orderId)) fail(`job ${j.id}: unknown order ${j.orderId}`);
    if (j.id !== `${j.kind}:${j.orderId}:${j.topic}`) fail(`job ${j.id}: id is not kind:order:topic`);
  }
  for (const e of ds.automations.log) if (!orderIds.has(e.orderId)) fail(`log ${e.id}: unknown order ${e.orderId}`);

  // ── Inventory: replay the history; online usage matches the orders ──
  const recipeNeeds = new Map(ds.orders.map((o) => [o.id, needsFor(o.items)]));
  const level = new Map(ds.inventory.ingredients.map((i) => [i.id, i.onHand]));
  for (const m of ds.inventory.movements) {
    if (!ingredientIds.has(m.ingredientId)) { fail(`${m.id}: unknown ingredient ${m.ingredientId}`); continue; }
    level.set(m.ingredientId, level.get(m.ingredientId)! - m.delta); // walk back to the opening level
    if (m.reason === 'Sale') {
      for (const id of m.orderIds ?? []) if (!orderIds.has(id)) fail(`${m.id}: unknown order ${id}`);
      const fromOrders = (m.orderIds ?? []).reduce((s, id) => s + (recipeNeeds.get(id)?.[m.ingredientId] ?? 0), 0);
      if (!near(fromOrders, m.online ?? 0, 0.02 + fromOrders * 0.01) && (m.online ?? 0) < fromOrders - 0.02) fail(`${m.id}: online use ${m.online} < orders' recipe use ${fromOrders.toFixed(3)}`);
      if (!near((m.online ?? 0) + (m.counter ?? 0), -m.delta, 0.005)) fail(`${m.id}: online + counter ≠ delta`);
    }
    if (m.actor && !staffIds.has(m.actor)) fail(`${m.id}: unknown staff ${m.actor}`);
  }
  const running = new Map(level); // opening levels
  for (const m of ds.inventory.movements) {
    running.set(m.ingredientId, (running.get(m.ingredientId) ?? 0) + m.delta);
    if (running.get(m.ingredientId)! < -0.005) { fail(`${m.ingredientId}: stock goes negative at ${m.at}`); running.set(m.ingredientId, 0); }
  }
  for (const i of ds.inventory.ingredients) if (!near(running.get(i.id) ?? 0, i.onHand, 0.01)) fail(`${i.id}: replayed level ${running.get(i.id)} ≠ ${i.onHand}`);
  for (const l of ds.manifest.inventoryLevels) { const i = ds.inventory.ingredients.find((x) => x.id === l.id); if (!i || !near(i.onHand, l.onHand)) fail(`manifest level for ${l.id} disagrees`); }

  // ── Analytics follow the orders ──
  for (const d of ds.analytics.days) {
    const kept = ds.orders.filter((o) => o.status !== 'CANCELLED' && dayIST(o.createdAt) === d.date);
    if (d.orders !== kept.length) fail(`analytics ${d.date}: orders ${d.orders} ≠ ${kept.length}`);
    if (d.revenue !== kept.reduce((s, o) => s + o.total, 0)) fail(`analytics ${d.date}: revenue disagrees`);
    if (!(d.sessions >= d.productViews / 4 && d.productViews >= d.addToCart && d.addToCart >= d.checkoutStarted && d.checkoutStarted >= d.orders)) fail(`analytics ${d.date}: funnel not monotonic`);
  }

  // ── Campaigns ──
  for (const c of ds.campaigns) {
    let revenue = 0;
    for (const id of c.attributedOrderIds) {
      const o = byOrder.get(id);
      if (!o) { fail(`${c.id}: unknown order ${id}`); continue; }
      if (o.createdAt < c.start || o.createdAt > c.end) fail(`${c.id}: ${id} outside the campaign window`);
      const lines = o.items.filter((l) => c.featuredProductIds.includes(l.product.id));
      if (!lines.length) fail(`${c.id}: ${id} has no featured product`);
      revenue += lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
    }
    if (revenue !== c.attributedRevenue) fail(`${c.id}: attributed revenue ${c.attributedRevenue} ≠ ${revenue}`);
    for (const p of c.featuredProductIds) if (!productIds.has(p)) fail(`${c.id}: unknown product ${p}`);
  }

  // ── Manifest ──
  for (const id of ds.manifest.liveOrderIds) if (!orderIds.has(id)) fail(`manifest: unknown live order ${id}`);
  if (ds.manifest.counts.orders !== ds.orders.length) fail('manifest: order count disagrees');
  void refundIds;

  return {
    problems,
    stats: {
      orders: ds.orders.length, customers: ds.customers.length, products: ds.products.length, customCakes: ds.customCakes.length, payments: ds.payments.length,
      refunds: refundList.length, invoices: ds.invoices.length, issues: ds.issues.length, notifications: ds.notifications.length, jobs: ds.automations.jobs.length,
      movements: ds.inventory.movements.length, campaigns: ds.campaigns.length, staff: ds.staff.length,
    },
  };
}

/** Calendar day in India for an ISO timestamp. */
export function dayIST(isoTime: string): string {
  return new Date(new Date(isoTime).getTime() + 330 * 60000).toISOString().slice(0, 10);
}
