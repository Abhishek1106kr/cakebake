// Ingredient inventory: what's on the shelf, what each product uses, and how
// many of a product can still be made. Pure functions only.
// Starting levels and recipes are sample values to confirm with the bakery.

import type { CartLine, Size } from './orders';
import { ingredientsFor } from './cake/engine';

export type Unit = 'kg' | 'L' | 'pcs';
/** `reserved`: set aside by hand (an event, a large order) and not available to the shop. */
export type Ingredient = { id: string; name: string; area: 'Coffee' | 'Bar' | 'Baking' | 'Kitchen'; unit: Unit; onHand: number; reorderPoint: number; reserved?: number };
export type StockState = 'Out' | 'Low' | 'Healthy';
/** Four-level view for operations: Critical is at or under half the reorder point. */
export type StockLevel = 'HEALTHY' | 'LOW' | 'CRITICAL' | 'OUT';
export type MovementReason = 'Restock' | 'Wastage' | 'Correction' | 'Reserve' | 'Release';
export type Movement = { id: string; at: string; ingredientId: string; delta: number; reason: MovementReason; note?: string; actor?: string };

export const initialInventory: Ingredient[] = [
  { id: 'beans', name: 'Arabica beans', area: 'Coffee', unit: 'kg', onHand: 2.1, reorderPoint: 4 },
  { id: 'milk', name: 'Whole milk', area: 'Kitchen', unit: 'L', onHand: 18, reorderPoint: 10 },
  { id: 'vanilla', name: 'Vanilla syrup', area: 'Bar', unit: 'L', onHand: 0.8, reorderPoint: 1 },
  { id: 'flour', name: 'Bread flour', area: 'Baking', unit: 'kg', onHand: 12, reorderPoint: 5 },
  { id: 'almond-flour', name: 'Almond flour', area: 'Baking', unit: 'kg', onHand: 1.4, reorderPoint: 2 },
  { id: 'butter', name: 'Butter', area: 'Baking', unit: 'kg', onHand: 2.8, reorderPoint: 1.5 },
  { id: 'chocolate', name: 'Dark chocolate', area: 'Baking', unit: 'kg', onHand: 3.2, reorderPoint: 1.5 },
  { id: 'cream-cheese', name: 'Cream cheese', area: 'Kitchen', unit: 'kg', onHand: 2.4, reorderPoint: 1.5 },
  { id: 'eggs', name: 'Eggs', area: 'Kitchen', unit: 'pcs', onHand: 60, reorderPoint: 30 },
  { id: 'pistachio', name: 'Pistachio paste', area: 'Baking', unit: 'kg', onHand: 0.6, reorderPoint: 0.5 },
  { id: 'tea', name: 'Black tea', area: 'Bar', unit: 'kg', onHand: 0.9, reorderPoint: 0.3 },
  { id: 'citrus', name: 'Citrus syrup', area: 'Bar', unit: 'L', onHand: 1.6, reorderPoint: 0.8 },
  { id: 'mushrooms', name: 'Mushrooms', area: 'Kitchen', unit: 'kg', onHand: 3, reorderPoint: 2 },
  { id: 'sourdough', name: 'Sourdough bread', area: 'Kitchen', unit: 'kg', onHand: 4, reorderPoint: 2 },
  { id: 'potatoes', name: 'Potatoes', area: 'Kitchen', unit: 'kg', onHand: 9, reorderPoint: 5 },
  { id: 'truffle-oil', name: 'Truffle oil', area: 'Kitchen', unit: 'L', onHand: 0.35, reorderPoint: 0.25 },
  { id: 'yogurt', name: 'Greek yogurt', area: 'Kitchen', unit: 'kg', onHand: 4, reorderPoint: 2 },
  { id: 'berries', name: 'Mixed berries', area: 'Kitchen', unit: 'kg', onHand: 1.8, reorderPoint: 1 },
  { id: 'matcha', name: 'Ceremonial matcha', area: 'Bar', unit: 'kg', onHand: 0.12, reorderPoint: 0.15 },
  { id: 'sugar', name: 'Cane sugar', area: 'Baking', unit: 'kg', onHand: 14, reorderPoint: 6 },
  { id: 'cardamom', name: 'Green cardamom', area: 'Baking', unit: 'kg', onHand: 0.4, reorderPoint: 0.15 },
  { id: 'wholewheat', name: 'Wholewheat flour', area: 'Baking', unit: 'kg', onHand: 8, reorderPoint: 4 },
  { id: 'olive-oil', name: 'Olive oil', area: 'Kitchen', unit: 'L', onHand: 3, reorderPoint: 1.5 },
  { id: 'cocoa', name: 'Cocoa powder', area: 'Baking', unit: 'kg', onHand: 1.2, reorderPoint: 0.5 },
  { id: 'mascarpone', name: 'Mascarpone', area: 'Kitchen', unit: 'kg', onHand: 1.5, reorderPoint: 0.8 },
  { id: 'lemons', name: 'Lemons', area: 'Kitchen', unit: 'pcs', onHand: 30, reorderPoint: 12 },
  { id: 'mango-pulp', name: 'Alphonso mango pulp', area: 'Kitchen', unit: 'kg', onHand: 1.5, reorderPoint: 1 },
  { id: 'feta', name: 'Feta', area: 'Kitchen', unit: 'kg', onHand: 1, reorderPoint: 0.5 },
  { id: 'spinach', name: 'Spinach', area: 'Kitchen', unit: 'kg', onHand: 1.5, reorderPoint: 0.8 },
  { id: 'paneer', name: 'Paneer', area: 'Kitchen', unit: 'kg', onHand: 2, reorderPoint: 1 },
  { id: 'dried-fruit', name: 'Dried fruit and peel', area: 'Baking', unit: 'kg', onHand: 0.5, reorderPoint: 0.5 },
  { id: 'filter-powder', name: 'Filter coffee powder', area: 'Coffee', unit: 'kg', onHand: 1.5, reorderPoint: 0.6 },
];

/** Ingredient use per regular unit, keyed by product id. */
export const recipes: Record<string, Record<string, number>> = {
  'almond-croissant': { flour: 0.06, butter: 0.03, 'almond-flour': 0.025 },
  'pain-au-chocolat': { flour: 0.06, butter: 0.03, chocolate: 0.02 },
  'tresor-latte': { beans: 0.018, milk: 0.2, vanilla: 0.005 },
  'cold-brew': { beans: 0.025, vanilla: 0.03, milk: 0.05 },
  'basque-cheesecake': { 'cream-cheese': 0.12, eggs: 1 },
  'pistachio-tart': { flour: 0.04, butter: 0.02, pistachio: 0.03, berries: 0.02 },
  'chocolate-brownie': { chocolate: 0.05, butter: 0.03, eggs: 1, flour: 0.02 },
  'citrus-tea': { tea: 0.005, citrus: 0.04 },
  'mushroom-toast': { mushrooms: 0.12, sourdough: 0.08 },
  'truffle-fries': { potatoes: 0.25, 'truffle-oil': 0.005 },
  'berry-parfait': { yogurt: 0.15, berries: 0.06 },
  'matcha-cloud': { matcha: 0.004, milk: 0.2, vanilla: 0.01 },
  'butter-croissant': { flour: 0.07, butter: 0.035 },
  'kouign-amann': { flour: 0.06, butter: 0.035, sugar: 0.03 },
  'cardamom-knot': { flour: 0.07, butter: 0.015, sugar: 0.015, cardamom: 0.001 },
  'pain-aux-raisins': { flour: 0.06, butter: 0.03, 'dried-fruit': 0.02, milk: 0.03 },
  'mango-danish': { flour: 0.06, butter: 0.03, 'mango-pulp': 0.05 },
  'country-sourdough': { flour: 0.4, wholewheat: 0.1 },
  'multigrain-sourdough': { flour: 0.25, wholewheat: 0.2 },
  'brioche-loaf': { flour: 0.3, butter: 0.1, eggs: 3, sugar: 0.03 },
  'rosemary-focaccia': { flour: 0.3, 'olive-oil': 0.05 },
  'baguette': { flour: 0.25 },
  'lemon-tart': { flour: 0.03, butter: 0.02, lemons: 1, eggs: 1, sugar: 0.03 },
  'tiramisu-jar': { mascarpone: 0.08, beans: 0.01, cocoa: 0.005, eggs: 1, sugar: 0.02 },
  'salted-caramel-eclair': { flour: 0.02, butter: 0.02, eggs: 1, sugar: 0.03 },
  'macaron-box': { 'almond-flour': 0.06, sugar: 0.06, eggs: 2 },
  'choc-chip-cookie': { flour: 0.03, butter: 0.02, chocolate: 0.02, sugar: 0.02 },
  'festive-gift-box': { flour: 0.15, butter: 0.08, 'almond-flour': 0.04, sugar: 0.08, cardamom: 0.002, 'dried-fruit': 0.05 },
  'cookie-tin': { flour: 0.2, butter: 0.12, sugar: 0.08 },
  'plum-cake': { flour: 0.2, butter: 0.15, eggs: 3, sugar: 0.12, 'dried-fruit': 0.25 },
  'carrot-walnut-slice': { flour: 0.03, eggs: 1, 'cream-cheese': 0.03, sugar: 0.02 },
  'spinach-feta-danish': { flour: 0.06, butter: 0.03, spinach: 0.05, feta: 0.03 },
  'paneer-tikka-puff': { flour: 0.05, butter: 0.025, paneer: 0.04 },
  'mushroom-leek-quiche': { flour: 0.05, butter: 0.03, mushrooms: 0.06, eggs: 2, milk: 0.05 },
  'filter-coffee': { 'filter-powder': 0.012, milk: 0.12, sugar: 0.008 },
  'cappuccino': { beans: 0.018, milk: 0.18 },
  'hot-chocolate': { chocolate: 0.03, milk: 0.25 },
  'masala-chai': { tea: 0.004, milk: 0.12, cardamom: 0.0005, sugar: 0.008 },
};

const SIZE_FACTOR: Record<Size, number> = { Regular: 1, Large: 1.5 };
const round = (n: number) => Math.round(n * 1000) / 1000;

/** Total ingredient needs for a set of cart lines. */
export function needsFor(lines: (Pick<CartLine, 'product' | 'size' | 'qty'> & Partial<Pick<CartLine, 'custom'>>)[]): Record<string, number> {
  const needs: Record<string, number> = {};
  for (const line of lines) {
    if (line.custom) {
      for (const [ingredient, amount] of Object.entries(ingredientsFor(line.custom.config))) needs[ingredient] = round((needs[ingredient] ?? 0) + amount * line.qty);
      continue;
    }
    for (const [ingredient, amount] of Object.entries(recipes[line.product.id] ?? {})) {
      needs[ingredient] = round((needs[ingredient] ?? 0) + amount * SIZE_FACTOR[line.size] * line.qty);
    }
  }
  return needs;
}

/** Applies lines to stock: direction -1 consumes (order placed), +1 restores (early cancel). */
export function applyLines(inventory: Ingredient[], lines: Pick<CartLine, 'product' | 'size' | 'qty'>[], direction: -1 | 1): Ingredient[] {
  const needs = needsFor(lines);
  return inventory.map((item) => (needs[item.id] ? { ...item, onHand: Math.max(0, round(item.onHand + direction * needs[item.id])) } : item));
}

/**
 * How many more of a product (in a size) can be made, after reserving what's
 * already in the bag. Products share ingredients, so the bag matters.
 */
export function availableUnits(inventory: Ingredient[], cart: CartLine[], productId: string, size: Size, cap = 99): number {
  const recipe = recipes[productId];
  if (!recipe) return cap;
  const inBag = needsFor(cart);
  let units = cap;
  for (const [ingredient, amount] of Object.entries(recipe)) {
    const item = inventory.find((i) => i.id === ingredient);
    const left = (item ? availableQty(item) : 0) - (inBag[ingredient] ?? 0);
    units = Math.min(units, Math.floor(left / (amount * SIZE_FACTOR[size]) + 1e-9));
  }
  return Math.max(0, units);
}

/** Lines that can't be fully made from current stock (e.g. another tab used it). */
export function shortLines(inventory: Ingredient[], lines: CartLine[]): CartLine[] {
  const needs = needsFor(lines);
  const short = new Set(inventory.filter((item) => (needs[item.id] ?? 0) > availableQty(item) + 1e-9).map((item) => item.id));
  return lines.filter((line) => Object.keys(line.custom ? ingredientsFor(line.custom.config) : recipes[line.product.id] ?? {}).some((ingredient) => short.has(ingredient)));
}

/** On hand minus what's been set aside by hand. */
export const availableQty = (item: Ingredient) => Math.max(0, round(item.onHand - (item.reserved ?? 0)));

export function stockState(item: Ingredient): StockState {
  if (availableQty(item) <= 0) return 'Out';
  if (availableQty(item) <= item.reorderPoint) return 'Low';
  return 'Healthy';
}

export function stockLevel(item: Ingredient): StockLevel {
  const left = availableQty(item);
  if (left <= 0) return 'OUT';
  if (left <= item.reorderPoint / 2) return 'CRITICAL';
  if (left <= item.reorderPoint) return 'LOW';
  return 'HEALTHY';
}

/**
 * Applies a manual movement. Restock/Wastage/Correction change what's on hand; Reserve and
 * Release move stock in and out of `reserved` (never more than is on hand, never below zero).
 */
export function applyMovement(inventory: Ingredient[], ingredientId: string, delta: number, reason: MovementReason = 'Correction'): Ingredient[] {
  return inventory.map((item) => {
    if (item.id !== ingredientId) return item;
    if (reason === 'Reserve' || reason === 'Release') {
      const reserved = Math.min(item.onHand, Math.max(0, round((item.reserved ?? 0) + (reason === 'Reserve' ? Math.abs(delta) : -Math.abs(delta)))));
      return { ...item, reserved };
    }
    const onHand = Math.max(0, round(item.onHand + delta));
    return { ...item, onHand, reserved: Math.min(item.reserved ?? 0, onHand) };
  });
}

/** Keeps stored levels (and reorder points / reservations set in the admin) for known ingredients and adds any new ones. */
export function mergeInventory(stored: unknown): Ingredient[] {
  if (!Array.isArray(stored)) return initialInventory;
  return initialInventory.map((base) => {
    const saved = stored.find((s: Partial<Ingredient>) => s?.id === base.id) as Partial<Ingredient> | undefined;
    if (!saved || typeof saved.onHand !== 'number') return base;
    return {
      ...base, onHand: saved.onHand,
      ...(typeof saved.reorderPoint === 'number' && saved.reorderPoint >= 0 ? { reorderPoint: saved.reorderPoint } : {}),
      ...(typeof saved.reserved === 'number' && saved.reserved > 0 ? { reserved: Math.min(saved.reserved, saved.onHand) } : {}),
    };
  });
}

export function formatQty(amount: number, unit: Unit): string {
  const value = unit === 'pcs' ? Math.round(amount) : Number(amount.toFixed(amount < 1 ? 2 : 1));
  return `${value} ${unit}`;
}
