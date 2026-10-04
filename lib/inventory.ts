// Ingredient inventory: what's on the shelf, what each product uses, and how
// many of a product can still be made. Pure functions only.
// Starting levels and recipes are sample values to confirm with the bakery.

import type { CartLine, Size } from './orders';
import { ingredientsFor } from './cake/engine';

export type Unit = 'kg' | 'L' | 'pcs';
export type Ingredient = { id: string; name: string; area: 'Coffee' | 'Bar' | 'Baking' | 'Kitchen'; unit: Unit; onHand: number; reorderPoint: number };
export type StockState = 'Out' | 'Low' | 'Healthy';
export type MovementReason = 'Restock' | 'Wastage' | 'Correction';
export type Movement = { id: string; at: string; ingredientId: string; delta: number; reason: MovementReason };

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
  const reserved = needsFor(cart);
  let units = cap;
  for (const [ingredient, amount] of Object.entries(recipe)) {
    const item = inventory.find((i) => i.id === ingredient);
    const left = (item?.onHand ?? 0) - (reserved[ingredient] ?? 0);
    units = Math.min(units, Math.floor(left / (amount * SIZE_FACTOR[size]) + 1e-9));
  }
  return Math.max(0, units);
}

/** Lines that can't be fully made from current stock (e.g. another tab used it). */
export function shortLines(inventory: Ingredient[], lines: CartLine[]): CartLine[] {
  const needs = needsFor(lines);
  const short = new Set(inventory.filter((item) => (needs[item.id] ?? 0) > item.onHand + 1e-9).map((item) => item.id));
  return lines.filter((line) => Object.keys(line.custom ? ingredientsFor(line.custom.config) : recipes[line.product.id] ?? {}).some((ingredient) => short.has(ingredient)));
}

export function stockState(item: Ingredient): StockState {
  if (item.onHand <= 0) return 'Out';
  if (item.onHand <= item.reorderPoint) return 'Low';
  return 'Healthy';
}

export function applyMovement(inventory: Ingredient[], ingredientId: string, delta: number): Ingredient[] {
  return inventory.map((item) => (item.id === ingredientId ? { ...item, onHand: Math.max(0, round(item.onHand + delta)) } : item));
}

/** Keeps stored levels for known ingredients and adds any that are new in this version. */
export function mergeInventory(stored: unknown): Ingredient[] {
  if (!Array.isArray(stored)) return initialInventory;
  return initialInventory.map((base) => {
    const saved = stored.find((s: Partial<Ingredient>) => s?.id === base.id) as Partial<Ingredient> | undefined;
    return saved && typeof saved.onHand === 'number' ? { ...base, onHand: saved.onHand } : base;
  });
}

export function formatQty(amount: number, unit: Unit): string {
  const value = unit === 'pcs' ? Math.round(amount) : Number(amount.toFixed(amount < 1 ? 2 : 1));
  return `${value} ${unit}`;
}
