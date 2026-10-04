'use client';

import { useStore } from '@/components/store-provider';
import { NEXT_ACTION, STATUS_LABEL, nextStatus, type Order, type OrderStatus } from '@/lib/orders';
import { BULK_TARGET, bulkPlan, cancelImpact, type BulkAction } from '@/lib/admin/order-ops';
import { formatQty } from '@/lib/inventory';
import type { Permission } from '@/lib/admin/permissions';
import { useAdmin } from './admin-provider';
import { rupees } from './ui';

/** Status changes, cancellations, refunds and bulk steps: confirmed when destructive, permission-checked, audited, announced. */
export function useOrderActions() {
  const store = useStore();
  const admin = useAdmin();

  const move = (o: Order, to: OrderStatus, permission: Permission = 'orders.update', source: 'admin-ui' | 'bulk' = 'admin-ui') => admin.act({
    permission, action: 'order.status.changed', entity: { type: 'order', id: o.id, label: o.customer.name },
    before: { status: o.status }, after: { status: to }, source,
    run: () => store.transition(o.id, to) || `${o.id} can’t go from ${STATUS_LABEL[o.status].toLowerCase()} to ${STATUS_LABEL[to].toLowerCase()}.`,
    success: `${o.id} · ${STATUS_LABEL[to]}`, quiet: source === 'bulk',
  });

  const advance = (o: Order, permission: Permission = 'orders.update') => {
    const to = nextStatus(o.status);
    if (!to) return { ok: false as const, reason: 'Nothing comes after this status.' };
    const r = move(o, to, permission);
    if (r.ok) admin.announce(`${o.id} is now ${STATUS_LABEL[to].toLowerCase()}.`);
    return r;
  };

  const cancel = async (o: Order) => {
    const impact = cancelImpact(o, store.inventory);
    if (!impact.allowed) { admin.toast({ tone: 'error', title: 'Can’t cancel', detail: `${o.id} is ${STATUS_LABEL[o.status].toLowerCase()}. Orders can be cancelled until they leave with the rider.` }); return; }
    const lines = [
      impact.restoresStock
        ? `Stock goes back on the shelf: ${impact.ingredients.slice(0, 4).map((i) => `${formatQty(i.amount, i.unit as 'kg')} ${i.name.toLowerCase()}`).join(', ')}${impact.ingredients.length > 4 ? ` and ${impact.ingredients.length - 4} more` : ''}.`
        : 'Stock is not restored: the kitchen has already started.',
      impact.payment,
      'The customer’s tracking page shows the cancellation and a WhatsApp update is sent (simulated).',
    ];
    const r = await admin.confirm({ title: `Cancel order ${o.id}?`, body: <>{o.customer.name} · {rupees(o.total)} · {STATUS_LABEL[o.status]}</>, impact: lines, confirmLabel: 'Cancel order', tone: 'danger', reason: 'required' });
    if (!r.ok) return;
    admin.act({
      permission: 'orders.cancel', action: 'order.cancelled', entity: { type: 'order', id: o.id, label: o.customer.name },
      before: { status: o.status, paymentStatus: o.paymentStatus }, after: { status: 'CANCELLED', stockRestored: impact.restoresStock }, reason: r.reason,
      run: () => store.transition(o.id, 'CANCELLED') || `${o.id} can’t be cancelled any more.`, success: `${o.id} cancelled`,
    });
  };

  const refund = async (o: Order) => {
    const r = await admin.confirm({
      title: `Mark the refund for ${o.id} as completed?`, impact: [`Records that ${rupees(o.total)} (${o.paymentMethod}) was returned to the customer.`, 'Payments are simulated: no money moves from here.'],
      confirmLabel: 'Mark refunded', tone: 'primary', reason: 'required',
    });
    if (!r.ok) return;
    admin.act({
      permission: 'finance.refund', action: 'order.refunded', entity: { type: 'order', id: o.id }, before: { paymentStatus: o.paymentStatus }, after: { paymentStatus: 'REFUNDED' }, reason: r.reason,
      run: () => store.refund(o.id) || 'There is no pending refund on this order.', success: `Refund recorded for ${o.id}`,
    });
  };

  const bulk = async (ids: string[], action: BulkAction) => {
    const plan = bulkPlan(store.orders, ids, action);
    const { label, to } = BULK_TARGET[action];
    if (!plan.apply.length) { admin.toast({ tone: 'warning', title: `Nothing to ${label.toLowerCase()}`, detail: plan.skipped.slice(0, 4).map((s) => `${s.id} ${s.reason}`).join('; ') }); return; }
    const r = await admin.confirm({
      title: `${label} ${plan.apply.length} order${plan.apply.length === 1 ? '' : 's'}?`, confirmLabel: label, tone: 'primary',
      impact: [`${plan.apply.join(', ')} → ${STATUS_LABEL[to]}.`, ...(plan.skipped.length ? [`Skipped: ${plan.skipped.map((s) => `${s.id} (${s.reason})`).join(', ')}.`] : []), 'Each customer gets the same update as a single change.'],
    });
    if (!r.ok) return;
    let done = 0;
    for (const id of plan.apply) { const o = store.orders.find((x) => x.id === id); if (o && move(o, to, 'orders.update', 'bulk').ok) done += 1; }
    admin.toast({ tone: done === plan.apply.length ? 'success' : 'warning', title: `${done} of ${plan.apply.length} moved to ${STATUS_LABEL[to].toLowerCase()}` });
  };

  return { advance, cancel, refund, bulk, move };
}

/** The row's primary action. First `.btn-sm` in an order row by design (the stress harness relies on it). */
export function AdvanceButton({ order, permission = 'orders.update', compact }: { order: Order; permission?: Permission; compact?: boolean }) {
  const { advance } = useOrderActions();
  const { can } = useAdmin();
  const label = NEXT_ACTION[order.status];
  if (!label || !can(permission)) return null;
  return <button type="button" className={`ad-btn ad-btn-sm btn-sm ${order.status === 'NEW' ? 'ad-btn-primary' : ''}`} onClick={() => advance(order, permission)} aria-label={compact ? `${label} ${order.id}` : undefined}>{label}</button>;
}
