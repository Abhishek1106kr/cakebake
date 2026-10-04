'use client';

// OrderTrackingProvider: the tracking page's only connection to order state.
// It loads a snapshot, subscribes to status events, validates each transition,
// reconciles after a reconnect, and reports connection state. The UI below it
// never touches timers or storage.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Order } from '@/lib/orders';
import { acceptEvent, MockOrderEventSource, type ConnectionState, type OrderStatusEvent } from '@/lib/tracking/events';
import { isTerminal, type TrackingStatus } from '@/lib/tracking/status';

/** Minutes without news (on a live order) before we quietly say when it last updated. */
export const STALE_AFTER_MIN = 2;

type TrackingValue = {
  orderId: string;
  order: Order | null;
  status: TrackingStatus | null;
  /** The last change, so the UI can animate it (null on first load). */
  lastEvent: OrderStatusEvent | null;
  connection: ConnectionState;
  lastUpdated: number | null;
  error: 'unknown' | 'unavailable' | null;
  loading: boolean;
  retry: () => void;
  /** Exposed for development controls only (simulated connection drops). */
  source: MockOrderEventSource;
};

const Ctx = createContext<TrackingValue | null>(null);

export function OrderTrackingProvider({ orderId, children }: { orderId: string; children: ReactNode }) {
  const source = useMemo(() => new MockOrderEventSource(), []);
  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<TrackingStatus | null>(null);
  const [lastEvent, setLastEvent] = useState<OrderStatusEvent | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('RECONNECTING');
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [error, setError] = useState<TrackingValue['error']>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const statusRef = useRef<TrackingStatus | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    source.connect(orderId);
    const offConn = source.onConnection((s) => live && setConnection(s));
    const offEvents = source.subscribe(async (e) => {
      if (!acceptEvent(statusRef.current, e)) return;
      const fresh = await source.snapshot(orderId);
      if (!live) return;
      statusRef.current = e.currentStatus;
      source.setLastKnown(e.currentStatus);
      if (fresh) setOrder(fresh);
      setStatus(e.currentStatus);
      setLastEvent(e);
      setLastUpdated(Date.now());
    });
    source.snapshot(orderId).then((o) => {
      if (!live) return;
      setLoading(false);
      if (!o) { setError('unknown'); return; }
      statusRef.current = o.status;
      source.setLastKnown(o.status);
      setOrder(o);
      setStatus(o.status);
      setLastUpdated(Date.now());
    }).catch(() => { if (live) { setLoading(false); setError('unavailable'); } });
    return () => { live = false; offConn(); offEvents(); source.disconnect(); };
  }, [orderId, source, attempt]);

  // Stale: a live order with no news for a while. Checked twice a minute; nothing re-renders otherwise.
  useEffect(() => {
    const t = setInterval(() => {
      if (!lastUpdated || !status || isTerminal(status)) return;
      if (Date.now() - lastUpdated > STALE_AFTER_MIN * 60000) setConnection((c) => (c === 'CONNECTED' ? 'STALE' : c));
    }, 30000);
    return () => clearInterval(t);
  }, [lastUpdated, status]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  const value: TrackingValue = { orderId, order, status, lastEvent, connection, lastUpdated, error, loading, retry, source };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOrderTracking(): TrackingValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useOrderTracking must be used inside OrderTrackingProvider');
  return v;
}
