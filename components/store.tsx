'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Product } from '@/lib/products';

type CartLine = Product & { quantity: number };
type Store = {
  cart: CartLine[];
  addToCart: (product: Product, quantity?: number) => void;
  setQuantity: (slug: string, quantity: number) => void;
  removeFromCart: (slug: string) => void;
  subtotal: number;
  delivery: number;
  total: number;
  clearCart: () => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('tresor-cart');
      if (raw) setCart(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem('tresor-cart', JSON.stringify(cart));
  }, [cart]);

  const value = useMemo<Store>(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const delivery = subtotal > 1000 || subtotal === 0 ? (subtotal === 0 ? 0 : 0) : 40;
    return {
      cart,
      addToCart(product, quantity = 1) {
        setCart(current => {
          const existing = current.find(item => item.slug === product.slug);
          if (existing) return current.map(item => item.slug === product.slug ? { ...item, quantity: item.quantity + quantity } : item);
          return [...current, { ...product, quantity }];
        });
      },
      setQuantity(slug, quantity) {
        if (quantity <= 0) {
          setCart(current => current.filter(item => item.slug !== slug));
        } else {
          setCart(current => current.map(item => item.slug === slug ? { ...item, quantity } : item));
        }
      },
      removeFromCart(slug) { setCart(current => current.filter(item => item.slug !== slug)); },
      subtotal,
      delivery,
      total: subtotal + delivery,
      clearCart() { setCart([]); },
    };
  }, [cart]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const value = useContext(Ctx);
  if (!value) throw new Error('useStore must be used within StoreProvider');
  return value;
}
