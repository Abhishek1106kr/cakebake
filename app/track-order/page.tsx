'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock3, MapPin, MessageCircle, XCircle } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { STATUS_FLOW, STATUS_LABEL, itemsSummary, statusTime } from '@/lib/orders';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE } from '@/lib/motion';

const time = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '');

function TrackOrder() {
  const { latestOrder, findOrder, mounted } = useStore();
  const search = useSearchParams();
  const router = useRouter();
  const [lookup, setLookup] = useState('');
  const requested = search.get('id');
  const order = requested ? findOrder(requested.toUpperCase()) : latestOrder;

  const lookupForm = (
    <form className="track-lookup" onSubmit={(e) => { e.preventDefault(); if (lookup.trim()) router.push(`/track-order?id=${encodeURIComponent(lookup.trim().toUpperCase())}`); }}>
      <label htmlFor="track-id" className="sr-only">Order ID</label>
      <input id="track-id" placeholder="Track another order, e.g. TRS-1042" value={lookup} onChange={(e) => setLookup(e.target.value)} />
      <button className="btn btn-secondary" type="submit">Track</button>
    </form>
  );

  if (!mounted) return <main className="page"><div className="container page-loader"/></main>;
  if (!order) return <main className="status-page"><div className="container"><div className="order-card empty-state"><Clock3 size={28}/><div className="eyebrow">Track order</div><h1 className="display h3">{requested ? `We couldn’t find ${requested}.` : 'No live order yet.'}</h1><p className="muted">{requested ? 'Orders are kept in the browser they were placed from.' : 'Place an order and the timeline will light up here.'}</p><Link className="btn btn-brand" href="/shop">Browse menu</Link>{lookupForm}</div></div></main>;

  const cancelled = order.status === 'CANCELLED';
  const currentIndex = Math.max(0, STATUS_FLOW.indexOf(order.status));
  return (
    <main className="status-page track-page">
      <div className="container">
        <Link className="back-link" href="/"> <ArrowLeft size={14}/> Back home</Link>
        <motion.div className="order-card" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
          <div className="track-head">
            <div><div className="eyebrow">{cancelled ? 'Order cancelled' : 'Live order'}</div><h1 className="display h3">#{order.id}</h1><p className="muted">{order.slot} · {order.address}</p></div>
            <motion.span key={order.status} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }} className={cancelled ? 'status-cancelled' : 'status-live'}>{cancelled ? 'Cancelled' : order.status === 'DELIVERED' ? 'Delivered' : 'Kitchen live'}</motion.span>
          </div>
          {cancelled ? (
            <div className="cancel-note"><XCircle size={20}/><div><strong>This order was cancelled at {time(statusTime(order, 'CANCELLED'))}.</strong><p className="muted">{order.paymentStatus === 'REFUNDED' ? `₹${order.total} will be refunded to your ${order.paymentMethod} (simulated).` : 'Nothing was charged.'}</p></div></div>
          ) : (
            <motion.div className="timeline" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.09, delayChildren: 0.2 } } }}>
              {STATUS_FLOW.map((key, index) => (
                <motion.div layout variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } }} className={`timeline-step ${index < currentIndex ? 'done' : ''} ${index === currentIndex ? 'active' : ''}`} key={key}>
                  <div className="timeline-dot" style={{ position: 'relative' }}>{index === currentIndex && order.status !== 'DELIVERED' && <span className="pulse-ring" aria-hidden="true" />}<AnimatePresence mode="wait" initial={false}><motion.span key={index < currentIndex ? 'done' : index === currentIndex ? 'now' : 'next'} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }} style={{ display: 'grid' }}>{index < currentIndex ? <CheckCircle2 size={14}/> : index === currentIndex ? <Clock3 size={14}/> : null}</motion.span></AnimatePresence></div>
                  <div><strong>{STATUS_LABEL[key]}</strong><small>{index <= currentIndex ? time(statusTime(order, key)) || 'Done' : 'Queued'}</small></div>
                </motion.div>
              ))}
            </motion.div>
          )}
          <p className="small muted track-items">{itemsSummary(order)} · ₹{order.total}</p>
          <div className="track-panels"><div className="track-info"><MapPin size={18}/><div><span>Delivering to</span><strong>{order.city} · {order.pin}</strong></div></div><div className="track-info"><MessageCircle size={18}/><div><span>Need help?</span><strong>Chat with Tresor</strong></div></div></div>
          {lookupForm}
        </motion.div>
      </div>
    </main>
  );
}

export default function TrackOrderPage() {
  return <Suspense fallback={<main className="page"><div className="container page-loader"/></main>}><TrackOrder /></Suspense>;
}
