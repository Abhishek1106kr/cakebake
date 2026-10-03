'use client';

import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { AnimatedNumber, Magnetic } from '@/components/motion';
import { FREE_DELIVERY_FROM } from '@/lib/orders';
import { EASE } from '@/lib/motion';

export default function CartPage() {
  const reduce = useReducedMotion();
  const { cart, updateQty, removeFromCart, canAddMore, subtotal, deliveryFee, total, toFreeDelivery, mounted } = useStore();
  const progress = subtotal ? Math.min(1, subtotal / FREE_DELIVERY_FROM) : 0;

  if (!mounted) {
    return <main className="page"><div className="container page-loader" /></main>;
  }

  return (
    <main className="page">
      <section className="section cart-head">
        <motion.div className="container" initial={reduce ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
          <div className="eyebrow">Your bag</div>
          <h1 className="display h2">Keep the good things coming.</h1>
          <p className="muted">Everything you add stays here in this browser until you check out.</p>
        </motion.div>
      </section>
      <div className="container cart-layout">
        <section className="panel cart-panel">
          <AnimatePresence mode="popLayout" initial={false}>
            {cart.length === 0 && (
              <motion.div key="empty" className="empty-state" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: EASE }}>
                <motion.span animate={reduce ? undefined : { y: [0, -6, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}><ShoppingBag size={28} /></motion.span>
                <h3>Your bag is empty.</h3>
                <p>Start with a craving. We’ll do the rest.</p>
                <Link className="btn btn-brand" href="/shop">Browse menu <ArrowRight size={15} /></Link>
              </motion.div>
            )}
            {cart.map((item, i) => {
              const atLimit = canAddMore(item.product, item.size) === 0;
              return (
                <motion.div
                  layout={!reduce}
                  className="cart-item"
                  key={item.lineId}
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: 60, height: 0, paddingTop: 0, paddingBottom: 0, marginTop: 0, marginBottom: 0, transition: { duration: 0.35, ease: EASE } }}
                  transition={{ duration: 0.4, ease: EASE, delay: i * 0.05 }}
                  style={{ overflow: 'hidden' }}
                >
                  <Link href={`/shop/${item.product.id}`} className={`cart-thumb ${item.product.image}`} />
                  <div>
                    <Link href={`/shop/${item.product.id}`} className="cart-item-name">{item.product.name}</Link>
                    <div className="small muted">{item.product.category}{item.size === 'Large' ? ' · Large' : ''} · ₹{item.unitPrice}</div>
                    <div className="qty" style={{ marginTop: 10 }}>
                      <motion.button whileTap={{ scale: 0.85 }} aria-label="Decrease" onClick={() => updateQty(item.lineId, item.qty - 1)}><Minus size={14} /></motion.button>
                      <AnimatePresence mode="popLayout" initial={false}><motion.span key={item.qty} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.18 }}>{item.qty}</motion.span></AnimatePresence>
                      <motion.button whileTap={{ scale: 0.85 }} aria-label="Increase" onClick={() => updateQty(item.lineId, item.qty + 1)} disabled={atLimit}><Plus size={14} /></motion.button>
                    </div>
                    {atLimit && <div className="stock-note">That’s all we can make right now.</div>}
                  </div>
                  <div className="cart-item-total">
                    <strong><AnimatedNumber value={item.unitPrice * item.qty} /></strong>
                    <motion.button whileHover={{ rotate: -8 }} whileTap={{ scale: 0.85 }} className="icon-btn ghost-icon" onClick={() => removeFromCart(item.lineId)} aria-label={`Remove ${item.product.name}`}><Trash2 size={15} /></motion.button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </section>
        <motion.aside className="panel summary-panel" initial={reduce ? false : { opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.7, ease: EASE }}>
          <div className="summary-kicker">Your order</div>
          <h2 className="display h3">A calm little total.</h2>
          <div className="summary-row"><span>Subtotal</span><strong><AnimatedNumber value={subtotal} /></strong></div>
          <div className="summary-row"><span>Delivery</span><span>{deliveryFee === 0 && subtotal > 0 ? 'Free' : subtotal > 0 ? `₹${deliveryFee}` : '—'}</span></div>
          {subtotal > 0 && (
            <div className="free-delivery-note">
              {toFreeDelivery > 0 ? `Add ₹${toFreeDelivery} more for free delivery (orders from ₹${FREE_DELIVERY_FROM}).` : 'Delivery is on us.'}
              <div className="free-track"><motion.span initial={false} animate={{ scaleX: progress }} transition={{ duration: 0.6, ease: EASE }} /></div>
            </div>
          )}
          <div className="summary-total-line"><span>Total</span><strong><AnimatedNumber value={total} /></strong></div>
          <Magnetic><Link className={`btn btn-brand btn-lg full-btn ${cart.length === 0 ? 'disabled' : ''}`} href={cart.length ? '/checkout' : '/shop'}>
            Continue to checkout <ArrowRight size={16} />
          </Link></Magnetic>
          <Link className="btn btn-secondary full-btn" href="/shop">Continue shopping</Link>
        </motion.aside>
      </div>
    </main>
  );
}
