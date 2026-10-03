'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Size } from '@/data/products';
import { calculateTotals, clampQty, lineKey, priceLines, type CartLine, type PricedLine, type Totals } from '@/lib/cart/pricing';
import type { Order } from '@/lib/orders/orders';
import { readJSON, removeKeys, STORAGE_KEYS, writeJSON } from '@/lib/storage';

export type Profile = { name: string; phone: string; email: string };
export type SavedAddress = { id: string; label: string; line: string; pin: string };

type Store = {
  ready: boolean;
  cart: CartLine[];
  lines: PricedLine[];
  totals: Totals;
  addToCart: (slug: string, size: Size, qty?: number) => number;
  setQty: (key: string, qty: number) => void;
  removeLine: (key: string) => void;
  clearCart: () => void;
  orders: Order[];
  saveOrder: (order: Order) => void;
  updateOrder: (id: string, update: (order: Order) => Order) => void;
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
  addresses: SavedAddress[];
  saveAddress: (address: Omit<SavedAddress, 'id'>) => void;
  removeAddress: (id: string) => void;
  recent: string[];
  markViewed: (slug: string) => void;
  forgetEverything: () => void;
};

const StoreContext = createContext<Store | null>(null);
const MAX_RECENT = 6;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  // Load once, then follow changes made in other tabs.
  useEffect(() => {
    const load = () => {
      setCart(readJSON<CartLine[]>(STORAGE_KEYS.cart, []).filter((line) => line && line.slug && line.qty > 0));
      setOrders(readJSON<Order[]>(STORAGE_KEYS.orders, []));
      setProfileState(readJSON<Profile | null>(STORAGE_KEYS.profile, null));
      setAddresses(readJSON<SavedAddress[]>(STORAGE_KEYS.addresses, []));
      setRecent(readJSON<string[]>(STORAGE_KEYS.recent, []));
    };
    load();
    setReady(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith('tresor:')) load();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => { if (ready) writeJSON(STORAGE_KEYS.cart, cart); }, [cart, ready]);
  useEffect(() => { if (ready) writeJSON(STORAGE_KEYS.orders, orders); }, [orders, ready]);
  useEffect(() => { if (ready) writeJSON(STORAGE_KEYS.profile, profile); }, [profile, ready]);
  useEffect(() => { if (ready) writeJSON(STORAGE_KEYS.addresses, addresses); }, [addresses, ready]);
  useEffect(() => { if (ready) writeJSON(STORAGE_KEYS.recent, recent); }, [recent, ready]);

  const addToCart = useCallback((slug: string, size: Size, qty = 1) => {
    const key = lineKey(slug, size);
    const existing = cart.find((line) => line.key === key)?.qty ?? 0;
    const next = clampQty(existing + qty);
    const added = next - existing;
    if (added <= 0) return 0;
    setCart((current) => {
      const found = current.find((line) => line.key === key);
      return found
        ? current.map((line) => (line.key === key ? { ...line, qty: next } : line))
        : [...current, { key, slug, size, qty: next }];
    });
    return added;
  }, [cart]);

  const setQty = useCallback((key: string, qty: number) => {
    const next = clampQty(qty);
    setCart((current) => (next === 0 ? current.filter((line) => line.key !== key) : current.map((line) => (line.key === key ? { ...line, qty: next } : line))));
  }, []);

  const removeLine = useCallback((key: string) => setCart((current) => current.filter((line) => line.key !== key)), []);
  const clearCart = useCallback(() => setCart([]), []);

  const saveOrder = useCallback((order: Order) => setOrders((current) => [order, ...current.filter((o) => o.id !== order.id)]), []);
  const updateOrder = useCallback((id: string, update: (order: Order) => Order) => {
    setOrders((current) => current.map((order) => (order.id === id ? update(order) : order)));
  }, []);

  const setProfile = useCallback((next: Profile | null) => setProfileState(next), []);

  const saveAddress = useCallback((address: Omit<SavedAddress, 'id'>) => {
    setAddresses((current) => {
      if (current.some((a) => a.line.trim() === address.line.trim() && a.pin === address.pin)) return current;
      return [{ ...address, id: `addr-${Date.now().toString(36)}` }, ...current].slice(0, 5);
    });
  }, []);
  const removeAddress = useCallback((id: string) => setAddresses((current) => current.filter((a) => a.id !== id)), []);

  const markViewed = useCallback((slug: string) => {
    setRecent((current) => [slug, ...current.filter((s) => s !== slug)].slice(0, MAX_RECENT));
  }, []);

  const forgetEverything = useCallback(() => {
    removeKeys(Object.values(STORAGE_KEYS));
    setCart([]); setOrders([]); setProfileState(null); setAddresses([]); setRecent([]);
  }, []);

  const lines = useMemo(() => priceLines(cart), [cart]);
  const totals = useMemo(() => calculateTotals(lines), [lines]);

  const value = useMemo<Store>(() => ({
    ready, cart, lines, totals, addToCart, setQty, removeLine, clearCart,
    orders, saveOrder, updateOrder, profile, setProfile, addresses, saveAddress, removeAddress,
    recent, markViewed, forgetEverything,
  }), [ready, cart, lines, totals, addToCart, setQty, removeLine, clearCart, orders, saveOrder, updateOrder, profile, setProfile, addresses, saveAddress, removeAddress, recent, markViewed, forgetEverything]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}
