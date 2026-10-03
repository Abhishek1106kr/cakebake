'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useStore } from '@/components/store';
import { STEPS, minutesLeft, stepTime, statusIndexAt } from '@/lib/commerce';
import { EASE } from '@/lib/motion';

export default function TrackPage() {
  const params = useParams<{ id: string }>();
  const reduce = useReducedMotion();
  const { findOrder, ready } = useStore();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const order = findOrder(decodeURIComponent(params.id));

  if (!ready) return <main className="page track-page" aria-busy="true"><div className="track-skeleton" /></main>;
  if (!order) return <main className="page track-page"><div className="eyebrow">07 / LIVE ORDER</div><h1 className="section-title font-display">We couldn’t find #{params.id} on this device.</h1><Link href="/account" className="btn btn-primary" style={{ marginTop: 24 }}>YOUR ORDERS</Link></main>;

  const index = statusIndexAt(order, now);
  const done = index === STEPS.length - 1;
  return <main className="page track-page"><div className="eyebrow">07 / LIVE ORDER</div>
    <h1 className="section-title font-display">{done ? 'Enjoy every bite.' : 'Your order is moving.'}</h1>
    <div className="track-status" aria-live="polite">#{order.id} · <AnimatePresence mode="wait" initial={false}><motion.span key={index} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>{STEPS[index].status}</motion.span></AnimatePresence></div>
    <div className="track-layout"><div className="track-list">
      {STEPS.map((s, i) => (
        <div className={`track-row ${i < index ? 'done' : ''} ${i === index ? 'active' : ''}`} key={s.status} aria-current={i === index ? 'step' : undefined}>
          <div className="track-dot">{i === index && !reduce && !done && <span className="pulse-ring" aria-hidden="true" />}<motion.span layout transition={{ duration: 0.3, ease: EASE }}>{i < index ? <Check size={13} /> : String(i + 1).padStart(2, '0')}</motion.span></div>
          <div className="track-stage">{s.status}</div>
          <div className="track-copy">{i <= index ? `${s.copy} · ${stepTime(order, i)}` : s.copy}</div>
        </div>
      ))}
      <p className="demo-note">Prototype timeline: this order moves faster than a real one would.</p>
    </div>
    <aside className="track-card"><div className="eyebrow">DELIVERY</div>
      <div style={{ fontFamily:'Cormorant Garamond', fontSize:30, lineHeight:1.05, marginTop:16 }}>{order.address}<br/>{order.pin}</div>
      <div className="eyebrow" style={{ marginTop:58 }}>{done ? 'STATUS' : 'ARRIVING IN'}</div>
      <div className="track-time">{done ? 'DELIVERED' : `${minutesLeft(order, now)} MIN`}</div>
      <p className="muted" style={{ fontSize:12, marginTop:16 }}>{order.items.reduce((n, i) => n + i.quantity, 0)} items · ₹{order.total.toLocaleString('en-IN')} · {order.slot}</p>
      <Link href={`/order/${order.id}`} className="btn btn-secondary" style={{ marginTop:22 }}>VIEW ORDER DETAILS</Link>
    </aside></div>
  </main>;
}
