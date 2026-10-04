// Invoice management over the automation runner's invoice store. The invoice
// number is fixed by the order (INV-<order number>) and never changes; regenerating
// rebuilds it from the order's own snapshot and records a new revision.

import { buildInvoice, invoiceNumberFor, type Invoice, type Job } from '@/lib/automation/automation';
import type { Order } from '@/lib/orders';

export type InvoiceStatus = 'ISSUED' | 'PENDING' | 'FAILED' | 'NOT_REQUESTED';
export type InvoiceRow = { number: string; order: Order; invoice: Invoice | null; status: InvoiceStatus; job: Job | undefined };

export function invoiceRows(orders: Order[], invoices: Record<string, Invoice>, jobs: Job[]): InvoiceRow[] {
  return orders.map((order) => {
    const invoice = invoices[order.id] ?? null;
    const job = jobs.find((j) => j.id === `invoice:${order.id}:confirmation`);
    const status: InvoiceStatus = invoice ? 'ISSUED' : job?.status === 'failed' ? 'FAILED' : job ? 'PENDING' : 'NOT_REQUESTED';
    return { number: invoice?.invoiceNumber ?? invoiceNumberFor(order.id), order, invoice, status, job };
  }).sort((a, b) => b.order.createdAt.localeCompare(a.order.createdAt));
}

/**
 * A new revision of an order's invoice: same number, rebuilt from the order snapshot
 * (so it matches what was charged), with the reason and who did it recorded.
 */
export function regenerateInvoice(order: Order, previous: Invoice | null, by: string, reason: string, now = new Date()): Invoice {
  const fresh = buildInvoice(order, now);
  const revision = (previous?.revision ?? (previous ? 1 : 0)) + 1;
  const history = [...(previous?.revisions ?? (previous ? [{ revision: previous.revision ?? 1, issuedAt: previous.issuedAt, reason: 'Issued', by: 'System' }] : []))];
  return { ...fresh, invoiceNumber: previous?.invoiceNumber ?? fresh.invoiceNumber, revision, revisions: [...history, { revision, issuedAt: now.toISOString(), reason, by }] };
}

const esc = (s: string | number) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const money = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** A self-contained printable invoice (download as .html, print to PDF from the browser). */
export function invoiceHtml(inv: Invoice, business: { name: string; address: string; email: string }): string {
  const c = inv.customerSnapshot;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(inv.invoiceNumber)}</title>
<style>body{font:14px/1.5 Inter,system-ui,sans-serif;color:#202625;max-width:720px;margin:40px auto;padding:0 20px}h1{font:500 32px Georgia,serif;margin:0}table{width:100%;border-collapse:collapse;margin:24px 0}td,th{padding:8px 0;border-bottom:1px solid #DDE3E1;text-align:left}td:last-child,th:last-child{text-align:right}.muted{color:#687270}.total td{font-weight:700;border-bottom:0}.note{margin-top:32px;padding:12px;background:#F6F8F7;border-radius:8px;font-size:12px}</style></head>
<body><header><h1>${esc(business.name)}</h1><div class="muted">${esc(business.address)}${business.email ? ` · ${esc(business.email)}` : ''}</div></header>
<p><strong>Invoice ${esc(inv.invoiceNumber)}</strong>${(inv.revision ?? 1) > 1 ? ` · revision ${inv.revision}` : ''}<br><span class="muted">Order ${esc(inv.orderId)} · issued ${esc(new Date(inv.issuedAt).toLocaleString('en-IN'))}</span></p>
<p>Billed to<br><strong>${esc(c?.name ?? inv.customer)}</strong>${c ? `<br><span class="muted">${esc(c.address)}, ${esc(c.city)} ${esc(c.pin)}</span>` : ''}</p>
<table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead><tbody>
${inv.lines.map((l) => `<tr><td>${esc(l.description)}${l.detail.length ? `<div class="muted">${l.detail.map(esc).join(' · ')}</div>` : ''}</td><td>${l.qty}</td><td>${money(l.unitPrice)}</td><td>${money(l.amount)}</td></tr>`).join('')}
<tr><td colspan="3">Delivery</td><td>${money(inv.delivery)}</td></tr>
<tr class="total"><td colspan="3">Total</td><td>${money(inv.total)}</td></tr></tbody></table>
<p class="muted">Payment: ${esc(inv.paymentMethod)} · ${esc(inv.paymentStatus.toLowerCase().replace('_', ' '))}${inv.tax && inv.tax.rate > 0 ? `<br>Includes GST ${inv.tax.rate}%: ${money(inv.tax.amount)}${inv.tax.gstin ? ` · GSTIN ${esc(inv.tax.gstin)}` : ''}` : ''}</p>
<div class="note">${esc(inv.note)}</div></body></html>`;
}
