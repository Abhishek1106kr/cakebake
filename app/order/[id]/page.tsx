'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useStore } from '@/components/store';
import { Magnetic } from '@/components/motion';
import { CONFIRM, EASE } from '@/lib/motion';

function partOfDay(iso: string) {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(new Date(iso)));
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

export default function OrderPage() {
  const params = useParams<{ id: string }>();
  const reduce = useReducedMotion();
  const { findOrder, ready } = useStore();
  const order = findOrder(decodeURIComponent(params.id));
  const rise = (delay: number) => (reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.7, ease: EASE } });

  if (!ready) return <main className="page"><div className="center-card" aria-busy="true" style={{ minHeight: 360 }} /></main>;
  if (!order) return <main className="page"><div className="center-card"><div className="eyebrow">ORDER #{params.id}</div><h1 className="font-display">We couldn’t find that order on this device.</h1><p className="muted" style={{ marginTop: 18 }}>Orders are kept in the browser they were placed from.</p><div className="order-actions"><Link href="/account" className="btn btn-primary">YOUR ORDERS</Link><Link href="/menu" className="btn btn-secondary">BACK TO MENU</Link></div></div></main>;

  const paid = order.payment.status === 'PAID';
  return <main className="page"><div className="center-card confirm">
    <svg className="confirm-ring" viewBox="0 0 120 120" aria-hidden="true">
      <motion.circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="0.8" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ delay: CONFIRM.ring, duration: 1.3, ease: EASE }} />
      <motion.path d="M44 61l11 10 22-24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ delay: CONFIRM.ring + 0.85, duration: 0.45, ease: EASE }} />
    </svg>
    <motion.div className="eyebrow" {...rise(CONFIRM.code)}>ORDER CONFIRMED</motion.div>
    <motion.h1 className="font-display" {...rise(CONFIRM.headline)}>You’re going to have<br/>a very good {partOfDay(order.createdAt)}.</motion.h1>
    <motion.div className="order-code" {...rise(CONFIRM.code + 0.05)}>#{order.id}</motion.div>
    <motion.div className="confirm-badges" {...rise(CONFIRM.badge)}>
      <span className="status-pill"><span className="breathing-dot" aria-hidden="true" /> The bakery has your ticket</span>
      <span className="status-pill quiet">{paid ? `Paid by ${order.payment.method} · simulated` : `Pay ₹${order.total.toLocaleString('en-IN')} at the door`}</span>
    </motion.div>
    <motion.div style={{ marginTop: 26, color:'var(--muted)', fontSize: 13 }} {...rise(CONFIRM.eta)}>Arriving · {order.slot}</motion.div>
    <motion.div className="order-actions" {...rise(CONFIRM.cta)}><Magnetic><Link href={`/track/${order.id}`} className="btn btn-primary">TRACK ORDER <ArrowRight size={14}/></Link></Magnetic><Link href="/menu" className="btn btn-secondary">BACK TO MENU</Link></motion.div>
    <motion.ul className="confirm-items" {...rise(CONFIRM.cta + 0.1)}>
      {order.items.map((i) => <li key={i.slug}><span>{i.quantity} × {i.name}</span><span>₹{i.price * i.quantity}</span></li>)}
      <li className="total"><span>Total</span><span>₹{order.total.toLocaleString('en-IN')}</span></li>
    </motion.ul>
  </div></main>;
}
