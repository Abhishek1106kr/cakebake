'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { AnimatedNumber } from '@/components/motion/animated-number';
import { Magnetic } from '@/components/motion/magnetic';
import { formatPrice } from '@/lib/format';
import { CONFIRMATION } from '@/lib/motion/choreography';
import { EASE } from '@/lib/motion/transitions';
import { leadMinutes } from '@/lib/delivery/slots';
import { paymentLabels } from '@/lib/orders/payment';
import { OrderMissing } from './order-missing';
import { useOrder } from './use-order';

function partOfDay(epoch: number): 'morning' | 'afternoon' | 'evening' {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(new Date(epoch)));
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export function ConfirmationView({ id }: { id: string }) {
  const reduce = useReducedMotion();
  const { ready, order } = useOrder(id);

  if (!ready) return <main className="confirm-shell"><div className="confirm-card skeleton-card" aria-busy="true" /></main>;
  if (!order) return <OrderMissing id={id} />;

  const when = order.slot.kind === 'window' ? order.slot.startsAt : order.createdAt;
  const rise = (delay: number) => (reduce ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.7, ease: EASE } });
  const etaMinutes = leadMinutes(order.prepMinutes, order.fulfilment);
  const paymentLine = order.payment.status === 'PAID'
    ? `Paid by ${paymentLabels[order.payment.method]} · simulated`
    : `${order.fulfilment === 'pickup' ? 'Pay at the counter' : 'Pay at the door'} · ${formatPrice(order.totals.total)}`;

  return (
    <main className="confirm-shell">
      <motion.div className="confirm-card" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
        <svg className="confirm-ring" viewBox="0 0 120 120" aria-hidden="true">
          <motion.circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="0.8" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ delay: CONFIRMATION.ring, duration: 1.4, ease: EASE }} />
          <motion.path d="M44 61l11 10 22-24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ delay: CONFIRMATION.ring + 0.9, duration: 0.5, ease: EASE }} />
        </svg>

        <motion.div className="order-code" {...rise(CONFIRMATION.orderNumber)}>#{order.id}</motion.div>
        <motion.div className="eyebrow eyebrow-light" {...rise(CONFIRMATION.orderNumber + 0.05)}>Order confirmed</motion.div>
        <motion.h1 className="confirm-title display" {...rise(CONFIRMATION.headline)}>
          You&rsquo;re going to have<br />a very good {partOfDay(when)}.
        </motion.h1>

        <motion.div className="confirm-badges" {...rise(CONFIRMATION.badge)}>
          <span className="status-pill"><span className="breathing-dot" aria-hidden="true" /> Kitchen has your ticket</span>
          <span className="status-pill is-quiet">{paymentLine}</span>
        </motion.div>

        <motion.div className="confirm-eta" {...rise(CONFIRMATION.eta)}>
          {order.slot.kind === 'asap' ? (
            <>
              <span className="eyebrow eyebrow-light">{order.fulfilment === 'pickup' ? 'Ready in about' : 'Arriving in about'}</span>
              <span className="eta-number display"><AnimatedNumber value={etaMinutes} duration={0.9} /> min</span>
            </>
          ) : (
            <>
              <span className="eyebrow eyebrow-light">{order.fulfilment === 'pickup' ? 'Ready for pickup' : 'Arriving'}</span>
              <span className="eta-number display">{order.slot.label}</span>
            </>
          )}
        </motion.div>

        <motion.div className="confirm-actions" {...rise(CONFIRMATION.cta)}>
          <Magnetic><Link href={`/track/${order.id}`} className="btn btn-light">Track order <ArrowRight size={14} strokeWidth={1.5} /></Link></Magnetic>
          <Link href="/menu" className="btn btn-ghost on-dark">Back to menu</Link>
        </motion.div>

        <motion.ul className="confirm-items" {...rise(CONFIRMATION.cta + 0.1)} aria-label="Items">
          {order.items.map((item) => (
            <li key={`${item.slug}-${item.size}`}><span>{item.qty} × {item.name}{item.size === 'large' ? ' (Large)' : ''}</span><span className="tabular">{formatPrice(item.unitPrice * item.qty)}</span></li>
          ))}
          <li className="confirm-total"><span>Total</span><span className="tabular">{formatPrice(order.totals.total)}</span></li>
        </motion.ul>
      </motion.div>
    </main>
  );
}
