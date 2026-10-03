'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Minus, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { ProductArt } from '@/components/media/product-art';
import { AnimatedNumber } from '@/components/motion/animated-number';
import { Magnetic } from '@/components/motion/magnetic';
import { useStore } from '@/components/providers/store-provider';
import { FREE_DELIVERY_FROM, MAX_QTY_PER_LINE } from '@/lib/cart/pricing';
import { formatPrice, pad2 } from '@/lib/format';
import { EASE } from '@/lib/motion/transitions';
import { PinCheck } from './pin-check';

export function CartView() {
  const reduce = useReducedMotion();
  const { ready, lines, totals, setQty, removeLine } = useStore();
  const empty = ready && lines.length === 0;
  const progress = totals.subtotal === 0 ? 0 : Math.min(1, totals.subtotal / FREE_DELIVERY_FROM);

  return (
    <main className="cart-shell">
      <div className="cart-wrap wrap">
        <section aria-labelledby="bag-title">
          <div className="eyebrow eyebrow-light">Your bag{ready && totals.itemCount > 0 ? ` · ${pad2(totals.itemCount)} items` : ''}</div>
          <h1 id="bag-title" className="cart-title display">A small order.<br />A very good idea.</h1>

          {!ready && (
            <div className="cart-skeleton" aria-hidden="true">
              {[0, 1].map((i) => <div key={i} className="skeleton-row is-dark" />)}
            </div>
          )}

          {empty && (
            <motion.div className="cart-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
              <svg viewBox="0 0 120 90" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M30 34h60l-6 46H36z" /><path d="M46 34c0-10 6-18 14-18s14 8 14 18" /></svg>
              <p className="display">Your bag is waiting.</p>
              <Link href="/menu" className="btn btn-light">Explore menu</Link>
            </motion.div>
          )}

          <ul className="cart-lines">
            <AnimatePresence initial={false}>
              {lines.map((line, i) => (
                <motion.li
                  key={line.key}
                  layout={!reduce}
                  className="cart-line"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0, marginTop: 0, transition: { height: { duration: 0.3, ease: EASE, delay: 0.08 }, opacity: { duration: 0.16 } } }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  <span className="cart-index">{pad2(i + 1)}</span>
                  <Link href={`/product/${line.slug}`} className="cart-thumb" tabIndex={-1} aria-hidden="true">
                    <ProductArt product={line.product} sizes="88px" />
                  </Link>
                  <div className="cart-line-body">
                    <Link href={`/product/${line.slug}`} className="cart-name display">{line.product.name}</Link>
                    <div className="cart-meta">{line.size === 'large' ? 'Large · ' : ''}{formatPrice(line.unitPrice)} each</div>
                    <div className="stepper is-dark" role="group" aria-label={`Quantity of ${line.product.name}`}>
                      <button type="button" onClick={() => setQty(line.key, line.qty - 1)} aria-label={line.qty === 1 ? `Remove ${line.product.name}` : 'One fewer'}><Minus size={13} /></button>
                      <output aria-live="polite">{line.qty}</output>
                      <button type="button" onClick={() => setQty(line.key, line.qty + 1)} disabled={line.qty >= MAX_QTY_PER_LINE} aria-label="One more"><Plus size={13} /></button>
                    </div>
                  </div>
                  <div className="cart-line-end">
                    <strong className="tabular"><AnimatedNumber value={line.lineTotal} format={formatPrice} /></strong>
                    <button type="button" className="remove-btn" onClick={() => removeLine(line.key)} aria-label={`Remove ${line.product.name}`}><X size={15} strokeWidth={1.4} /></button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>

        <aside className="summary-card" aria-label="Order summary">
          <div className="eyebrow">Order summary</div>
          <div className="summary-big display"><AnimatedNumber value={totals.total} format={formatPrice} /></div>
          <dl className="sum-rows">
            <div><dt>Subtotal</dt><dd><AnimatedNumber value={totals.subtotal} format={formatPrice} /></dd></div>
            <div><dt>Delivery</dt><dd>{totals.subtotal === 0 ? '—' : totals.delivery === 0 ? 'Free' : formatPrice(totals.delivery)}</dd></div>
            <div className="sum-total"><dt>Total</dt><dd><AnimatedNumber value={totals.total} format={formatPrice} /></dd></div>
          </dl>
          {totals.subtotal > 0 && (
            <div className="free-delivery">
              <div className="free-track" aria-hidden="true"><motion.span animate={{ scaleX: progress }} transition={{ duration: 0.5, ease: EASE }} /></div>
              <p>{totals.toFreeDelivery > 0 ? `Add ${formatPrice(totals.toFreeDelivery)} more for free delivery.` : 'Delivery is on us.'}</p>
            </div>
          )}
          <p className="sum-note">Prices include GST. No packing or service charges. Pickup is always free.</p>
          {lines.length > 0 ? (
            <Magnetic className="block"><Link href="/checkout" className="btn btn-primary btn-block">Checkout <ArrowRight size={14} strokeWidth={1.5} /></Link></Magnetic>
          ) : (
            <Link href="/menu" className="btn btn-primary btn-block">Explore menu</Link>
          )}
          <Link href="/menu" className="text-link centered">Continue shopping</Link>
          <PinCheck />
        </aside>
      </div>

      {lines.length > 0 && (
        <div className="mobile-buy-bar is-dark">
          <span className="display"><AnimatedNumber value={totals.total} format={formatPrice} /></span>
          <Link href="/checkout" className="btn btn-light">Checkout</Link>
        </div>
      )}
    </main>
  );
}
