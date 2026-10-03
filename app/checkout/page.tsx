'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CreditCard, Smartphone, Banknote } from 'lucide-react';
import { useStore } from '@/components/store';
import { AnimatedNumber } from '@/components/motion';
import { CheckoutErrors, CheckoutForm, PaymentMethod, nextOrderId, normalizePhone, simulatePayment, validate } from '@/lib/commerce';
import { getSlots, slotLabel } from '@/lib/slots';
import { EASE } from '@/lib/motion';

type Phase = 'idle' | 'processing' | 'failed';
const FIELDS: (keyof CheckoutForm)[] = ['name', 'phone', 'address', 'pin', 'upiId', 'cardNumber'];

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      <AnimatePresence initial={false}>{error && <motion.span id={`${id}-error`} className="field-error" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>{error}</motion.span>}</AnimatePresence>
    </div>
  );
}

export default function CheckoutPage() {
  const reduce = useReducedMotion();
  const { cart, subtotal, delivery, total, clearCart, orders, saveOrder, ready } = useStore();
  const router = useRouter();
  const [payment, setPayment] = useState<PaymentMethod>('UPI');
  const [phase, setPhase] = useState<Phase>('idle');
  const [failure, setFailure] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [form, setForm] = useState<CheckoutForm>({ name: '', phone: '', address: '', pin: '', instructions: '', upiId: '', cardNumber: '' });
  const slots = useMemo(() => getSlots(now), [now]);
  const [slotId, setSlotId] = useState('');

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!slots.some((s) => s.id === slotId && s.available)) setSlotId(slots.find((s) => s.available)?.id ?? ''); }, [slots, slotId]);

  const errors: CheckoutErrors = validate(form, payment);
  const show = (k: keyof CheckoutForm) => (submitted ? errors[k] : undefined);
  const set = (k: keyof CheckoutForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: k === 'pin' ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value });
  const aria = (k: keyof CheckoutForm) => ({ id: `f-${k}`, 'aria-invalid': Boolean(show(k)), 'aria-describedby': show(k) ? `f-${k}-error` : undefined });

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phase === 'processing' || !cart.length) return;
    setSubmitted(true);
    const first = FIELDS.find((k) => errors[k]);
    if (first) { document.getElementById(`f-${first}`)?.focus(); return; }
    setPhase('processing');
    const result = await simulatePayment(payment, form.upiId, form.cardNumber);
    if (!result.ok) { setFailure(result.reason); setPhase('failed'); return; }
    const id = nextOrderId(orders);
    saveOrder({
      id,
      createdAt: new Date().toISOString(),
      customer: { name: form.name.trim(), phone: normalizePhone(form.phone) },
      address: form.address.trim(),
      pin: form.pin,
      slot: slotLabel(slotId, slots),
      instructions: form.instructions.trim(),
      payment: { method: payment, status: result.status, reference: result.reference, simulated: true },
      items: cart.map((l) => ({ slug: l.slug, name: l.product.name, price: l.product.price, quantity: l.quantity })),
      subtotal, delivery, total,
    });
    clearCart();
    router.push(`/order/${id}`);
  };

  if (ready && !cart.length && phase !== 'processing') {
    return <main className="page section" style={{ textAlign: 'center' }}><h1 className="section-title font-display">Your bag is waiting.</h1><Link href="/menu" className="btn btn-primary" style={{ marginTop: 24 }}>EXPLORE MENU</Link></main>;
  }

  return <main className="page"><form className="checkout-grid" onSubmit={placeOrder} noValidate><section>
    <div className="eyebrow">05 / CHECKOUT</div><h1 className="section-title font-display">Almost there.</h1>
    <Field id="f-name" label="FULL NAME" error={show('name')}><input {...aria('name')} autoComplete="name" value={form.name} onChange={set('name')} /></Field>
    <Field id="f-phone" label="PHONE" error={show('phone')}><input {...aria('phone')} type="tel" autoComplete="tel" placeholder="+91 9XXXXXXXXX" value={form.phone} onChange={set('phone')} /></Field>
    <Field id="f-address" label="ADDRESS" error={show('address')}><input {...aria('address')} autoComplete="street-address" placeholder="Flat, building, street, landmark" value={form.address} onChange={set('address')} /></Field>
    <Field id="f-pin" label="PIN CODE" error={show('pin')}><input {...aria('pin')} inputMode="numeric" autoComplete="postal-code" placeholder="560066" value={form.pin} onChange={set('pin')} /></Field>
    <div className="field"><label htmlFor="f-instructions">DELIVERY INSTRUCTIONS</label><textarea id="f-instructions" rows={3} placeholder="Leave at the door if unavailable" value={form.instructions} onChange={set('instructions')} /></div>

    <div style={{ marginTop: 42 }}><div className="eyebrow">WHEN</div>
      <div className="slot-grid" role="radiogroup" aria-label="Delivery time">
        {slots.map((s) => (
          <label key={s.id} className={`slot ${slotId === s.id ? 'active' : ''} ${s.available ? '' : 'disabled'}`}>
            <input type="radio" name="slot" checked={slotId === s.id} disabled={!s.available} onChange={() => setSlotId(s.id)} />
            <span className="slot-day">{s.day}</span><span>{s.label}</span>{s.reason && <span className="slot-reason">{s.reason}</span>}
          </label>
        ))}
      </div>
    </div>

    <div style={{ marginTop: 42 }}><div className="eyebrow">PAYMENT</div>
      <div className="payment-options">{([['UPI', Smartphone], ['CARD', CreditCard], ['PAY AT DOOR', Banknote]] as [PaymentMethod, typeof Smartphone][]).map(([label, Icon]) => <button type="button" key={label} onClick={() => { setPayment(label); if (phase === 'failed') setPhase('idle'); }} className={`payment-option ${payment === label ? 'active' : ''}`} aria-pressed={payment === label}><Icon size={16} />{label}</button>)}</div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={payment} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {payment === 'UPI' && <Field id="f-upiId" label="UPI ID" error={show('upiId')}><input {...aria('upiId')} placeholder="name@bank" value={form.upiId} onChange={set('upiId')} /><span className="hint">Prototype: try fail@upi to see a declined payment.</span></Field>}
          {payment === 'CARD' && <Field id="f-cardNumber" label="CARD NUMBER" error={show('cardNumber')}><input {...aria('cardNumber')} inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" value={form.cardNumber} onChange={set('cardNumber')} /><span className="hint">Prototype: a card ending 0002 is declined. Card details are never stored.</span></Field>}
          {payment === 'PAY AT DOOR' && <p className="hint" style={{ marginTop: 14 }}>Pay by cash or UPI when your order arrives.</p>}
        </motion.div>
      </AnimatePresence>
      <AnimatePresence>{phase === 'failed' && <motion.div className="pay-failed" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.24, ease: EASE }}><strong className="font-display">Something went off-script.</strong><p>{failure} Your bag is safe and nothing was charged. Try again, or choose another way to pay.</p></motion.div>}</AnimatePresence>
    </div>
  </section>
  <aside className="checkout-summary"><div className="eyebrow" style={{ color:'var(--sage-light)' }}>YOUR ORDER</div>
    {cart.map(i => <div className="summary-row" key={i.slug}><span>{i.product.name} × {i.quantity}</span><span>₹{i.lineTotal}</span></div>)}
    <div className="summary-row"><span>Delivery</span><span>{delivery ? `₹${delivery}` : 'FREE'}</span></div>
    <div className="summary-row summary-total"><span>TOTAL</span><span><AnimatedNumber value={total} /></span></div>
    <button disabled={!cart.length || phase === 'processing'} className="btn btn-secondary" style={{ width:'100%', marginTop:22 }}>{phase === 'failed' ? 'TRY AGAIN' : 'PLACE ORDER'} · ₹{total.toLocaleString('en-IN')}</button>
    <div style={{ marginTop:14, textAlign:'center', fontSize:10, color:'var(--sage-light)' }}>Payment is simulated for this prototype. No money moves.</div>
  </aside></form>
  <AnimatePresence>{phase === 'processing' && (
    <motion.div className="processing" role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <div className="orbit" aria-hidden="true">{[0, 1, 2, 3].map((i) => <motion.span key={i} style={{ rotate: i * 90 }} animate={reduce ? undefined : { rotate: i * 90 + 360 }} transition={{ duration: 2.4, repeat: Infinity, ease: 'linear', delay: i * 0.08 }}><i /></motion.span>)}</div>
      <p className="font-display">Preparing your order</p><span>A little moment… confirming your simulated payment.</span>
    </motion.div>
  )}</AnimatePresence>
  </main>;
}
