'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { MapPin, Store } from 'lucide-react';
import Link from 'next/link';
import { OrderMissing } from '@/components/order/order-missing';
import { useNow, useOrder } from '@/components/order/use-order';
import { site } from '@/data/site';
import { formatPrice } from '@/lib/format';
import { advanceOrder, currentStatus, etaLabel, statusCopy } from '@/lib/orders/orders';
import { OrderState } from './order-state';

const IS_DEV = process.env.NODE_ENV === 'development';

export function TrackingView({ id }: { id: string }) {
  const { ready, order, updateOrder } = useOrder(id);
  const now = useNow(1000);

  if (!ready) {
    return (
      <main className="track-page wrap" aria-busy="true">
        <div className="skeleton-line is-wide" />
        <div className="track-layout">
          <div>{[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton-row" />)}</div>
          <div className="skeleton-card" />
        </div>
      </main>
    );
  }
  if (!order) return <OrderMissing id={id} />;

  const status = currentStatus(order, now);
  const copy = statusCopy(status, order.fulfilment);
  const done = status === 'DELIVERED';

  return (
    <main className="track-page wrap">
      <div className="eyebrow">07 / Live order</div>
      <h1 className="page-title display">{done ? 'Enjoy every bite.' : 'Your order is moving.'}</h1>
      <div className="track-status-line" aria-live="polite">
        <span>#{order.id}</span>
        <span aria-hidden="true">·</span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={status} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
            {copy.label}
          </motion.span>
        </AnimatePresence>
      </div>

      <div className="track-layout">
        <div>
          <OrderState order={order} status={status} />
          {order.demoTimeline && !done && <p className="demo-note">Prototype timeline: this order moves faster than a real one would.</p>}
          {IS_DEV && !done && (
            <button type="button" className="btn btn-ghost btn-sm dev-advance" onClick={() => updateOrder(order.id, (o) => advanceOrder(o, Date.now()))}>
              Dev: skip to next step
            </button>
          )}
        </div>

        <aside className="track-card">
          <div className="eyebrow">{order.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'}</div>
          <div className="track-address">
            {order.fulfilment === 'pickup'
              ? <><Store size={16} strokeWidth={1.4} /> <span className="display">Tresor, {site.neighbourhood}<br />{site.city}</span></>
              : <><MapPin size={16} strokeWidth={1.4} /> <span className="display">{order.address?.line}<br />{order.address?.area} {order.address?.pin}</span></>}
          </div>
          <div className="eyebrow track-eta-label">{done ? 'Status' : order.slot.kind === 'asap' ? (order.fulfilment === 'pickup' ? 'Ready in' : 'Arriving in') : 'Window'}</div>
          <div className="track-time display">{etaLabel(order, now)}</div>
          <p className="track-summary">{order.totals.itemCount} {order.totals.itemCount === 1 ? 'item' : 'items'} · {formatPrice(order.totals.total)}{order.boxNote ? ` · Box note: “${order.boxNote}”` : ''}</p>
          <Link href={`/order/${order.id}`} className="btn btn-secondary btn-sm">View order details</Link>
        </aside>
      </div>
    </main>
  );
}
