'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, CreditCard, LockKeyhole, Smartphone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '@/components/store-provider';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, subtotal, deliveryFee, total, mounted, placeOrder } = useStore();
  const [payment, setPayment] = useState('UPI');
  const [processing, setProcessing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', city: 'Bengaluru', pin: '560038', slot: '18:00–20:00' });
  const canSubmit = cart.length > 0 && Boolean(form.name) && Boolean(form.phone) && Boolean(form.address) && Boolean(form.pin);
  const orderTime = useMemo(() => payment === 'UPI' ? 'Instant confirmation' : payment === 'Card' ? 'Instant confirmation' : 'Pay on delivery', [payment]);

  useEffect(() => {
    if (mounted && cart.length === 0) router.replace('/cart');
  }, [mounted, cart.length, router]);

  if (!mounted || cart.length === 0) {
    return <main className="page"><div className="container page-loader" /></main>;
  }

  const submit = async () => {
    if (!canSubmit || processing) return;
    setProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 950));
    const order = placeOrder({
      customer: { name: form.name, phone: form.phone, email: form.email },
      address: form.address,
      city: form.city,
      pin: form.pin,
      slot: form.slot,
      paymentMethod: payment,
    });
    router.push(`/order-confirmed?id=${order.id}`);
  };

  return (
    <main className="page checkout-page">
      <section className="section checkout-head">
        <div className="container">
          <div className="checkout-crumbs"><span>Cart</span><b>›</b><span>Checkout</span><b>›</b><strong>Payment</strong></div>
          <h1 className="display h2">Almost there.</h1>
          <p className="muted">A short checkout with delivery details shown before payment. This demo simulates the gateway flow and order creation.</p>
        </div>
      </section>

      <div className="container checkout-grid">
        <section className="panel checkout-panel">
          <div className="checkout-section">
            <div className="section-number">01</div>
            <div>
              <h2>Delivery details</h2>
              <div className="form-grid">
                <div className="field"><label>Full name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" /></div>
                <div className="field"><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 99999 99999" /></div>
                <div className="field full"><label>Email <span className="optional">optional</span></label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></div>
                <div className="field full"><label>Address</label><textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Flat / building, street, landmark" /></div>
                <div className="field"><label>City</label><input value={form.city} readOnly /></div>
                <div className="field"><label>PIN code</label><input value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} placeholder="560038" /></div>
                <div className="field full"><label>Delivery slot</label><select value={form.slot} onChange={(e) => setForm({ ...form, slot: e.target.value })}><option>10:00–12:00</option><option>14:00–16:00</option><option>18:00–20:00</option></select></div>
              </div>
            </div>
          </div>

          <div className="checkout-section">
            <div className="section-number">02</div>
            <div>
              <h2>Payment</h2>
              <div className="payment-tabs">
                <button className={payment === 'UPI' ? 'active' : ''} onClick={() => setPayment('UPI')}><Smartphone size={18} />UPI</button>
                <button className={payment === 'Card' ? 'active' : ''} onClick={() => setPayment('Card')}><CreditCard size={18} />Card</button>
                <button className={payment === 'COD' ? 'active' : ''} onClick={() => setPayment('COD')}><span className="cod-icon">₹</span>Pay at door</button>
              </div>
              <div className="payment-box">
                <div className="payment-box-top"><LockKeyhole size={18} /><div><strong>{payment === 'COD' ? 'Cash / UPI at the door' : `Secure ${payment} payment`}</strong><span>{orderTime}</span></div></div>
                {payment !== 'COD' ? (
                  <div className="mock-payment-fields">
                    <input placeholder={payment === 'UPI' ? 'name@upi' : 'Card number'} />
                    <div className="split-input"><input placeholder={payment === 'UPI' ? 'Optional note' : 'MM / YY'} /><input placeholder={payment === 'UPI' ? ' ' : 'CVC'} /></div>
                  </div>
                ) : <p className="small muted">Your order is confirmed now. The mock assumes payment is completed when the rider arrives.</p>}
              </div>
              <div className="secure-copy"><Check size={14} /> Server-side verification placeholder · no real money is moved in this mock.</div>
            </div>
          </div>
        </section>

        <aside className="panel summary-panel checkout-summary">
          <div className="summary-kicker">Order summary</div>
          <h2 className="display h3">One more step.</h2>
          {cart.map((line) => <div className="summary-row" key={line.product.id}><span>{line.qty} × {line.product.name}</span><strong>₹{line.product.price * line.qty}</strong></div>)}
          <div className="summary-row"><span>Delivery</span><span>{deliveryFee ? `₹${deliveryFee}` : 'Free'}</span></div>
          <div className="summary-total-line"><span>Total</span><strong>₹{total}</strong></div>
          <button className="btn btn-brand btn-lg full-btn" onClick={submit} disabled={!canSubmit || processing}>
            {processing ? <><span className="button-spinner" /> Processing payment…</> : <>Place order · ₹{total} <ArrowRight size={16} /></>}
          </button>
          <p className="checkout-legal">By continuing, you confirm the delivery details are correct and agree to the order policy.</p>
          <Link className="back-link centered" href="/cart">Back to bag</Link>
        </aside>
      </div>
    </main>
  );
}
