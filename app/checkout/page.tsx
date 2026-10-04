'use client';

import { useEffect, useMemo, useState } from 'react';
import { track, useTrackOnce } from '@/components/intelligence';
import { ArrowRight, Check, CreditCard, LockKeyhole, Smartphone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '@/components/store-provider';
import { CheckoutErrors, CheckoutField, PaymentMethod, normalizePhone, validateCheckout } from '@/lib/orders';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, subtotal, deliveryFee, total, mounted, placeOrder } = useStore();
  useTrackOnce(mounted && cart.length > 0, 'checkout', () => track('checkout_started', { itemCount: cart.reduce((n, l) => n + l.qty, 0), total }));
  const [payment, setPayment] = useState<PaymentMethod>('UPI');
  const [processing, setProcessing] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<CheckoutField, boolean>>>({});
  const [orderError, setOrderError] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', city: 'Bengaluru', pin: '560038', slot: '18:00–20:00' });
  const errors: CheckoutErrors = validateCheckout(form, cart);
  const show = (field: CheckoutField) => (submitted || touched[field] ? errors[field] : undefined);
  const blur = (field: CheckoutField) => () => setTouched((t) => ({ ...t, [field]: true }));
  const orderTime = useMemo(() => payment === 'UPI' ? 'Instant confirmation' : payment === 'Card' ? 'Instant confirmation' : 'Pay on delivery', [payment]);

  useEffect(() => {
    if (mounted && cart.length === 0 && !placed) router.replace('/cart');
  }, [mounted, cart.length, placed, router]);

  if (!mounted || (cart.length === 0 && !placed)) {
    return <main className="page"><div className="container page-loader" /></main>;
  }

  const submit = async () => {
    if (processing) return;
    setSubmitted(true);
    setOrderError('');
    const firstError = (['name', 'phone', 'email', 'address', 'pin'] as CheckoutField[]).find((field) => errors[field]);
    if (firstError) { document.getElementById(`f-${firstError}`)?.focus(); return; }
    setProcessing(true);
    // Simulated payment: no money moves (see README). Replace with a real gateway later.
    await new Promise((resolve) => setTimeout(resolve, 950));
    const result = placeOrder({
      customer: { name: form.name.trim(), phone: normalizePhone(form.phone), email: form.email.trim() },
      address: form.address.trim(),
      city: form.city,
      pin: form.pin,
      slot: form.slot,
      paymentMethod: payment,
    });
    if (!result.ok) {
      setProcessing(false);
      setOrderError(result.errors.cart ?? 'Please check your details.');
      return;
    }
    setPlaced(true);
    router.push(`/order-confirmed?id=${result.order.id}`);
  };

  const field = (key: CheckoutField & keyof typeof form, label: string, input: React.ReactNode, full = false) => (
    <div className={`field ${full ? 'full' : ''} ${show(key) ? 'has-error' : ''}`}>
      {label && <label htmlFor={`f-${key}`}>{label}</label>}
      {input}
      {show(key) && <span className="field-error" id={`e-${key}`}>{show(key)}</span>}
    </div>
  );
  const aria = (key: CheckoutField) => ({ id: `f-${key}`, onBlur: blur(key), 'aria-invalid': Boolean(show(key)), 'aria-describedby': show(key) ? `e-${key}` : undefined });

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
                {field('name', 'Full name', <input {...aria('name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" autoComplete="name" />)}
                {field('phone', 'Phone', <input {...aria('phone')} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 99999 99999" autoComplete="tel" />)}
                {field('email', '', <><label htmlFor="f-email">Email <span className="optional">optional</span></label><input {...aria('email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" autoComplete="email" /></>, true)}
                {field('address', 'Address', <textarea {...aria('address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Flat / building, street, landmark" autoComplete="street-address" />, true)}
                <div className="field"><label>City</label><input value={form.city} readOnly /></div>
                {field('pin', 'PIN code', <input {...aria('pin')} inputMode="numeric" maxLength={6} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} placeholder="560038" autoComplete="postal-code" />)}
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
          {cart.map((line) => <div className="summary-row" key={line.lineId}><span>{line.qty} × {line.product.name}{line.size === 'Large' ? ' (Large)' : ''}</span><strong>₹{line.unitPrice * line.qty}</strong></div>)}
          <div className="summary-row"><span>Delivery</span><span>{deliveryFee ? `₹${deliveryFee}` : 'Free'}</span></div>
          <div className="summary-total-line"><span>Total</span><strong>₹{total}</strong></div>
          {orderError && <div className="form-alert" role="alert">{orderError}</div>}
          {submitted && Object.keys(errors).length > 0 && !orderError && <div className="form-alert" role="alert">Please check the highlighted details.</div>}
          <button className="btn btn-brand btn-lg full-btn" onClick={submit} disabled={processing}>
            {processing ? <><span className="button-spinner" /> Processing payment…</> : <>Place order · ₹{total} <ArrowRight size={16} /></>}
          </button>
          <p className="checkout-legal">By continuing, you confirm the delivery details are correct and agree to the order policy.</p>
          <Link className="back-link centered" href="/cart">Back to bag</Link>
        </aside>
      </div>
    </main>
  );
}
