'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Product } from '@/lib/data';
import {
  CartLine, CheckoutDetails, CheckoutErrors, MAX_QTY_PER_LINE, Order, Size,
  advanceOrder, calcTotals, cancelOrder, cancelRestoresStock, canCancel, createOrder, lineIdFor,
  makeLine, nextStatus, normalizeCart, normalizeOrder, seedOrders, validateCheckout,
} from '@/lib/orders';
import {
  Ingredient, Movement, MovementReason, applyLines, applyMovement, availableUnits,
  initialInventory, mergeInventory, shortLines,
} from '@/lib/inventory';

// All business logic runs in the browser. State is saved to localStorage and
// kept in sync across tabs, so an order placed in the shop appears in the
// admin, and kitchen updates show on the customer's tracking page.

const KEYS = {
  cart: 'tresor-cart',
  orders: 'tresor-orders',
  inventory: 'tresor-inventory',
  movements: 'tresor-movements',
  latestId: 'tresor-latest-order-id',
  legacyLatest: 'tresor-latest-order', // written by the earlier version
};

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function parseOrders(raw: unknown): Order[] {
  return Array.isArray(raw) ? raw.map(normalizeOrder).filter((o): o is Order => o !== null) : [];
}

export type PlaceOrderResult = { ok: true; order: Order } | { ok: false; errors: CheckoutErrors };

type StoreContextValue = {
  mounted: boolean;
  // Cart
  cart: CartLine[];
  addToCart: (product: Product, qty?: number, size?: Size) => number;
  updateQty: (lineId: string, qty: number) => void;
  removeFromCart: (lineId: string) => void;
  clearCart: () => void;
  canAddMore: (product: Product, size?: Size) => number;
  cartCount: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  toFreeDelivery: number;
  // Orders
  orders: Order[];
  myOrders: Order[];
  latestOrder: Order | null;
  findOrder: (id: string) => Order | undefined;
  placeOrder: (details: CheckoutDetails) => PlaceOrderResult;
  advance: (orderId: string) => void;
  cancel: (orderId: string) => void;
  // Inventory
  inventory: Ingredient[];
  movements: Movement[];
  recordMovement: (ingredientId: string, delta: number, reason: MovementReason) => void;
  resetDemo: () => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<Ingredient[]>(initialInventory);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [latestId, setLatestId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Load once, migrate data from the earlier version, then follow other tabs.
  useEffect(() => {
    const storedOrders = read<unknown[]>(KEYS.orders);
    let loaded = storedOrders ? parseOrders(storedOrders) : seedOrders(new Date());
    let latest = read<string>(KEYS.latestId);
    const legacy = normalizeOrder(read(KEYS.legacyLatest));
    if (legacy && !loaded.some((o) => o.id === legacy.id)) {
      loaded = [legacy, ...loaded];
      latest = latest ?? legacy.id;
    }
    try { localStorage.removeItem(KEYS.legacyLatest); } catch {}

    setCart(normalizeCart(read(KEYS.cart)));
    setOrders(loaded);
    setInventory(mergeInventory(read(KEYS.inventory)));
    setMovements(read<Movement[]>(KEYS.movements) ?? []);
    setLatestId(latest);
    setMounted(true);

    const onStorage = (event: StorageEvent) => {
      if (!event.key || !event.newValue) return;
      try {
        const value = JSON.parse(event.newValue);
        if (event.key === KEYS.cart) setCart(normalizeCart(value));
        if (event.key === KEYS.orders) setOrders(parseOrders(value));
        if (event.key === KEYS.inventory) setInventory(mergeInventory(value));
        if (event.key === KEYS.movements && Array.isArray(value)) setMovements(value);
        if (event.key === KEYS.latestId) setLatestId(value);
      } catch {}
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => { if (mounted) write(KEYS.cart, cart); }, [cart, mounted]);
  useEffect(() => { if (mounted) write(KEYS.orders, orders); }, [orders, mounted]);
  useEffect(() => { if (mounted) write(KEYS.inventory, inventory); }, [inventory, mounted]);
  useEffect(() => { if (mounted) write(KEYS.movements, movements); }, [movements, mounted]);
  useEffect(() => { if (mounted) write(KEYS.latestId, latestId); }, [latestId, mounted]);

  // ---------- Cart ----------

  const canAddMore = (product: Product, size: Size = 'Regular') => {
    const inLine = cart.find((line) => line.lineId === lineIdFor(product.id, size))?.qty ?? 0;
    return Math.min(availableUnits(inventory, cart, product.id, size), MAX_QTY_PER_LINE - inLine);
  };

  /** Adds up to `qty`, limited by stock and the per-line maximum. Returns how many were added. */
  const addToCart = (product: Product, qty = 1, size: Size = 'Regular') => {
    const allowed = Math.max(0, Math.min(qty, canAddMore(product, size)));
    if (allowed === 0) return 0;
    const id = lineIdFor(product.id, size);
    setCart((current) => {
      const existing = current.find((line) => line.lineId === id);
      return existing
        ? current.map((line) => (line.lineId === id ? { ...line, qty: line.qty + allowed } : line))
        : [...current, makeLine(product, size, allowed)];
    });
    return allowed;
  };

  const updateQty = (lineId: string, qty: number) => {
    setCart((current) => {
      const line = current.find((l) => l.lineId === lineId);
      if (!line) return current;
      if (qty <= 0) return current.filter((l) => l.lineId !== lineId);
      const extra = qty - line.qty;
      const capped = extra > 0
        ? line.qty + Math.min(extra, availableUnits(inventory, current, line.product.id, line.size), MAX_QTY_PER_LINE - line.qty)
        : qty;
      return current.map((l) => (l.lineId === lineId ? { ...l, qty: capped } : l));
    });
  };

  const removeFromCart = (lineId: string) => setCart((current) => current.filter((line) => line.lineId !== lineId));
  const clearCart = () => setCart([]);

  // ---------- Orders ----------

  const placeOrder = (details: CheckoutDetails): PlaceOrderResult => {
    const errors = validateCheckout({ ...details.customer, address: details.address, pin: details.pin }, cart);
    if (Object.keys(errors).length) return { ok: false, errors };
    const short = shortLines(inventory, cart);
    if (short.length) {
      return { ok: false, errors: { cart: `We've just run low on ${short.map((l) => l.product.name).join(', ')}. Please reduce the quantity.` } };
    }
    const order = createOrder(details, cart, orders, new Date());
    setOrders((current) => [order, ...current]);
    setInventory((current) => applyLines(current, order.items, -1));
    setLatestId(order.id);
    setCart([]);
    return { ok: true, order };
  };

  const advance = (orderId: string) => {
    setOrders((current) => current.map((o) => (o.id === orderId && nextStatus(o.status) ? advanceOrder(o, new Date()) : o)));
  };

  const cancel = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order || !canCancel(order)) return;
    if (cancelRestoresStock(order)) setInventory((current) => applyLines(current, order.items, 1));
    setOrders((current) => current.map((o) => (o.id === orderId ? cancelOrder(o, new Date()) : o)));
  };

  // ---------- Inventory ----------

  const recordMovement = (ingredientId: string, delta: number, reason: MovementReason) => {
    if (!delta) return;
    setInventory((current) => applyMovement(current, ingredientId, delta));
    const movement: Movement = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString(), ingredientId, delta, reason };
    setMovements((current) => [movement, ...current].slice(0, 50));
  };

  const resetDemo = () => {
    setOrders(seedOrders(new Date()));
    setInventory(initialInventory);
    setMovements([]);
    setLatestId(null);
  };

  const totals = calcTotals(cart);
  const myOrders = orders.filter((o) => o.source === 'online');

  const value: StoreContextValue = {
    mounted, cart, addToCart, updateQty, removeFromCart, clearCart, canAddMore,
    cartCount: totals.itemCount, subtotal: totals.subtotal, deliveryFee: totals.delivery, total: totals.total, toFreeDelivery: totals.toFreeDelivery,
    orders, myOrders, latestOrder: orders.find((o) => o.id === latestId) ?? null, findOrder: (id) => orders.find((o) => o.id === id),
    placeOrder, advance, cancel, inventory, movements, recordMovement, resetDemo,
  };
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside StoreProvider');
  return value;
}
