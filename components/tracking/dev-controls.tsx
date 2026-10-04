'use client';

// Development-only controls for design review, QA and Playwright: jump to any
// state, play the whole journey, or drop the connection. Not rendered in
// production builds (the NODE_ENV check is compiled away).

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/components/store-provider';
import type { OrderStatus } from '@/lib/orders';
import { useOrderTracking } from './provider';

const STATES: OrderStatus[] = ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

function Controls() {
  const { orderId, status, source } = useOrderTracking();
  const { devSetStatus, advance } = useStore();
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // The journey runs through the admin path (advance), so WhatsApp and every tab see it.
  const play = () => {
    setPlaying(true);
    devSetStatus(orderId, 'NEW');
    let steps = 5;
    const next = () => {
      advance(orderId);
      steps -= 1;
      if (steps > 0) timer.current = setTimeout(next, 2600); else setPlaying(false);
    };
    timer.current = setTimeout(next, 1800);
  };

  return (
    <aside className="track-dev" aria-label="Development tracking controls">
      <strong>Tracking · dev only</strong>
      <div>{STATES.map((s) => <button key={s} type="button" data-status={s} className={status === s ? 'is-active' : ''} onClick={() => devSetStatus(orderId, s)} disabled={playing}>{s.replace(/_/g, ' ')}</button>)}</div>
      <div>
        <button type="button" onClick={play} disabled={playing}>{playing ? 'Playing…' : 'Play order journey'}</button>
        <button type="button" onClick={() => source.simulateDrop(4000)}>Drop connection 4 s</button>
      </div>
    </aside>
  );
}

export function TrackingDevControls() {
  if (process.env.NODE_ENV !== 'development') return null;
  return <Controls />;
}
