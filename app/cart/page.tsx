'use client';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Plus, Minus, Trash2, ArrowRight } from 'lucide-react';
import { useStore } from '@/components/store';
import { AnimatedNumber, Magnetic } from '@/components/motion';
import { FREE_DELIVERY_FROM, MAX_QTY } from '@/lib/commerce';
import { EASE } from '@/lib/motion';

export default function CartPage() {
  const reduce = useReducedMotion();
  const { cart, subtotal, delivery, total, toFreeDelivery, setQuantity, removeFromCart, ready } = useStore();
  const progress = subtotal ? Math.min(1, subtotal / FREE_DELIVERY_FROM) : 0;
  return <main className="cart-page"><div className="cart-wrap"><section><div className="eyebrow" style={{ color:'var(--sage-light)' }}>YOUR BAG</div><h1 className="font-display">A small order.<br/>A very good idea.</h1>
    <AnimatePresence initial={false}>
      {cart.map((item, i) => (
        <motion.div layout={!reduce} className="cart-item" key={item.slug} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0, transition: { height: { duration: 0.3, ease: EASE, delay: 0.08 }, opacity: { duration: 0.15 } } }} transition={{ duration: 0.3, ease: EASE }} style={{ overflow: 'hidden' }}>
          <div className="cart-index">{String(i+1).padStart(2,'0')}</div>
          <div><div className="cart-name">{item.product.name}</div><div className="cart-meta">{item.quantity} × ₹{item.product.price}</div>
            <div style={{ display:'flex', gap:6, marginTop:10 }}><button aria-label="One fewer" onClick={()=>setQuantity(item.slug,item.quantity-1)} className="cart-icon"><Minus size={13}/></button><button aria-label="One more" disabled={item.quantity >= MAX_QTY} onClick={()=>setQuantity(item.slug,item.quantity+1)} className="cart-icon"><Plus size={13}/></button><button aria-label={`Remove ${item.product.name}`} onClick={()=>removeFromCart(item.slug)} className="cart-icon"><Trash2 size={13}/></button></div>
          </div>
          <strong style={{ fontSize:15 }}><AnimatedNumber value={item.lineTotal} /></strong>
        </motion.div>
      ))}
    </AnimatePresence>
    {ready && !cart.length && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding:'70px 0', color:'var(--sage-light)' }}><p className="font-display" style={{ fontSize: 34, color: 'white' }}>Your bag is waiting.</p><Link href="/menu" className="btn btn-primary" style={{ marginTop: 20 }}>EXPLORE MENU</Link></motion.div>}
  </section>
  <aside className="cart-total-card"><div className="eyebrow">ORDER SUMMARY</div><h2 className="font-display" style={{ marginTop:16 }}><AnimatedNumber value={total} /></h2>
    <div className="summary-row"><span>Subtotal</span><span><AnimatedNumber value={subtotal} /></span></div>
    <div className="summary-row"><span>Delivery</span><span>{!subtotal ? '—' : delivery ? `₹${delivery}` : 'FREE'}</span></div>
    <div className="summary-row summary-total"><span>Total</span><span><AnimatedNumber value={total} /></span></div>
    {subtotal > 0 && <div className="free-delivery"><div className="free-track"><motion.span animate={{ scaleX: progress }} transition={{ duration: 0.5, ease: EASE }} /></div><p>{toFreeDelivery ? `Add ₹${toFreeDelivery} more for free delivery.` : 'Delivery is on us.'}</p></div>}
    <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12 }}>Prices include GST. No packing or service charges.</p>
    {cart.length ? <Magnetic><Link href="/checkout" className="btn btn-primary" style={{ width:'100%', marginTop:20 }}>CHECKOUT <ArrowRight size={14}/></Link></Magnetic> : <Link href="/menu" className="btn btn-primary" style={{ width:'100%', marginTop:20 }}>EXPLORE MENU</Link>}
    <Link href="/menu" style={{ display:'block', textAlign:'center', marginTop:22, color:'var(--sage-deep)', fontSize:12 }}>Continue shopping →</Link>
  </aside></div></main>;
}
