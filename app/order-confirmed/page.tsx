'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { ArrowRight, CheckCircle2, Copy, MapPin, MessageCircle, Sparkles } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { STATUS_LABEL, nextStatus } from '@/lib/orders';
import { motion } from 'framer-motion';
import { EASE } from '@/lib/motion';
import { useAutomation } from '@/components/use-automation';
import { maskPhone } from '@/lib/automation/automation';

const up = (delay: number) => ({ initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.7, ease: EASE } });

function OrderConfirmed() {
  const { findOrder, latestOrder, mounted } = useStore();
  const search = useSearchParams();
  const [copied, setCopied] = useState(false);
  const requested = search.get('id');
  const order = requested ? findOrder(requested) : latestOrder;
  const { jobs, invoices } = useAutomation();

  if (!mounted) return <main className="page"><div className="container page-loader" /></main>;
  if (!order) {
    return <main className="status-page"><div className="container"><div className="order-card empty-state"><div className="eyebrow">Order {requested ?? ''}</div><h1 className="display h3">We couldn’t find that order.</h1><p className="muted">Orders are kept in the browser they were placed from.</p><Link className="btn btn-brand" href="/shop">Browse menu</Link></div></div></main>;
  }

  const copy = async () => { try { await navigator.clipboard.writeText(order.id); setCopied(true); setTimeout(()=>setCopied(false), 1200); } catch {} };
  const upcoming = nextStatus(order.status);
  return <main className="status-page success-page"><div className="container">
    <motion.div className="success-orbit" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 14 }}>
      <svg className="success-ring" viewBox="0 0 120 120" aria-hidden="true"><motion.circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="1" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.2, duration: 1.2, ease: EASE }} /></svg>
      <motion.div className="success-check" initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.35, type: 'spring', stiffness: 260, damping: 12 }}><CheckCircle2 size={45}/></motion.div>
    </motion.div>
    <motion.div className="order-card success-card" {...up(0.25)}>
      <motion.div className="eyebrow" {...up(0.45)}>Order confirmed</motion.div>
      <motion.h1 className="display h2" {...up(0.55)}>We’ve got it.</motion.h1>
      <motion.p className="success-copy" {...up(0.65)}>Order <strong>{order.id}</strong> is confirmed. We’ll keep you posted as it moves from counter to door.</motion.p>
      <motion.div className="order-id" {...up(0.75)}><span>Order ID</span><strong>{order.id}</strong><button onClick={copy} aria-label="Copy order ID">{copied ? <CheckCircle2 size={16}/> : <Copy size={16}/>}</button></motion.div>
      <motion.p className="small muted automation-status" {...up(0.8)} data-testid="automation-status">
        {(() => {
          const inv = invoices[order.id];
          const wa = jobs.find((j) => j.id === `whatsapp:${order.id}:confirmation`);
          const invoiceText = inv ? `Invoice ${inv.invoiceNumber} is ready.` : 'Preparing your invoice…';
          const waText = wa?.status === 'succeeded' ? `Confirmation sent on WhatsApp to ${maskPhone(order.customer.phone)} (simulated).` : wa?.status === 'failed' ? 'We couldn’t send the WhatsApp confirmation yet; your order is safe.' : 'Sending your WhatsApp confirmation…';
          return `${invoiceText} ${waText}`;
        })()}
      </motion.p>
      <motion.div className="success-actions" {...up(0.85)}><Link className="btn btn-brand btn-lg" href={`/track/${order.id}` as Route}>Track my order <ArrowRight size={16}/></Link><Link className="btn btn-secondary btn-lg" href="/shop">Order something else</Link></motion.div>
      <motion.div className="quick-status" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1, delayChildren: 1.0 } } }}>
        {[[<MapPin key="m" size={18}/>, 'Delivery to', order.city], [<Sparkles key="s" size={18}/>, 'Next update', upcoming ? STATUS_LABEL[upcoming] : STATUS_LABEL[order.status]], [<MessageCircle key="c" size={18}/>, 'Payment', order.paymentStatus === 'DUE' ? `₹${order.total} at the door` : `₹${order.total} paid (simulated)`]].map(([icon, label, value]) => (
          <motion.div key={String(label)} variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } }}>{icon}<span>{label}<br/><strong>{value}</strong></span></motion.div>
        ))}
      </motion.div>
    </motion.div>
  </div></main>;
}

export default function OrderConfirmedPage() {
  return <Suspense fallback={<main className="page"><div className="container page-loader" /></main>}><OrderConfirmed /></Suspense>;
}
