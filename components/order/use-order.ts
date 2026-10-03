'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/components/providers/store-provider';

/** Looks up an order saved on this device; `ready` is false until storage loads. */
export function useOrder(id: string) {
  const { ready, orders, updateOrder } = useStore();
  const order = orders.find((o) => o.id === id.toUpperCase());
  return { ready, order, updateOrder };
}

/** A clock that ticks while the component is mounted. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
