'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, MessageCircle } from 'lucide-react';
import { useReducedMotionSafe } from '@/components/cinematic';
import { CakePreview } from '@/components/cake-studio/preview';
import { assetUrl } from '@/lib/cake/assets';
import { find } from '@/lib/cake/engine';
import { deliveryProgress, estimate, hasCustomCake, statusCopy } from '@/lib/tracking/status';
import { EASE } from '@/lib/motion';
import { useOrderTracking } from './provider';
import { StatusScene } from './scenes';
import { TrackingTimeline } from './timeline';
import { TrackingDevControls } from './dev-controls';

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** The customer's photo, only if this device still has it. Never pretends a server does. */
function useLocalPhoto(assetId: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let made: string | null = null;
    if (assetId) assetUrl(assetId).then((u) => { made = u; setUrl(u); });
    return () => { if (made) URL.revokeObjectURL(made); };
  }, [assetId]);
  return url;
}

function Summary() {
  const { order } = useOrderTracking();
  const custom = order?.items.find((l) => l.custom)?.custom;
  const photo = useLocalPhoto(custom?.config.print.enabled ? custom.config.print.assetId : null);
  if (!order) return null;
  return (
    <section className="track-summary" aria-labelledby="track-summary-title">
      <div className="track-summary-head"><h2 id="track-summary-title">Order #{order.id}</h2><span>{order.slot}</span></div>
      <ul className="track-items">
        {order.items.map((l) => <li key={l.lineId}><span>{l.qty} × {l.custom ? l.custom.title : l.product.name}{l.size === 'Large' ? ' (Large)' : ''}</span><span>{rupees(l.unitPrice * l.qty)}</span></li>)}
        {order.delivery > 0 && <li className="muted"><span>Delivery</span><span>{rupees(order.delivery)}</span></li>}
        <li className="track-total"><span>Total</span><span>{rupees(order.total)}{order.paymentStatus === 'DUE' ? ' · pay at the door' : ' · paid (simulated)'}</span></li>
      </ul>
      {custom && (
        <details className="track-cake">
          <summary>Your custom cake <ChevronDown size={14} /></summary>
          <div className="track-cake-body">
            <div className="track-cake-preview"><CakePreview config={custom.config} view={custom.config.print.enabled || custom.config.message.text ? 'top' : 'front'} printUrl={photo} /></div>
            <dl>
              <div><dt>Size</dt><dd>{find('size', custom.config.size)?.name} · {find('shape', custom.config.shape)?.name}</dd></div>
              <div><dt>Inside</dt><dd>{find('sponge', custom.config.sponge)?.name} · {find('filling', custom.config.filling)?.name}</dd></div>
              <div><dt>Outside</dt><dd>{find('frosting', custom.config.frosting)?.name} · {find('finish', custom.config.finish)?.name} · {find('color', custom.config.color)?.name}</dd></div>
              {custom.config.message.text && <div><dt>Message</dt><dd>“{custom.config.message.text.replace(/\n/g, ' / ')}”</dd></div>}
              <div><dt>Photo print</dt><dd>{custom.config.print.enabled ? (photo ? 'Yes' : 'Yes (photo kept on the device you ordered from)') : 'No'}</dd></div>
            </dl>
          </div>
        </details>
      )}
    </section>
  );
}

function Whisper() {
  const { connection, lastUpdated } = useOrderTracking();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(t); }, []);
  const mins = lastUpdated ? Math.round((Date.now() - lastUpdated) / 60000) : 0;
  const text = connection === 'RECONNECTING' || connection === 'OFFLINE' ? 'Updating your order…' : connection === 'STALE' && mins >= 2 ? `Last updated ${mins} min ago` : null;
  return <AnimatePresence>{text && <motion.p className="track-whisper" role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{text}</motion.p>}</AnimatePresence>;
}

export function TrackingExperience() {
  const { order, status, loading, error, retry, orderId } = useOrderTracking();
  const reduce = useReducedMotionSafe();
  const [now, setNow] = useState(() => new Date());
  // ETA wording and the delivery marker move on slowly; nothing else re-renders.
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  const cake = order ? hasCustomCake(order) : false;
  const eta = useMemo(() => (order && status ? estimate(order, status, now) : null), [order, status, now]);
  const progress = order && status === 'OUT_FOR_DELIVERY' ? deliveryProgress(order, now) : 0;

  if (loading) return <main className="track-v2"><div className="container track-loading" aria-busy="true"><span className="eyebrow">Tresor</span><p>Finding your order…</p></div></main>;
  if (error || !order || !status) {
    return (
      <main className="track-v2">
        <div className="container track-error">
          <span className="eyebrow">Tracking order</span>
          <h1 className="track-headline">{error === 'unknown' ? `We couldn’t find #${orderId}.` : 'Something went wrong loading this order.'}</h1>
          <p className="muted">{error === 'unknown' ? 'Orders are kept on the device they were placed from. Check the number, or open the link from that device.' : 'Please try again in a moment.'}</p>
          <div className="track-error-actions"><button type="button" className="btn btn-brand" onClick={retry}>Try again</button><Link className="btn btn-ghost" href="/shop">Browse the menu</Link></div>
        </div>
      </main>
    );
  }

  const copy = statusCopy(status, { cake });
  const stagger = { hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : 0.12, delayChildren: reduce ? 0 : 0.1 } } };
  const item = { hidden: reduce ? { opacity: 1 } : { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } } };

  return (
    <main className={`track-v2 status-${status.toLowerCase()}`}>
      <motion.div className="container track-wrap" initial="hidden" animate="show" variants={stagger}>
        <motion.header className="track-top" variants={item}>
          <span className="eyebrow">Tresor · tracking order</span>
          <span className="track-number">#{order.id}</span>
        </motion.header>

        <section className="track-hero" aria-live="polite">
          <motion.div className="track-copy" variants={item}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={status} initial={reduce ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.98 }} transition={{ duration: reduce ? 0 : 0.55, ease: EASE }}>
                <h1 className="track-headline">{copy.headline}</h1>
                <p className="track-line">{copy.line}</p>
              </motion.div>
            </AnimatePresence>
            {eta && eta.value && (
              <div className="track-eta">
                <span>{eta.title}</span>
                <strong>{eta.value}</strong>
                {eta.detail && <small>{eta.detail}</small>}
              </div>
            )}
            <Whisper />
          </motion.div>
          <motion.div className="track-stage" variants={item}>
            <AnimatePresence mode="wait" initial={false}>
              <StatusScene key={status} status={status} order={order} progress={progress} />
            </AnimatePresence>
          </motion.div>
        </section>

        <motion.section className="track-progress" variants={item} aria-labelledby="track-progress-title">
          <h2 id="track-progress-title" className="sr-only">Progress</h2>
          <TrackingTimeline order={order} status={status} reduce={reduce} />
        </motion.section>

        <motion.div variants={item}><Summary /></motion.div>

        <motion.footer className="track-help" variants={item}>
          <MessageCircle size={16} aria-hidden="true" />
          <span>Need help with this order?</span>
          <Link href="/contact">Contact Tresor</Link>
        </motion.footer>
      </motion.div>
      <TrackingDevControls />
    </main>
  );
}
