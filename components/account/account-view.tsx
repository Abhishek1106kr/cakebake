'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CreditCard, LogOut, MapPin, ShieldCheck, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useNow } from '@/components/order/use-order';
import { useStore, type Profile } from '@/components/providers/store-provider';
import { checkPin } from '@/lib/delivery/serviceability';
import { formatDateIST, formatPrice } from '@/lib/format';
import { EASE } from '@/lib/motion/transitions';
import { currentStatus, statusCopy } from '@/lib/orders/orders';
import { normalizePhone } from '@/lib/validation/checkout';

export function AccountView() {
  const { ready, profile, setProfile, orders, addresses, saveAddress, removeAddress, forgetEverything } = useStore();
  const now = useNow(5000);
  const [draft, setDraft] = useState<Profile>({ name: '', phone: '', email: '' });
  const [saved, setSaved] = useState(false);
  const [newAddress, setNewAddress] = useState({ line: '', pin: '' });
  const [addressError, setAddressError] = useState('');
  const [confirmForget, setConfirmForget] = useState(false);

  useEffect(() => { if (ready) setDraft(profile ?? { name: '', phone: '', email: '' }); }, [ready, profile]);

  const saveProfile = (event: React.FormEvent) => {
    event.preventDefault();
    setProfile({ name: draft.name.trim(), phone: normalizePhone(draft.phone), email: draft.email.trim() });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  const addAddress = (event: React.FormEvent) => {
    event.preventDefault();
    const pin = checkPin(newAddress.pin);
    if (newAddress.line.trim().length < 10) { setAddressError('Add your flat, building and street.'); return; }
    if (pin.status !== 'ok') { setAddressError(pin.message); return; }
    saveAddress({ label: pin.area, line: newAddress.line.trim(), pin: newAddress.pin });
    setNewAddress({ line: '', pin: '' });
    setAddressError('');
  };

  return (
    <main className="account-shell">
      <div className="wrap">
        <div className="eyebrow eyebrow-light">10 / Account</div>
        <h1 className="account-title display">{ready && profile?.name ? `Good to see you, ${profile.name.split(' ')[0]}.` : 'Your Tresor.'}</h1>
        <p className="account-lede">No password needed. Everything here is kept on this device only.</p>

        <div className="account-grid">
          <section className="account-panel" aria-labelledby="orders-title">
            <h2 id="orders-title" className="panel-title">Orders</h2>
            {!ready && <div aria-hidden="true">{[0, 1, 2].map((i) => <div key={i} className="skeleton-row is-dark" />)}</div>}
            {ready && orders.length === 0 && (
              <div className="panel-empty">
                <p>No orders yet. The first one is always the best one.</p>
                <Link href="/menu" className="btn btn-light btn-sm">Explore menu</Link>
              </div>
            )}
            <ul className="order-history">
              {orders.map((order) => {
                const status = currentStatus(order, now);
                const live = status !== 'DELIVERED';
                return (
                  <li key={order.id}>
                    <Link href={live ? `/track/${order.id}` : `/order/${order.id}`} className="history-row">
                      <span className="history-id">#{order.id}</span>
                      <span className="history-items">{order.items.map((i) => i.name).slice(0, 2).join(', ')}{order.items.length > 2 ? ` +${order.items.length - 2}` : ''}</span>
                      <span className={`history-status ${live ? 'is-live' : ''}`}>{live && <span className="breathing-dot" aria-hidden="true" />}{statusCopy(status, order.fulfilment).label}</span>
                      <span className="history-meta">{formatDateIST(order.createdAt)} · {formatPrice(order.totals.total)}</span>
                      <ArrowRight size={15} strokeWidth={1.4} className="history-arrow" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="account-panel" aria-labelledby="profile-title">
            <h2 id="profile-title" className="panel-title">Profile</h2>
            <form className="dark-form" onSubmit={saveProfile}>
              <label>Name<input value={draft.name} autoComplete="name" onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
              <label>Mobile<input value={draft.phone} type="tel" autoComplete="tel" onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></label>
              <label>Email<input value={draft.email} type="email" autoComplete="email" onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></label>
              <button type="submit" className="btn btn-light btn-sm">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={saved ? 'saved' : 'save'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15, ease: EASE }}>
                    {saved ? 'Saved' : 'Save profile'}
                  </motion.span>
                </AnimatePresence>
              </button>
            </form>
          </section>

          <section className="account-panel" aria-labelledby="addresses-title">
            <h2 id="addresses-title" className="panel-title"><MapPin size={15} strokeWidth={1.4} /> Saved addresses</h2>
            <ul className="address-list">
              <AnimatePresence initial={false}>
                {addresses.map((a) => (
                  <motion.li key={a.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.24, ease: EASE }}>
                    <div><strong>{a.label}</strong><span>{a.line} · {a.pin}</span></div>
                    <button type="button" className="remove-btn" onClick={() => removeAddress(a.id)} aria-label={`Remove address ${a.line}`}><Trash2 size={14} strokeWidth={1.4} /></button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            <form className="dark-form" onSubmit={addAddress}>
              <label>Address<input value={newAddress.line} placeholder="Flat, building, street" onChange={(e) => setNewAddress({ ...newAddress, line: e.target.value })} /></label>
              <label>PIN code<input value={newAddress.pin} inputMode="numeric" maxLength={6} onChange={(e) => setNewAddress({ ...newAddress, pin: e.target.value.replace(/\D/g, '') })} /></label>
              {addressError && <p className="field-error" role="alert">{addressError}</p>}
              <button type="submit" className="btn btn-ghost btn-sm on-dark">Add address</button>
            </form>
          </section>

          <section className="account-panel" aria-labelledby="payments-title">
            <h2 id="payments-title" className="panel-title"><CreditCard size={15} strokeWidth={1.4} /> Payment methods</h2>
            <p className="panel-copy">Saved cards and UPI arrive when payments go live. Until then, every payment on this site is simulated and nothing is stored.</p>
          </section>

          <section className="account-panel" aria-labelledby="privacy-title">
            <h2 id="privacy-title" className="panel-title"><ShieldCheck size={15} strokeWidth={1.4} /> Privacy</h2>
            <p className="panel-copy">Your bag, orders, profile and addresses live in this browser&rsquo;s storage. Nothing is sent to a server, and there are no third-party trackers.</p>
            <div className="privacy-actions">
              <button type="button" className="btn btn-ghost btn-sm on-dark" onClick={() => setProfile(null)}><LogOut size={14} strokeWidth={1.4} /> Sign out (forget profile)</button>
              {confirmForget ? (
                <button type="button" className="btn btn-danger btn-sm" onClick={() => { forgetEverything(); setConfirmForget(false); }}>Yes, delete everything</button>
              ) : (
                <button type="button" className="btn btn-ghost btn-sm on-dark" onClick={() => setConfirmForget(true)}><Trash2 size={14} strokeWidth={1.4} /> Delete all my data</button>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
