import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateDataset } from './validate';
import type { MockDataset } from './types';

// The shipped files must always be consistent (regenerate with npm run mock:generate).
const dir = path.join(process.cwd(), 'public', 'mock-data');
const read = (name: string) => JSON.parse(readFileSync(path.join(dir, `${name}.json`), 'utf8'));
const ds: MockDataset = {
  manifest: read('manifest'), customers: read('customers'), orders: read('orders'), products: read('products'), customCakes: read('custom-cakes'),
  payments: read('payments'), invoices: read('invoices'), issues: read('issues'), notifications: read('notifications'), automations: read('automations'),
  inventory: read('inventory'), analytics: read('analytics'), staff: read('staff'), campaigns: read('campaigns'),
};

describe('shipped mock data', () => {
  it('passes every integrity check', () => {
    expect(validateDataset(ds).problems).toEqual([]);
  });

  it('catches a broken reference, a wrong total and an orphan', () => {
    const broken: MockDataset = structuredClone(ds);
    broken.orders[0].customerId = 'CUS-99999';
    broken.orders[1].total += 1;
    broken.customers.push({ ...broken.customers[0], id: 'CUS-77777', orderIds: [] });
    const problems = validateDataset(broken).problems.join('\n');
    expect(problems).toMatch(/unknown customer CUS-99999/);
    expect(problems).toMatch(/total ≠ subtotal \+ delivery/);
    expect(problems).toMatch(/CUS-77777: customer with no orders/);
  });
});
