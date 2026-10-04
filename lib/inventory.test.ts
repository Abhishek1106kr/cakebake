import { describe, expect, it } from 'vitest';
import { products } from './data';
import { makeLine } from './orders';
import {
  applyLines, applyMovement, availableUnits, formatQty, initialInventory, mergeInventory, needsFor,
  recipes, shortLines, stockLevel, stockState, availableQty, type Ingredient,
} from './inventory';

const p = (id: string) => products.find((x) => x.id === id)!;
const level = (inv: Ingredient[], id: string) => inv.find((i) => i.id === id)!.onHand;

describe('recipes', () => {
  it('only reference ingredients that exist', () => {
    const known = new Set(initialInventory.map((i) => i.id));
    for (const [productId, recipe] of Object.entries(recipes)) {
      expect(products.some((x) => x.id === productId), productId).toBe(true);
      for (const ingredient of Object.keys(recipe)) expect(known.has(ingredient), `${productId} → ${ingredient}`).toBe(true);
    }
  });
});

describe('needsFor', () => {
  it('scales by quantity and size', () => {
    const needs = needsFor([makeLine(p('tresor-latte'), 'Large', 2)]);
    expect(needs.milk).toBeCloseTo(0.2 * 1.5 * 2);
    expect(needs.beans).toBeCloseTo(0.018 * 1.5 * 2);
  });

  it('adds shared ingredients across lines', () => {
    const needs = needsFor([makeLine(p('almond-croissant'), 'Regular', 1), makeLine(p('pain-au-chocolat'), 'Regular', 1)]);
    expect(needs.flour).toBeCloseTo(0.12);
    expect(needs.butter).toBeCloseTo(0.06);
  });
});

describe('stock movement', () => {
  it('consumes on order and restores on early cancel', () => {
    const lines = [makeLine(p('chocolate-brownie'), 'Regular', 4)];
    const after = applyLines(initialInventory, lines, -1);
    expect(level(after, 'eggs')).toBe(level(initialInventory, 'eggs') - 4);
    const restored = applyLines(after, lines, 1);
    expect(level(restored, 'eggs')).toBe(level(initialInventory, 'eggs'));
  });

  it('never goes below zero', () => {
    expect(level(applyMovement(initialInventory, 'matcha', -10), 'matcha')).toBe(0);
  });
});

describe('availableUnits', () => {
  it('is limited by the scarcest ingredient', () => {
    // matcha: 0.12 kg on hand, 0.004 per regular → 30
    expect(availableUnits(initialInventory, [], 'matcha-cloud', 'Regular')).toBe(30);
    expect(availableUnits(initialInventory, [], 'matcha-cloud', 'Large')).toBe(20);
  });

  it('reserves what is already in the bag, across products sharing ingredients', () => {
    // Croissants are limited by almond flour (1.4 / 0.025 = 56) until a big pain au chocolat
    // order eats the butter they share: (2.8 - 60 × 0.03) / 0.03 = 33.
    expect(availableUnits(initialInventory, [], 'almond-croissant', 'Regular')).toBe(56);
    const bag = [{ ...makeLine(p('pain-au-chocolat'), 'Regular', 1), qty: 60 }];
    expect(availableUnits(initialInventory, bag, 'almond-croissant', 'Regular')).toBe(33);
  });

  it('returns the cap for products without a recipe (whole cakes are made to order)', () => {
    expect(availableUnits(initialInventory, [], 'rose-chocolate-truffle', 'Regular')).toBe(99);
  });

  it('returns zero when an ingredient is out', () => {
    const empty = applyMovement(initialInventory, 'matcha', -1);
    expect(availableUnits(empty, [], 'matcha-cloud', 'Regular')).toBe(0);
  });
});

describe('shortLines', () => {
  it('finds lines that can no longer be made', () => {
    const empty = applyMovement(initialInventory, 'matcha', -1);
    const lines = [makeLine(p('matcha-cloud'), 'Regular', 1), makeLine(p('almond-croissant'), 'Regular', 1)];
    expect(shortLines(empty, lines).map((l) => l.product.id)).toEqual(['matcha-cloud']);
  });
});

describe('stock state and storage', () => {
  it('classifies stock against the reorder point', () => {
    expect(stockState({ ...initialInventory[0], onHand: 0 })).toBe('Out');
    expect(stockState({ ...initialInventory[0], onHand: 1, reorderPoint: 4 })).toBe('Low');
    expect(stockState({ ...initialInventory[0], onHand: 10, reorderPoint: 4 })).toBe('Healthy');
  });

  it('keeps saved levels and adds new ingredients', () => {
    const merged = mergeInventory([{ id: 'beans', onHand: 9 }, { id: 'gone', onHand: 1 }]);
    expect(level(merged, 'beans')).toBe(9);
    expect(merged).toHaveLength(initialInventory.length);
    expect(mergeInventory('junk')).toBe(initialInventory);
  });

  it('formats quantities by unit', () => {
    expect(formatQty(0.123, 'kg')).toBe('0.12 kg');
    expect(formatQty(12.345, 'L')).toBe('12.3 L');
    expect(formatQty(4.6, 'pcs')).toBe('5 pcs');
  });
});

describe('reserved stock', () => {
  it('reserve and release move stock aside without changing what is on hand', () => {
    const reserved = applyMovement(initialInventory, 'butter', 1, 'Reserve');
    const butter = reserved.find((i) => i.id === 'butter')!;
    expect(butter.onHand).toBe(2.8);
    expect(butter.reserved).toBe(1);
    expect(availableQty(butter)).toBe(1.8);
    const released = applyMovement(reserved, 'butter', 0.4, 'Release').find((i) => i.id === 'butter')!;
    expect(released.reserved).toBe(0.6);
    // Can't reserve more than is on hand, or release below zero.
    expect(applyMovement(initialInventory, 'butter', 50, 'Reserve').find((i) => i.id === 'butter')!.reserved).toBe(2.8);
    expect(applyMovement(initialInventory, 'butter', 5, 'Release').find((i) => i.id === 'butter')!.reserved).toBe(0);
  });

  it('reserved stock is not available to the shop', () => {
    const all = availableUnits(initialInventory, [], 'basque-cheesecake', 'Regular');
    const held = applyMovement(initialInventory, 'cream-cheese', 2.4, 'Reserve');
    expect(all).toBeGreaterThan(0);
    expect(availableUnits(held, [], 'basque-cheesecake', 'Regular')).toBe(0);
  });

  it('grades four stock levels', () => {
    const item: Ingredient = { id: 'x', name: 'X', area: 'Baking', unit: 'kg', onHand: 10, reorderPoint: 4 };
    expect(stockLevel(item)).toBe('HEALTHY');
    expect(stockLevel({ ...item, onHand: 3 })).toBe('LOW');
    expect(stockLevel({ ...item, onHand: 2 })).toBe('CRITICAL');
    expect(stockLevel({ ...item, onHand: 0 })).toBe('OUT');
    expect(stockLevel({ ...item, onHand: 5, reserved: 5 })).toBe('OUT');
  });

  it('keeps admin reorder points and reservations across reloads', () => {
    const saved = initialInventory.map((i) => (i.id === 'milk' ? { ...i, onHand: 5, reorderPoint: 8, reserved: 2 } : i));
    const merged = mergeInventory(JSON.parse(JSON.stringify(saved))).find((i) => i.id === 'milk')!;
    expect(merged).toMatchObject({ onHand: 5, reorderPoint: 8, reserved: 2 });
  });
});
