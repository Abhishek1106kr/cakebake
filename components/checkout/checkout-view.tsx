'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CreditCard, LockKeyhole, Smartphone, Store, Truck, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedNumber } from '@/components/motion/animated-number';
import { useStore } from '@/components/providers/store-provider';
import { BOX_NOTE_LIMIT, calculateTotals, cartPrepMinutes, type Fulfilment } from '@/lib/cart/pricing';
import { checkPin } from '@/lib/delivery/serviceability';
import { getSlots, isSlotStillAvailable } from '@/lib/delivery/slots';
import { formatPrice } from '@/lib/format';
import { EASE } from '@/lib/motion/transitions';
import { buildSchedule, generateOrderId, toOrderItems, type Order } from '@/lib/orders/orders';
import { processPayment, type PaymentMethod } from '@/lib/orders/payment';
import { normalizePhone, validateCheckout, type CheckoutErrors, type CheckoutField, type CheckoutForm } from '@/lib/validation/checkout';
import { ProcessingOverlay } from './processing-overlay';
import { SlotPicker } from './slot-picker';

type Phase = 'idle' | 'processing' | 'failed' | 'success';

const FIELD_ORDER: CheckoutField[] = ['name', 'phone', 'email', 'address', 'pin', 'slotId', 'upiId', 'cardNumber', 'cardExpiry', 'cardCvc', 'boxNote'];

export function CheckoutView() {
  const router = useRouter();
  const { ready, lines, orders, profile, addresses, saveOrder, clearCart, setProfile, saveAddress } = useStore();
  const [phase, setPhase] = useState<Phase>('idle');
  const [failure, setFailure] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<CheckoutField, boolean>>>({});
  const [now, setNow] = useState(() => Date.now());
  const [addressChoice, setAddressChoice] = useState<string>('new');
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<CheckoutForm>({
    fulfilment: 'delivery', name: '', phone: '', email: '', address: '', pin: '', instructions: '', boxNote: '',
    slotId: '', payment: 'UPI', upiId: '', cardNumber: '', cardExpiry: '', cardCvc: '', remember: true,
  });

  // Prefill from this device once storage has loaded.
  useEffect(() => {
    if (!ready) return;
    setForm((f) => ({ ...f, name: f.name || profile?.name || '', phone: f.phone || profile?.phone || '', email: f.email || profile?.email || '' }));
    if (addresses[0]) {
      setAddressChoice(addresses[0].id);
      setForm((f) => ({ ...f, address: addresses[0].line, pin: addresses[0].pin }));
    }
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Slots depend on the clock; refresh every 30 s.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const prep = cartPrepMinutes(lines);
  const slots = useMemo(() => getSlots(now, prep, form.fulfilment), [now, prep, form.fulfilment]);
  const totals = calculateTotals(lines, form.fulfilment);

  // Keep a valid slot selected.
  useEffect(() => {
    const current = slots.find((s) => s.id === form.slotId && s.available);
    if (!current) setForm((f) => ({ ...f, slotId: slots.find((s) => s.available)?.id ?? '' }));
  }, [slots]); // eslint-disable-line react-hooks/exhaustive-deps

  const errors: CheckoutErrors = validateCheckout(form);
  const show = (field: CheckoutField) => (submitted || touched[field] ? errors[field] : undefined);
  const set = <K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const blur = (field: CheckoutField) => () => setTouched((t) => ({ ...t, [field]: true }));
  const pinStatus = form.pin.length === 6 ? checkPin(form.pin) : null;

  if (ready && lines.length === 0 && phase !== 'success' && phase !== 'processing') {
    return (
      <main className="checkout-page wrap">
        <div className="empty-state">
          <h1 className="display">Your bag is empty.</h1>
          <p className="lede">Add something you love, then come back here.</p>
          <Link href="/menu" className="btn btn-primary">Explore menu</Link>
        </div>
      </main>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (phase === 'processing') return;
    setSubmitted(true);
    const found = validateCheckout(form);
    if (!isSlotStillAvailable(form.slotId, Date.now(), prep, form.fulfilment)) found.slotId = 'That time has just closed. Choose another.';
    const first = FIELD_ORDER.find((field) => found[field]);
    if (first) {
      setNow(Date.now());
      errorSummaryRef.current?.focus();
      document.getElementById(`f-${first}`)?.focus({ preventScroll: false });
      return;
    }

    setPhase('processing');
    setFailure('');
    const result = await processPayment({ method: form.payment, amount: totals.total, upiId: form.upiId, cardNumber: form.cardNumber });
    if (!result.ok) {
      setFailure(result.reason);
      setPhase('failed');
      return;
    }

    const createdAt = Date.now();
    const chosen = slots.find((s) => s.id === form.slotId)!;
    const slot = { id: chosen.id, label: chosen.label, kind: chosen.kind, startsAt: chosen.kind === 'asap' ? createdAt + 40 * 60_000 : chosen.startsAt };
    const pin = checkPin(form.pin);
    const { schedule, demoTimeline } = buildSchedule(createdAt, form.fulfilment, slot, prep);
    const order: Order = {
      id: generateOrderId(orders),
      createdAt,
      fulfilment: form.fulfilment,
      slot,
      customer: { name: form.name.trim(), phone: normalizePhone(form.phone), email: form.email.trim() || undefined },
      address: form.fulfilment === 'delivery' ? { line: form.address.trim(), pin: form.pin, area: pin.status === 'ok' ? pin.area : '' } : undefined,
      instructions: form.instructions.trim() || undefined,
      boxNote: form.boxNote.trim() || undefined,
      items: toOrderItems(lines),
      totals: { subtotal: totals.subtotal, delivery: totals.delivery, total: totals.total, itemCount: totals.itemCount },
      payment: { method: form.payment, status: result.status, reference: result.reference, simulated: true },
      prepMinutes: prep,
      schedule,
      demoTimeline,
    };

    saveOrder(order);
    if (form.remember) {
      setProfile({ name: order.customer.name, phone: order.customer.phone, email: order.customer.email ?? '' });
      if (order.address) saveAddress({ label: order.address.area || 'Home', line: order.address.line, pin: order.address.pin });
    }
    setPhase('success');
    clearCart();
    router.push(`/order/${order.id}`);
  };

  const errorCount = submitted ? FIELD_ORDER.filter((f) => errors[f]).length : 0;
  const codLabel = form.fulfilment === 'pickup' ? 'Pay at the counter' : 'Pay at the door';
  const payOptions: { id: PaymentMethod; label: string; icon: React.ReactNode }[] = [
    { id: 'UPI', label: 'UPI', icon: <Smartphone size={16} strokeWidth={1.5} /> },
    { id: 'CARD', label: 'Card', icon: <CreditCard size={16} strokeWidth={1.5} /> },
    { id: 'COD', label: codLabel, icon: <Wallet size={16} strokeWidth={1.5} /> },
  ];

  return (
    <main className="checkout-page">
      <form id="checkout-form" className="checkout-grid wrap" onSubmit={submit} noValidate>
        <section className="checkout-main" aria-labelledby="checkout-title">
          <div className="eyebrow">05 / Checkout</div>
          <h1 id="checkout-title" className="page-title display">Almost there.</h1>

          <div ref={errorSummaryRef} tabIndex={-1} className="error-summary-anchor" aria-live="assertive">
            {errorCount > 0 && <p className="error-summary"><AlertCircle size={15} /> {errorCount === 1 ? 'One detail needs a look.' : `${errorCount} details need a look.`}</p>}
          </div>

          <fieldset className="step">
            <legend><span className="step-num">01</span> How would you like it?</legend>
            <div className="segmented is-wide">
              {([['delivery', 'Delivery', <Truck key="t" size={16} strokeWidth={1.5} />], ['pickup', 'Pickup in Whitefield', <Store key="s" size={16} strokeWidth={1.5} />]] as [Fulfilment, string, React.ReactNode][]).map(([id, label, icon]) => (
                <button key={id} type="button" className={form.fulfilment === id ? 'is-active' : ''} aria-pressed={form.fulfilment === id} onClick={() => set('fulfilment', id)}>
                  {icon} {label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="step">
            <legend><span className="step-num">02</span> Your details</legend>
            <div className="field-grid">
              <Field id="name" label="Full name" error={show('name')}>
                <input id="f-name" autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} onBlur={blur('name')} aria-invalid={Boolean(show('name'))} aria-describedby={show('name') ? 'e-name' : undefined} />
              </Field>
              <Field id="phone" label="Mobile" error={show('phone')}>
                <input id="f-phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="98xxxxxxxx" value={form.phone} onChange={(e) => set('phone', e.target.value)} onBlur={blur('phone')} aria-invalid={Boolean(show('phone'))} aria-describedby={show('phone') ? 'e-phone' : undefined} />
              </Field>
              <Field id="email" label="Email" optional error={show('email')} full>
                <input id="f-email" type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} onBlur={blur('email')} aria-invalid={Boolean(show('email'))} aria-describedby={show('email') ? 'e-email' : undefined} />
              </Field>
            </div>

            <AnimatePresence initial={false}>
              {form.fulfilment === 'delivery' && (
                <motion.div key="address" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: EASE }} className="collapse">
                  {addresses.length > 0 && (
                    <div className="saved-addresses" role="radiogroup" aria-label="Saved addresses">
                      {addresses.map((a) => (
                        <label key={a.id} className={`saved-address ${addressChoice === a.id ? 'is-selected' : ''}`}>
                          <input type="radio" name="addr" checked={addressChoice === a.id} onChange={() => { setAddressChoice(a.id); setForm((f) => ({ ...f, address: a.line, pin: a.pin })); }} />
                          <strong>{a.label}</strong><span>{a.line} · {a.pin}</span>
                        </label>
                      ))}
                      <label className={`saved-address ${addressChoice === 'new' ? 'is-selected' : ''}`}>
                        <input type="radio" name="addr" checked={addressChoice === 'new'} onChange={() => { setAddressChoice('new'); setForm((f) => ({ ...f, address: '', pin: '' })); }} />
                        <strong>New address</strong>
                      </label>
                    </div>
                  )}
                  <div className="field-grid">
                    <Field id="address" label="Address" error={show('address')} full>
                      <textarea id="f-address" autoComplete="street-address" rows={2} placeholder="Flat, building, street, landmark" value={form.address} onChange={(e) => { set('address', e.target.value); setAddressChoice('new'); }} onBlur={blur('address')} aria-invalid={Boolean(show('address'))} aria-describedby={show('address') ? 'e-address' : undefined} />
                    </Field>
                    <Field id="pin" label="PIN code" error={show('pin')} hint={!show('pin') && pinStatus?.status === 'ok' ? pinStatus.message : undefined}>
                      <input id="f-pin" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={form.pin} onChange={(e) => { set('pin', e.target.value.replace(/\D/g, '')); setAddressChoice('new'); }} onBlur={blur('pin')} aria-invalid={Boolean(show('pin'))} aria-describedby={show('pin') ? 'e-pin' : undefined} />
                    </Field>
                    <Field id="instructions" label="For the rider" optional>
                      <input id="f-instructions" placeholder="Leave at the door, call on arrival…" value={form.instructions} onChange={(e) => set('instructions', e.target.value)} />
                    </Field>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </fieldset>

          <fieldset className="step">
            <legend><span className="step-num">03</span> {form.fulfilment === 'delivery' ? 'When should it arrive?' : 'When will you collect?'}</legend>
            <SlotPicker slots={slots} value={form.slotId} onChange={(id) => set('slotId', id)} error={show('slotId')} />
          </fieldset>

          <fieldset className="step">
            <legend><span className="step-num">04</span> Payment</legend>
            <div className="pay-options" role="radiogroup" aria-label="Payment method">
              {payOptions.map((option) => (
                <label key={option.id} className={`pay-option ${form.payment === option.id ? 'is-selected' : ''}`}>
                  <input type="radio" name="payment" checked={form.payment === option.id} onChange={() => { set('payment', option.id); if (phase === 'failed') setPhase('idle'); }} />
                  {option.icon} {option.label}
                </label>
              ))}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={form.payment} className="pay-fields" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                {form.payment === 'UPI' && (
                  <Field id="upiId" label="UPI ID" error={show('upiId')} full hint="Prototype: try fail@upi to see a declined payment.">
                    <input id="f-upiId" autoComplete="off" placeholder="name@bank" value={form.upiId} onChange={(e) => set('upiId', e.target.value)} onBlur={blur('upiId')} aria-invalid={Boolean(show('upiId'))} aria-describedby={show('upiId') ? 'e-upiId' : undefined} />
                  </Field>
                )}
                {form.payment === 'CARD' && (
                  <div className="field-grid">
                    <Field id="cardNumber" label="Card number" error={show('cardNumber')} full hint="Prototype: 4242 4242 4242 4242 succeeds, 4000 0000 0000 0002 is declined.">
                      <input id="f-cardNumber" inputMode="numeric" autoComplete="off" placeholder="1234 5678 9012 3456" value={form.cardNumber} onChange={(e) => set('cardNumber', e.target.value.replace(/[^\d ]/g, '').replace(/(\d{4})(?=\d)/g, '$1 ').replace(/\s+/g, ' ').slice(0, 23))} onBlur={blur('cardNumber')} aria-invalid={Boolean(show('cardNumber'))} aria-describedby={show('cardNumber') ? 'e-cardNumber' : undefined} />
                    </Field>
                    <Field id="cardExpiry" label="Expiry" error={show('cardExpiry')}>
                      <input id="f-cardExpiry" inputMode="numeric" autoComplete="off" placeholder="MM/YY" maxLength={5} value={form.cardExpiry} onChange={(e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 4); set('cardExpiry', d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d); }} onBlur={blur('cardExpiry')} aria-invalid={Boolean(show('cardExpiry'))} aria-describedby={show('cardExpiry') ? 'e-cardExpiry' : undefined} />
                    </Field>
                    <Field id="cardCvc" label="CVC" error={show('cardCvc')}>
                      <input id="f-cardCvc" inputMode="numeric" autoComplete="off" maxLength={4} value={form.cardCvc} onChange={(e) => set('cardCvc', e.target.value.replace(/\D/g, ''))} onBlur={blur('cardCvc')} aria-invalid={Boolean(show('cardCvc'))} aria-describedby={show('cardCvc') ? 'e-cardCvc' : undefined} />
                    </Field>
                  </div>
                )}
                {form.payment === 'COD' && <p className="pay-note">Pay by cash or UPI when your order {form.fulfilment === 'pickup' ? 'is collected' : 'arrives'}.</p>}
              </motion.div>
            </AnimatePresence>

            <AnimatePresence>
              {phase === 'failed' && (
                <motion.div className="pay-failed" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.24, ease: EASE }}>
                  <strong>Something went off-script.</strong>
                  <p>{failure} Your bag is safe and nothing was charged. Try again, or choose another way to pay.</p>
                  <button type="submit" className="btn btn-secondary btn-sm">Try again</button>
                </motion.div>
              )}
            </AnimatePresence>

            <label className="remember">
              <input type="checkbox" checked={form.remember} onChange={(e) => set('remember', e.target.checked)} />
              Remember my details and address on this device
            </label>
            <p className="secure-note"><LockKeyhole size={13} strokeWidth={1.5} /> Payment is simulated for this prototype. No money moves and card details are never stored.</p>
          </fieldset>
        </section>

        <aside className="checkout-side" aria-label="Your order">
          <div className="eyebrow eyebrow-light">Your order</div>
          <ul className="side-lines">
            {lines.map((line) => (
              <li key={line.key}><span>{line.product.name}{line.size === 'large' ? ' (L)' : ''} × {line.qty}</span><span className="tabular">{formatPrice(line.lineTotal)}</span></li>
            ))}
          </ul>
          <div className="field box-note">
            <label htmlFor="f-boxNote">Note on the box <span className="optional">optional</span></label>
            <input id="f-boxNote" maxLength={BOX_NOTE_LIMIT + 10} placeholder="Happy birthday, Meera!" value={form.boxNote} onChange={(e) => set('boxNote', e.target.value)} onBlur={blur('boxNote')} aria-describedby="box-count" />
            <span id="box-count" className={`char-count ${form.boxNote.length > BOX_NOTE_LIMIT ? 'is-over' : ''}`}>{form.boxNote.length}/{BOX_NOTE_LIMIT}</span>
            {show('boxNote') && <p className="field-error">{show('boxNote')}</p>}
          </div>
          <dl className="sum-rows on-dark">
            <div><dt>Subtotal</dt><dd><AnimatedNumber value={totals.subtotal} format={formatPrice} /></dd></div>
            <div><dt>{form.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'}</dt><dd>{totals.delivery === 0 ? 'Free' : formatPrice(totals.delivery)}</dd></div>
            <div className="sum-total"><dt>Total</dt><dd><AnimatedNumber value={totals.total} format={formatPrice} /></dd></div>
          </dl>
          <button type="submit" className="btn btn-light btn-block place-order" disabled={phase === 'processing' || !ready}>
            {phase === 'failed' ? 'Try again' : 'Place order'} · {formatPrice(totals.total)}
          </button>
          <p className="side-note">Payment is simulated for this prototype.</p>
        </aside>
      </form>

      <div className="mobile-buy-bar is-dark">
        <span className="display">{formatPrice(totals.total)}</span>
        <button type="submit" form="checkout-form" className="btn btn-light" disabled={phase === 'processing' || !ready}>Place order</button>
      </div>

      <AnimatePresence>{phase === 'processing' && <ProcessingOverlay />}</AnimatePresence>
    </main>
  );
}

type FieldProps = { id: string; label: string; error?: string; hint?: string; optional?: boolean; full?: boolean; children: React.ReactNode };

function Field({ id, label, error, hint, optional, full, children }: FieldProps) {
  return (
    <div className={`field ${full ? 'is-full' : ''} ${error ? 'has-error' : ''}`}>
      <label htmlFor={`f-${id}`}>{label}{optional && <span className="optional"> optional</span>}</label>
      {children}
      <AnimatePresence initial={false}>
        {error && (
          <motion.p id={`e-${id}`} className="field-error" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>{error}</motion.p>
        )}
      </AnimatePresence>
      {!error && hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
