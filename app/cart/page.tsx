'use client';

import Link from 'next/link';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { FREE_DELIVERY_FROM } from '@/lib/orders';

export default function CartPage() {
  const { cart, updateQty, removeFromCart, canAddMore, subtotal, deliveryFee, total, toFreeDelivery, mounted } = useStore();

  if (!mounted) {
    return <main className="page"><div className="container page-loader" /></main>;
  }

  return (
    <main className="page">
      <section className="section cart-head">
        <div className="container">
          <div className="eyebrow">Your bag</div>
          <h1 className="display h2">Keep the good things coming.</h1>
          <p className="muted">Everything you add stays here in this browser until you check out.</p>
        </div>
      </section>
      <div className="container cart-layout">
        <section className="panel cart-panel">
          {cart.length === 0 ? (
            <div className="empty-state">
              <ShoppingBag size={28} />
              <h3>Your bag is empty.</h3>
              <p>Start with a craving. We’ll do the rest.</p>
              <Link className="btn btn-brand" href="/shop">Browse menu <ArrowRight size={15} /></Link>
            </div>
          ) : (
            cart.map((item) => {
              const atLimit = canAddMore(item.product, item.size) === 0;
              return (
                <div className="cart-item" key={item.lineId}>
                  <Link href={`/shop/${item.product.id}`} className={`cart-thumb ${item.product.image}`} />
                  <div>
                    <Link href={`/shop/${item.product.id}`} className="cart-item-name">{item.product.name}</Link>
                    <div className="small muted">{item.product.category}{item.size === 'Large' ? ' · Large' : ''} · ₹{item.unitPrice}</div>
                    <div className="qty" style={{ marginTop: 10 }}>
                      <button aria-label="Decrease" onClick={() => updateQty(item.lineId, item.qty - 1)}><Minus size={14} /></button>
                      <span>{item.qty}</span>
                      <button aria-label="Increase" onClick={() => updateQty(item.lineId, item.qty + 1)} disabled={atLimit}><Plus size={14} /></button>
                    </div>
                    {atLimit && <div className="stock-note">That’s all we can make right now.</div>}
                  </div>
                  <div className="cart-item-total">
                    <strong>₹{item.unitPrice * item.qty}</strong>
                    <button className="icon-btn ghost-icon" onClick={() => removeFromCart(item.lineId)} aria-label={`Remove ${item.product.name}`}><Trash2 size={15} /></button>
                  </div>
                </div>
              );
            })
          )}
        </section>
        <aside className="panel summary-panel">
          <div className="summary-kicker">Your order</div>
          <h2 className="display h3">A calm little total.</h2>
          <div className="summary-row"><span>Subtotal</span><strong>₹{subtotal}</strong></div>
          <div className="summary-row"><span>Delivery</span><span>{deliveryFee === 0 && subtotal > 0 ? 'Free' : subtotal > 0 ? `₹${deliveryFee}` : '—'}</span></div>
          {toFreeDelivery > 0 && <div className="free-delivery-note">Add ₹{toFreeDelivery} more for free delivery (orders from ₹{FREE_DELIVERY_FROM}).</div>}
          <div className="summary-total-line"><span>Total</span><strong>₹{total}</strong></div>
          <Link className={`btn btn-brand btn-lg full-btn ${cart.length === 0 ? 'disabled' : ''}`} href={cart.length ? '/checkout' : '/shop'}>
            Continue to checkout <ArrowRight size={16} />
          </Link>
          <Link className="btn btn-secondary full-btn" href="/shop">Continue shopping</Link>
        </aside>
      </div>
    </main>
  );
}
