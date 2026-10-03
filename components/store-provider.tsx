'use client';

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { Product } from '@/lib/data';

export type CartLine = { product: Product; qty: number };

export type MockOrder = {
  id: string;
  createdAt: string;
  customer: { name: string; phone: string; email: string };
  address: string;
  city: string;
  pin: string;
  slot: string;
  paymentMethod: string;
  subtotal: number;
  delivery: number;
  total: number;
  status: 'NEW' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
  items: CartLine[];
};

type StoreContextValue = {
  cart: CartLine[];
  mounted: boolean;
  addToCart: (product: Product, qty?: number) => void;
  updateQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  cartCount: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  placeOrder: (payload: Omit<MockOrder, 'id' | 'createdAt' | 'subtotal' | 'delivery' | 'total' | 'items' | 'status'>) => MockOrder;
  latestOrder: MockOrder | null;
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [latestOrder, setLatestOrder] = useState<MockOrder | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('tresor-cart') || '[]');
      const order = JSON.parse(localStorage.getItem('tresor-latest-order') || 'null');
      if (Array.isArray(stored)) setCart(stored);
      if (order) setLatestOrder(order);
    } catch {}
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem('tresor-cart', JSON.stringify(cart));
  }, [cart, mounted]);

  const addToCart = (product: Product, qty = 1) => {
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) return current.map((line) => line.product.id === product.id ? { ...line, qty: line.qty + qty } : line);
      return [...current, { product, qty }];
    });
  };
  const updateQty = (productId: string, qty: number) => {
    setCart((current) => qty <= 0 ? current.filter((line) => line.product.id !== productId) : current.map((line) => line.product.id === productId ? { ...line, qty } : line));
  };
  const removeFromCart = (productId: string) => setCart((current) => current.filter((line) => line.product.id !== productId));
  const clearCart = () => setCart([]);
  const cartCount = cart.reduce((sum, line) => sum + line.qty, 0);
  const subtotal = cart.reduce((sum, line) => sum + line.product.price * line.qty, 0);
  const deliveryFee = subtotal === 0 ? 0 : subtotal >= 999 ? 0 : 70;
  const total = subtotal + deliveryFee;

  const placeOrder = (payload: Omit<MockOrder, 'id' | 'createdAt' | 'subtotal' | 'delivery' | 'total' | 'items' | 'status'>) => {
    const order: MockOrder = {
      ...payload,
      id: `TRS-${Math.floor(1000 + Math.random() * 8999)}`,
      createdAt: new Date().toISOString(),
      subtotal,
      delivery: deliveryFee,
      total,
      items: cart,
      status: 'CONFIRMED',
    };
    localStorage.setItem('tresor-latest-order', JSON.stringify(order));
    setLatestOrder(order);
    setCart([]);
    return order;
  };

  const value = useMemo(() => ({ cart, mounted, addToCart, updateQty, removeFromCart, clearCart, cartCount, subtotal, deliveryFee, total, placeOrder, latestOrder }), [cart, mounted, cartCount, subtotal, deliveryFee, total, latestOrder]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside StoreProvider');
  return value;
}
