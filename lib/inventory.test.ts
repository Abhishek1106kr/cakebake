import { describe, expect, it } from 'vitest';
import { products } from './data';
import { makeLine } from './orders';
import {
  applyLines, applyMovement, availableUnits, formatQty, initialInventory, mergeInventory, needsFor,
  recipes, shortLines, stockState, type Ingredient,
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
