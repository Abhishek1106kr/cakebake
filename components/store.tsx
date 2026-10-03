'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Product } from '@/lib/products';
import { CartLine, MAX_QTY, Order, PricedLine, normalizeCart, priceLines, totals } from '@/lib/commerce';

// Cart and orders live in this browser (frontend-only business logic),
// kept in sync across tabs.

const KEYS = { cart: 'tresor-cart', orders: 'tresor-orders' };

type Store = {
  ready: boolean;
  cart: PricedLine[];
  addToCart: (product: Product, quantity?: number) => number;
  setQuantity: (slug: string, quantity: number) => void;
  removeFromCart: (slug: string) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
  delivery: number;
  total: number;
  toFreeDelivery: number;
  orders: Order[];
  saveOrder: (order: Order) => void;
  findOrder: (id: string) => Order | undefined;
};

const Ctx = createContext<Store | null>(null);

function read(key: string): unknown {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(normalizeCart(read(KEYS.cart)));
    const stored = read(KEYS.orders);
    setOrders(Array.isArray(stored) ? (stored as Order[]) : []);
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEYS.cart) setLines(normalizeCart(read(KEYS.cart)));
      if (e.key === KEYS.orders) { const v = read(KEYS.orders); setOrders(Array.isArray(v) ? (v as Order[]) : []); }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => { if (ready) write(KEYS.cart, lines); }, [lines, ready]);
  useEffect(() => { if (ready) write(KEYS.orders, orders); }, [orders, ready]);

  const addToCart = useCallback((product: Product, quantity = 1) => {
    const current = lines.find((l) => l.slug === product.slug)?.quantity ?? 0;
    const added = Math.max(0, Math.min(quantity, MAX_QTY - current));
    if (added === 0) return 0;
    setLines((ls) => ls.some((l) => l.slug === product.slug)
      ? ls.map((l) => (l.slug === product.slug ? { ...l, quantity: l.quantity + added } : l))
      : [...ls, { slug: product.slug, quantity: added }]);
    return added;
  }, [lines]);

  const setQuantity = useCallback((slug: string, quantity: number) => {
    const q = Math.min(MAX_QTY, Math.round(quantity));
    setLines((ls) => (q <= 0 ? ls.filter((l) => l.slug !== slug) : ls.map((l) => (l.slug === slug ? { ...l, quantity: q } : l))));
  }, []);

  const value = useMemo<Store>(() => {
    const cart = priceLines(lines);
    const t = totals(cart);
    return {
      ready,
      cart,
      addToCart,
      setQuantity,
      removeFromCart: (slug) => setLines((ls) => ls.filter((l) => l.slug !== slug)),
      clearCart: () => setLines([]),
      itemCount: t.itemCount,
      subtotal: t.subtotal,
      delivery: t.delivery,
      total: t.total,
      toFreeDelivery: t.toFreeDelivery,
      orders,
      saveOrder: (order) => setOrders((os) => [order, ...os.filter((o) => o.id !== order.id)]),
      findOrder: (id) => orders.find((o) => o.id === id),
    };
  }, [lines, orders, ready, addToCart, setQuantity]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const value = useContext(Ctx);
  if (!value) throw new Error('useStore must be used within StoreProvider');
  return value;
}
