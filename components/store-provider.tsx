'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { makeStatusEvent, publishStatus } from '@/lib/tracking/events';
import { canTransition, type TrackingStatus } from '@/lib/tracking/status';
import { onOrderCreated, onStatusChanged, resumePending } from '@/lib/automation/runner';
import { Product, products as menu } from '@/lib/data';
import { emitDomain } from '@/lib/admin/domain-events';
import { onCatalog, startLiveCatalog } from '@/lib/catalog/live';
import { track } from '@/engine/intelligence/events/track';
import {
  CartLine, CheckoutDetails, CheckoutErrors, MAX_QTY_PER_LINE, Order, OrderStatus, Size,
  advanceOrder, calcTotals, cancelOrder, cancelRestoresStock, canCancel, createOrder, lineIdFor,
  makeLine, markRefunded, nextStatus, normalizeCart, normalizeOrder, seedOrders, validateCheckout, makeCustomLine,
} from '@/lib/orders';
import { validate as validateCake } from '@/lib/cake/engine';
import type { CakeConfiguration } from '@/lib/cake/types';
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
export type AddCustomResult = { ok: true; line: CartLine } | { ok: false; errors: string[] };

type StoreContextValue = {
  mounted: boolean;
  // Cart
  cart: CartLine[];
  addToCart: (product: Product, qty?: number, size?: Size) => number;
  updateQty: (lineId: string, qty: number) => void;
  removeFromCart: (lineId: string) => void;
  clearCart: () => void;
  canAddMore: (product: Product, size?: Size) => number;
  addCustomCake: (config: CakeConfiguration, opts?: { artworkAssetId?: string | null; replaceLineId?: string }) => AddCustomResult;
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
  /** Move an order to a specific next status (validated by the state machine). False if not allowed. */
  transition: (orderId: string, to: OrderStatus) => boolean;
  /** Record that the refund of a cancelled, paid order was completed. */
  refund: (orderId: string) => boolean;
  /** Development/testing only: put an order into any state (step by step, so every event fires). */
  devSetStatus: (orderId: string, status: OrderStatus) => void;
  // Inventory
  inventory: Ingredient[];
  movements: Movement[];
  recordMovement: (ingredientId: string, delta: number, reason: MovementReason, meta?: { note?: string; actor?: string }) => void;
  setReorderPoint: (ingredientId: string, value: number) => void;
  resetDemo: () => void;
  /** Bumps when the bakery's catalogue, Cake Builder or settings change (re-render menus and prices). */
  catalogRevision: number;
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<Ingredient[]>(initialInventory);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [latestId, setLatestId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [catalogRevision, setCatalogRevision] = useState(0);

  // Load once, migrate data from the earlier version, then follow other tabs.
  useEffect(() => {
    // The bakery's catalogue first, so the stored bag is priced against today's menu.
    // Subscribe before starting: the first application must bump the revision too,
    // or memoised menus (product page, search) keep the code defaults.
    const offCatalog = onCatalog(() => {
      setCatalogRevision((r) => r + 1);
      setCart((current) => normalizeCart(current));
    });
    const stopCatalog = startLiveCatalog();
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
    // Pick up automation jobs a closed tab left unfinished.
    resumePending((id) => loaded.find((o) => o.id === id));

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
    return () => { window.removeEventListener('storage', onStorage); offCatalog(); stopCatalog(); };
  }, []);

  useEffect(() => { if (mounted) write(KEYS.cart, cart); }, [cart, mounted]);
  useEffect(() => { if (mounted) write(KEYS.orders, orders); }, [orders, mounted]);
  useEffect(() => { if (mounted) write(KEYS.inventory, inventory); }, [inventory, mounted]);
  useEffect(() => { if (mounted) write(KEYS.movements, movements); }, [movements, mounted]);
  useEffect(() => { if (mounted) write(KEYS.latestId, latestId); }, [latestId, mounted]);

  // ---------- Cart ----------

  const canAddMore = (product: Product, size: Size = 'Regular') => {
    // Sold out, or no longer on the menu: the bakery's catalogue decides.
    const live = menu.find((p) => p.id === product.id);
    if (!live || live.available === false) return 0;
    const inLine = cart.find((line) => line.lineId === lineIdFor(product.id, size))?.qty ?? 0;
    return Math.min(availableUnits(inventory, cart, product.id, size), MAX_QTY_PER_LINE - inLine);
  };

  /** Adds up to `qty`, limited by stock and the per-line maximum. Returns how many were added. */
  const addToCart = (product: Product, qty = 1, size: Size = 'Regular') => {
    const allowed = Math.max(0, Math.min(qty, canAddMore(product, size)));
    if (allowed === 0) return 0;
    track('product_added', { productId: product.id, qty: allowed, size });
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
    const target = cart.find((l) => l.lineId === lineId);
    if (target && qty <= 0) track('product_removed', { productId: target.product.id, qty: target.qty });
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

  /** Adds a custom cake after validating it against live stock and season. Same design replaces itself. */
  const addCustomCake = (config: CakeConfiguration, opts: { artworkAssetId?: string | null; replaceLineId?: string } = {}): AddCustomResult => {
    const errors = validateCake(config, { inventory, month: new Date().getMonth() + 1 }).filter((i) => i.level === 'error').map((i) => i.message);
    if (errors.length) return { ok: false, errors };
    const line = makeCustomLine(config, 1, { artworkAssetId: opts.artworkAssetId ?? null });
    setCart((current) => [...current.filter((l) => l.lineId !== line.lineId && l.lineId !== opts.replaceLineId), line]);
    track('custom_cake_added_to_cart', {
      designId: line.custom!.designId, total: line.unitPrice, productionHours: line.custom!.productionHours,
      size: config.size, sponge: config.sponge, hasPrint: config.print.enabled, messageLength: config.message.text.length, toppings: config.toppings.length,
    });
    return { ok: true, line };
  };

  const removeFromCart = (lineId: string) => {
    const target = cart.find((l) => l.lineId === lineId);
    if (target) track('product_removed', { productId: target.product.id, qty: target.qty });
    setCart((current) => current.filter((line) => line.lineId !== lineId));
  };
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
    onOrderCreated(order);
    publishStatus(makeStatusEvent(order, null, order.status, 'system'));
    emitDomain('order.created', order.id, { total: order.total, status: order.status, items: order.items.length, custom: order.items.some((l) => l.custom) });
    for (const l of order.items) if (l.custom) emitDomain('customCake.created', order.id, { designId: l.custom.designId, productionHours: l.custom.productionHours });
    const after = applyLines(inventory, order.items, -1);
    setOrders((current) => [order, ...current]);
    setInventory((current) => applyLines(current, order.items, -1));
    emitDomain('inventory.changed', order.id, { reason: 'order' });
    // Events carry ids and amounts only, never the customer's details.
    track('order_created', { orderId: order.id, total: order.total, items: order.items.map((l) => ({ productId: l.product.id, qty: l.qty, size: l.size })), paymentMethod: order.paymentMethod });
    for (const l of order.items) if (l.custom) track('custom_cake_ordered', { designId: l.custom.designId, orderId: order.id, total: l.unitPrice });
    if (order.paymentMethod !== 'COD') track('payment_success', { method: order.paymentMethod, amount: order.total, simulated: true });
    for (const p of menu) {
      if (availableUnits(inventory, [], p.id, 'Regular') > 0 && availableUnits(after, [], p.id, 'Regular') === 0) track('product_out_of_stock', { productId: p.id });
    }
    setLatestId(order.id);
    setCart([]);
    return { ok: true, order };
  };

  // The latest orders, readable synchronously: rapid transitions (double clicks, test
  // controls) must each start from the state the previous one produced, not a stale render.
  const ordersRef = useRef<Order[]>(orders);
  ordersRef.current = orders;

  /**
   * The one way an order changes status. Validates the step against the state machine,
   * updates the order, publishes the status event (tracking pages in every tab) and
   * triggers the WhatsApp automation, all from the same transition.
   */
  const applyTransition = (orderId: string, to: TrackingStatus, source: 'admin' | 'system' | 'dev' = 'admin'): boolean => {
    const order = ordersRef.current.find((o) => o.id === orderId);
    if (!order || !canTransition(order.status, to) || to === 'PAYMENT_FAILED') return false;
    const now = new Date();
    const updated = to === 'CANCELLED' ? cancelOrder(order, now) : advanceOrder(order, now);
    if (updated.status !== to) return false;
    if (to === 'CANCELLED') {
      if (cancelRestoresStock(order)) setInventory((current) => applyLines(current, order.items, 1));
      track('order_cancelled', { orderId, stage: order.status, restoredStock: cancelRestoresStock(order) });
    } else {
      track('delivery_status_changed', { orderId, status: to });
    }
    const next = ordersRef.current.map((o) => (o.id === orderId ? updated : o));
    ordersRef.current = next;
    setOrders(next);
    publishStatus(makeStatusEvent(updated, order.status, to, source, now));
    emitDomain('order.status.changed', orderId, { from: order.status, to, source });
    if (order.items.some((l) => l.custom)) emitDomain('customCake.updated', orderId, { status: to });
    if (to === 'CANCELLED' && cancelRestoresStock(order)) emitDomain('inventory.changed', orderId, { reason: 'cancellation' });
    onStatusChanged(updated, to);
    return true;
  };

  const transition = (orderId: string, to: OrderStatus): boolean => {
    const order = ordersRef.current.find((o) => o.id === orderId);
    if (!order) return false;
    if (to === 'CANCELLED') return canCancel(order) ? applyTransition(orderId, 'CANCELLED', 'admin') : false;
    return nextStatus(order.status) === to ? applyTransition(orderId, to, 'admin') : false;
  };

  const refund = (orderId: string): boolean => {
    const order = ordersRef.current.find((o) => o.id === orderId);
    if (!order || order.paymentStatus !== 'REFUND_PENDING') return false;
    const updated = markRefunded(order);
    const next = ordersRef.current.map((o) => (o.id === orderId ? updated : o));
    ordersRef.current = next;
    setOrders(next);
    emitDomain('order.refunded', orderId, { amount: order.total });
    return true;
  };

  const advance = (orderId: string) => {
    const order = ordersRef.current.find((o) => o.id === orderId);
    const next = order && nextStatus(order.status);
    if (next) applyTransition(orderId, next, 'admin');
  };

  const cancel = (orderId: string) => {
    const order = ordersRef.current.find((o) => o.id === orderId);
    if (order && canCancel(order)) applyTransition(orderId, 'CANCELLED', 'admin');
  };

  const devSetStatus = (orderId: string, status: OrderStatus) => {
    if (process.env.NODE_ENV === 'production') return;
    const order = ordersRef.current.find((o) => o.id === orderId);
    if (!order) return;
    const flow: OrderStatus[] = ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    // Going backwards (or out of a terminal state) resets to NEW first, then steps forward.
    if (status === 'NEW' || order.status === 'CANCELLED' || flow.indexOf(status) < flow.indexOf(order.status)) {
      const now = new Date();
      const reset: Order = { ...order, status: 'NEW', history: [{ status: 'NEW', at: now.toISOString() }], paymentStatus: order.paymentMethod === 'COD' ? 'DUE' : 'PAID' };
      const next = ordersRef.current.map((o) => (o.id === orderId ? reset : o));
      ordersRef.current = next;
      setOrders(next);
      publishStatus(makeStatusEvent(reset, order.status, 'NEW', 'dev', now));
    }
    if (status === 'CANCELLED') { applyTransition(orderId, 'CANCELLED', 'dev'); return; }
    for (let guard = 0; guard < 6; guard += 1) {
      const cur = ordersRef.current.find((o) => o.id === orderId)!;
      if (cur.status === status) break;
      const step = nextStatus(cur.status);
      if (!step || !applyTransition(orderId, step, 'dev')) break;
    }
  };

  // ---------- Inventory ----------

  const recordMovement = (ingredientId: string, delta: number, reason: MovementReason, meta: { note?: string; actor?: string } = {}) => {
    if (!delta) return;
    track('inventory_updated', { ingredientId, delta, reason });
    setInventory((current) => applyMovement(current, ingredientId, delta, reason));
    const movement: Movement = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString(), ingredientId, delta, reason,
      ...(meta.note ? { note: meta.note.slice(0, 200) } : {}), ...(meta.actor ? { actor: meta.actor } : {}),
    };
    setMovements((current) => [movement, ...current].slice(0, 500));
    emitDomain('inventory.changed', ingredientId, { delta, reason });
  };

  const setReorderPoint = (ingredientId: string, value: number) => {
    if (!(value >= 0 && Number.isFinite(value))) return;
    setInventory((current) => current.map((i) => (i.id === ingredientId ? { ...i, reorderPoint: Math.round(value * 1000) / 1000 } : i)));
    emitDomain('inventory.changed', ingredientId, { reorderPoint: value });
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
    mounted, cart, addToCart, updateQty, removeFromCart, clearCart, canAddMore, addCustomCake,
    cartCount: totals.itemCount, subtotal: totals.subtotal, deliveryFee: totals.delivery, total: totals.total, toFreeDelivery: totals.toFreeDelivery,
    orders, myOrders, latestOrder: orders.find((o) => o.id === latestId) ?? null, findOrder: (id) => orders.find((o) => o.id === id),
    placeOrder, advance, cancel, transition, refund, devSetStatus, inventory, movements, recordMovement, setReorderPoint, resetDemo, catalogRevision,
  };
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside StoreProvider');
  return value;
}
