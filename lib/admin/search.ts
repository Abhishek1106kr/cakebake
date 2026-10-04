// Global admin search. Local and synchronous today (an index over what's in the
// browser); the result shape is what a server search endpoint would return, so the
// palette doesn't change when search moves server-side. Results respect permissions:
// customer details are only matched for staff allowed to see them.

import type { Order } from '@/lib/orders';
import type { Ingredient } from '@/lib/inventory';
import type { Invoice } from '@/lib/automation/automation';
import type { AuditRecord } from './audit';
import type { AttentionItem } from './attention';
import type { Customer } from './customers';
import type { ProductRecord } from './catalog';
import type { Campaign } from './marketing';
import { can, type Permission, type Staff } from './permissions';

export type SearchType = 'order' | 'customer' | 'product' | 'ingredient' | 'customCake' | 'invoice' | 'campaign' | 'notification' | 'audit';
export type SearchResult = { type: SearchType; id: string; title: string; subtitle: string; href: string; score: number };

export const TYPE_LABEL: Record<SearchType, string> = {
  order: 'Order', customer: 'Customer', product: 'Product', ingredient: 'Ingredient', customCake: 'Custom cake', invoice: 'Invoice', campaign: 'Campaign', notification: 'Notification', audit: 'Audit',
};

const NEEDS: Record<SearchType, Permission> = {
  order: 'orders.view', customer: 'customers.view', product: 'products.view', ingredient: 'inventory.view', customCake: 'customCakes.view',
  invoice: 'invoices.view', campaign: 'campaigns.view', notification: 'overview.view', audit: 'audit.view',
};

export type SearchData = {
  orders: Order[]; customers: Customer[]; catalog: ProductRecord[]; inventory: Ingredient[]; invoices: Record<string, Invoice>;
  campaigns: Campaign[]; audit: AuditRecord[]; attention: AttentionItem[];
};

/** 3 exact, 2 starts-with, 1 contains, 0 no match. */
function score(hay: string, q: string): number {
  const h = hay.toLowerCase();
  if (!h) return 0;
  if (h === q) return 3;
  if (h.startsWith(q)) return 2;
  return h.includes(q) ? 1 : 0;
}

export function adminSearch(query: string, data: SearchData, staff: Staff | null, limit = 30): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const digits = q.replace(/\D/g, '');
  const pii = can(staff, 'customers.pii');
  const out: SearchResult[] = [];
  const push = (r: SearchResult) => { if (r.score > 0 && can(staff, NEEDS[r.type])) out.push(r); };

  for (const o of data.orders) {
    const s = Math.max(score(o.id, q) * 2, score(o.customer.name, q), pii && digits.length >= 4 && o.customer.phone.includes(digits) ? 2 : 0, pii ? score(o.customer.email, q) : 0, ...o.items.map((l) => score(l.product.name, q) * 0.5));
    push({ type: 'order', id: o.id, title: o.id, subtitle: `${o.customer.name} · ₹${o.total.toLocaleString('en-IN')} · ${o.status.toLowerCase().replace(/_/g, ' ')}`, href: `/admin/orders/${o.id}`, score: s });
    for (const l of o.items) if (l.custom) {
      const cs = Math.max(score(o.id, q) * 1.5, score(l.custom.designId, q) * 2, score(l.custom.title, q));
      push({ type: 'customCake', id: `${o.id}:${l.lineId}`, title: l.custom.title, subtitle: `${o.id} · ${l.custom.designId} · ${o.slot}`, href: `/admin/custom-cakes?order=${o.id}`, score: cs });
    }
    const inv = data.invoices[o.id];
    if (inv) push({ type: 'invoice', id: inv.invoiceNumber, title: inv.invoiceNumber, subtitle: `${o.id} · ₹${inv.total.toLocaleString('en-IN')}`, href: `/admin/invoices?order=${o.id}`, score: Math.max(score(inv.invoiceNumber, q) * 2, score(o.id, q) * 1.2) });
  }
  for (const c of data.customers) {
    const s = Math.max(score(c.name, q), pii && digits.length >= 4 && c.id.includes(digits) ? 2 : 0, pii ? score(c.email, q) : 0, c.orders.some((o) => o.id.toLowerCase() === q) ? 1.5 : 0);
    push({ type: 'customer', id: c.id, title: c.name, subtitle: `${c.orderCount} order${c.orderCount === 1 ? '' : 's'} · ₹${c.totalSpend.toLocaleString('en-IN')}`, href: `/admin/customers?c=${encodeURIComponent(c.id)}`, score: s });
  }
  for (const p of data.catalog) push({ type: 'product', id: p.id, title: p.name, subtitle: `${p.category} · ₹${p.price} · ${p.status.toLowerCase()}`, href: `/admin/products?p=${p.id}`, score: Math.max(score(p.name, q) * 1.5, score(p.id, q), ...p.tags.map((t) => score(t, q) * 0.5)) });
  for (const i of data.inventory) push({ type: 'ingredient', id: i.id, title: i.name, subtitle: `${i.onHand} ${i.unit} on hand · ${i.area}`, href: `/admin/inventory?item=${i.id}`, score: Math.max(score(i.name, q) * 1.5, score(i.id, q)) });
  for (const c of data.campaigns) push({ type: 'campaign', id: c.id, title: c.name || 'Untitled campaign', subtitle: `${c.status.toLowerCase()} · ${new Date(c.start).toLocaleDateString('en-IN')}`, href: `/admin/campaigns?c=${c.id}`, score: score(c.name, q) * 1.5 });
  for (const a of data.attention) push({ type: 'notification', id: a.id, title: a.title, subtitle: a.detail, href: a.href, score: Math.max(score(a.entityId, q) * 1.2, score(a.title, q) * 0.8) });
  for (const r of data.audit.slice(-500)) push({ type: 'audit', id: r.id, title: r.action, subtitle: `${r.entity.label ?? r.entity.id} · ${r.actor.name} · ${new Date(r.at).toLocaleString('en-IN')}`, href: `/admin/audit?q=${encodeURIComponent(r.entity.id)}`, score: Math.max(score(r.entity.id, q), score(r.entity.label ?? '', q)) * 0.9 });

  return out.sort((a, b) => b.score - a.score || a.type.localeCompare(b.type)).slice(0, limit);
}
