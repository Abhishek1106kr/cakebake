'use client';

import type { Invoice } from '@/lib/automation/automation';
import type { Order } from '@/lib/orders';
import { invoiceHtml, regenerateInvoice } from '@/lib/admin/invoices';
import { downloadText } from '@/lib/admin/csv';
import { emitDomain } from '@/lib/admin/domain-events';
import { useAdmin } from './admin-provider';

export function useInvoiceActions() {
  const admin = useAdmin();
  const business = () => ({ name: String(admin.settings?.['business.name'] ?? 'Tresor Bakery'), address: String(admin.settings?.['business.address'] ?? ''), email: String(admin.settings?.['business.email'] ?? '') });

  const download = (inv: Invoice) => downloadText(`${inv.invoiceNumber}${(inv.revision ?? 1) > 1 ? `-r${inv.revision}` : ''}.html`, invoiceHtml(inv, business()), 'text/html;charset=utf-8');

  const view = (inv: Invoice) => {
    const w = window.open('', '_blank', 'noopener,width=820,height=900');
    if (!w) { download(inv); return; }
    w.document.write(invoiceHtml(inv, business()));
    w.document.close();
  };

  /** Same number, new revision, rebuilt from the order's snapshot. Confirmed, with a reason, and audited. */
  const regenerate = async (order: Order) => {
    const previous = admin.automation.invoices[order.id] ?? null;
    const r = await admin.confirm({
      title: `Regenerate the invoice for ${order.id}?`,
      impact: [
        `Keeps the number ${previous?.invoiceNumber ?? `INV-${order.id.replace(/\D/g, '')}`}; adds revision ${(previous?.revision ?? (previous ? 1 : 0)) + 1}.`,
        'Lines and totals come from the order as it was placed (its snapshot), not today’s prices.',
        'Uses the current tax and business details for the new revision; earlier revisions keep theirs.',
      ],
      confirmLabel: 'Regenerate invoice', tone: 'primary', reason: 'required',
    });
    if (!r.ok) return;
    const next = regenerateInvoice(order, previous, admin.staff?.name ?? 'Unknown', r.reason);
    admin.act({
      permission: 'invoices.regenerate', action: 'invoice.regenerated', entity: { type: 'invoice', id: next.invoiceNumber, label: order.id },
      before: previous ? { revision: previous.revision ?? 1, total: previous.total } : null, after: { revision: next.revision, total: next.total }, reason: r.reason,
      run: () => { admin.repos!.invoices.save(next); emitDomain('invoice.regenerated', order.id, { revision: next.revision ?? 1 }); },
      success: `${next.invoiceNumber} regenerated (revision ${next.revision})`,
    });
  };

  return { download, view, regenerate };
}
