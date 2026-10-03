'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@/components/store';
import { STEPS, statusIndexAt } from '@/lib/commerce';
import { EASE } from '@/lib/motion';

const SECTIONS = ['MY ORDERS', 'SAVED ADDRESSES', 'PAYMENT METHODS', 'ACCOUNT PRIVACY'];

export default function AccountPage() {
  const { orders, ready } = useStore();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(t); }, []);
  return <main className="account-page"><div className="account-wrap">
    <aside className="account-nav"><div className="eyebrow" style={{color:'var(--sage-light)'}}>ACCOUNT</div><h1 className="font-display">Guest</h1>
      {SECTIONS.map((x, i) => <span key={x} className={`account-link ${i === 0 ? 'active' : ''}`} aria-disabled={i !== 0}>{x}{i !== 0 && <em className="soon"> · soon</em>}</span>)}
      <p style={{ marginTop: 24, fontSize: 12, color: 'var(--sage-light)' }}>No sign-in yet. Orders are kept on this device.</p>
    </aside>
    <section><div className="eyebrow" style={{color:'var(--sage-light)'}}>RECENT ORDERS</div>
      <div className="account-orders" style={{ marginTop:18 }}>
        {!ready && <div className="account-skeleton" />}
        {ready && orders.length === 0 && <div style={{ color: 'var(--sage-light)', padding: '30px 0' }}><p className="font-display" style={{ fontSize: 30, color: 'white' }}>No orders yet.</p><Link href="/menu" className="btn btn-primary" style={{ marginTop: 18 }}>EXPLORE MENU</Link></div>}
        {orders.map((o, i) => {
          const index = statusIndexAt(o, now);
          const live = index < STEPS.length - 1;
          return (
            <motion.div className="account-order" key={o.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.4, ease: EASE }}>
              <div><div className="code">#{o.id}</div><div className="meta">{new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {live && <span className="breathing-dot" aria-hidden="true" />} {STEPS[index].status.toLowerCase()}</div></div>
              <div style={{ fontSize:14 }}>₹{o.total.toLocaleString('en-IN')}</div>
              <Link href={live ? `/track/${o.id}` : `/order/${o.id}`} className="btn btn-secondary">{live ? 'TRACK' : 'VIEW'}</Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  </div></main>;
}
