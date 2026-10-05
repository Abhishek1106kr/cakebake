/**
 * Checks public/mock-data/*.json for consistency: every reference resolves, totals add up,
 * invoices and payments agree with their orders, customers reconcile with their orders, stock
 * history replays to the current levels, analytics follow the orders, and there are no orphans.
 *
 *   npm run mock:validate     (exit code 1 if anything is wrong)
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { validateDataset } from '../lib/mock-data/validate';
import type { MockDataset } from '../lib/mock-data/types';

const dir = path.join(process.cwd(), 'public', 'mock-data');
const read = (name: string) => JSON.parse(readFileSync(path.join(dir, `${name}.json`), 'utf8'));
export function loadDataset(): MockDataset {
  return {
    manifest: read('manifest'), customers: read('customers'), orders: read('orders'), products: read('products'), customCakes: read('custom-cakes'),
    payments: read('payments'), invoices: read('invoices'), issues: read('issues'), notifications: read('notifications'), automations: read('automations'),
    inventory: read('inventory'), analytics: read('analytics'), staff: read('staff'), campaigns: read('campaigns'),
  };
}

const { problems, stats } = validateDataset(loadDataset());
console.log(Object.entries(stats).map(([k, v]) => `${k}: ${v}`).join(' · '));
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('Mock data is consistent.');
