'use client';

import { useEffect, useState } from 'react';
import { Order, OrderStatus, STATUS_LABEL } from '@/lib/orders';
import { StockState } from '@/lib/inventory';

/** A clock that re-renders every `ms` so elapsed times stay current. */
export function useNow(ms = 30000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const statusTone: Record<OrderStatus, string> = {
  NEW: 'status-blue',
  CONFIRMED: 'status-blue',
  PREPARING: 'status-orange',
  READY: 'status-green',
  OUT_FOR_DELIVERY: 'status-gray',
  DELIVERED: 'status-gray',
  CANCELLED: 'status-red',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`status-badge ${statusTone[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function StockBadge({ state }: { state: StockState }) {
  return <span className={`status-badge ${state === 'Out' ? 'status-red' : state === 'Low' ? 'status-orange' : 'status-green'}`}>{state}</span>;
}

export const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
export const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
export const todayStamp = () => new Date().toISOString().slice(0, 10);
export type { Order };
