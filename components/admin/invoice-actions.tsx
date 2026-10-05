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

  // Opens the invoice as its own page. (window.open with 'noopener' returns null, so writing
  // into the new window never worked and every View fell back to a download.)
  const view = (inv: Invoice) => {
    const url = URL.createObjectURL(new Blob([invoiceHtml(inv, business())], { type: 'text/html;charset=utf-8' }));
    window.open(url, '_blank', 'noopener');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  /** Same number, new revision, rebuilt from the order's snapshot. Confirmed, with a reason, and audited. */
  const regenerate = async (order: Order) => {
    const previous = admin.automation.invoices[order.id] ?? null;
    const number = previous?.invoiceNumber ?? `INV-${order.id.replace(/\D/g, '')}`;
    // First issue and later revisions read differently: there is nothing to regenerate yet.
    const r = await admin.confirm(previous ? {
      title: `Regenerate the invoice for ${order.id}?`,
      impact: [
        `Keeps the number ${number}; adds revision ${(previous.revision ?? 1) + 1}.`,
        'Lines and totals come from the order as it was placed (its snapshot), not today’s prices.',
        'Uses the current tax and business details for the new revision; earlier revisions keep theirs.',
      ],
      confirmLabel: 'Regenerate invoice', tone: 'primary', reason: 'required',
    } : {
      title: `Generate the invoice for ${order.id}?`,
      impact: [
        `Issues ${number} (revision 1).`,
        'Lines and totals come from the order as it was placed (its snapshot), not today’s prices.',
        'Uses the current tax and business details.',
      ],
      confirmLabel: 'Generate invoice', tone: 'primary', reason: 'optional',
    });
    if (!r.ok) return;
    const next = regenerateInvoice(order, previous, admin.staff?.name ?? 'Unknown', r.reason);
    admin.act({
      permission: 'invoices.regenerate', action: previous ? 'invoice.regenerated' : 'invoice.generated', entity: { type: 'invoice', id: next.invoiceNumber, label: order.id },
      before: previous ? { revision: previous.revision ?? 1, total: previous.total } : null, after: { revision: next.revision, total: next.total }, reason: r.reason,
      run: () => { admin.repos!.invoices.save(next); emitDomain('invoice.regenerated', order.id, { revision: next.revision ?? 1 }); },
      success: previous ? `${next.invoiceNumber} regenerated (revision ${next.revision})` : `${next.invoiceNumber} issued`,
    });
  };

  return { download, view, regenerate };
}
