import { describe, expect, it, afterEach } from 'vitest';
import { baseProducts } from '@/lib/data';
import { createOrder, makeCustomLine, makeLine, normalizeOrder, type CheckoutDetails, type Order } from '@/lib/orders';
import { initialInventory } from '@/lib/inventory';
import { DEFAULT_CAKE_CATALOG, setCakeCatalog } from '@/lib/cake/config';
import { defaultConfig, find, options, price, validate, violations } from '@/lib/cake/engine';
import { DEFAULT_RULES, businessRules, setBusinessRules } from '@/lib/config/business';
import { authorize, can, seedStaff, validateStaffChange, ROLE_PERMISSIONS, PERMISSIONS } from './permissions';
import { appendAudit, diff, filterAudit, makeAudit, SYSTEM_ACTOR } from './audit';
import { bulkPlan, cancelImpact, deliverBy, dueState, filterCounts, matchesQuery, paginate, priorityOf, queryOrders, requiredBy } from './order-ops';
import { buildCustomers, lifecycleOf } from './customers';
import { buildCatalog, duplicateProduct, newProduct, storefrontProducts, validateProduct } from './catalog';
import { buildCakeCatalog, duplicateOption, EMPTY_OVERRIDES, normalizeOverrides, validateOption, validatePrintRules, withOptionChange, type AnyOption } from './cake-builder';
import { DEFAULT_SETTINGS, normalizeSettings, rulesFromSettings, validateSettings } from './settings';
import { deriveAttention, withStates } from './attention';
import { adminSearch } from './search';
import { invoiceRows, regenerateInvoice } from './invoices';
import { canMove, effectiveStatus, liveAnnouncement, newCampaign, validateCampaign } from './marketing';
import { toCsv } from './csv';
import { buildInvoice } from '@/lib/automation/automation';

const at = new Date('2026-10-04T10:00:00+05:30');
const details: CheckoutDetails = { customer: { name: 'Asha Rao', phone: '9845012345', email: 'asha@example.com' }, address: '12 Test Road, Indiranagar', city: 'Bengaluru', pin: '560038', slot: '18:00–20:00', paymentMethod: 'UPI' };
const p = (id: string) => baseProducts.find((x) => x.id === id)!;
const order = (over: Partial<Order> = {}, lines = [makeLine(p('tresor-latte'), 'Regular', 2)], when = at): Order => ({ ...createOrder(details, lines, [], when), ...over });

afterEach(() => { setCakeCatalog(DEFAULT_CAKE_CATALOG as never); setBusinessRules(DEFAULT_RULES); });

describe('permissions', () => {
  const [owner, , manager, kitchen, baker, delivery, support] = seedStaff(at);
  it('lists every permission explicitly for the owner and never gives staff management to others', () => {
    expect(ROLE_PERMISSIONS.OWNER).toEqual([...PERMISSIONS]);
    for (const role of Object.keys(ROLE_PERMISSIONS)) if (role !== 'OWNER') expect(ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS]).not.toContain('staff.manage');
  });
  it('matches the brief’s examples', () => {
    for (const perm of ['orders.view', 'kitchen.view', 'customCakes.view'] as const) expect(can(kitchen, perm)).toBe(true);
    for (const perm of ['orders.view', 'inventory.adjust', 'products.edit', 'analytics.view'] as const) expect(can(manager, perm)).toBe(true);
    expect(can(kitchen, 'settings.edit')).toBe(false);
    expect(can(baker, 'customers.view')).toBe(false);
    expect(can(delivery, 'finance.refund')).toBe(false);
    expect(can(support, 'customers.pii')).toBe(true);
    expect(can(owner, 'finance.refund')).toBe(true);
  });
  it('authorize explains refusals, and inactive staff can do nothing', () => {
    expect(authorize(kitchen, 'products.price')).toMatchObject({ ok: false });
    expect(authorize({ ...owner, active: false }, 'orders.view')).toMatchObject({ ok: false });
    expect(authorize(null, 'orders.view')).toMatchObject({ ok: false });
  });
  it('refuses to remove the last active owner', () => {
    const staff = seedStaff(at);
    expect(validateStaffChange(staff, { ...staff[0], role: 'MANAGER' })).toMatchObject({ ok: false });
    const two = [...staff, { ...staff[0], id: 'owner-2', name: 'Second owner' }];
    expect(validateStaffChange(two, { ...staff[0], role: 'MANAGER' })).toEqual({ ok: true });
  });
});

describe('audit', () => {
  it('appends without changing earlier records and keeps the newest when trimming', () => {
    const a = makeAudit({ actor: SYSTEM_ACTOR, action: 'x.one', entity: { type: 'order', id: 'TRS-1' }, before: { n: 1 }, after: { n: 2 }, reason: null, source: 'system' });
    const b = makeAudit({ actor: SYSTEM_ACTOR, action: 'x.two', entity: { type: 'order', id: 'TRS-2' }, before: null, after: null, reason: 'why', source: 'system' });
    const log = appendAudit([a], b);
    expect(log).toEqual([a, b]);
    expect(appendAudit(log, a, 2)).toEqual([b, a]);
    expect(filterAudit(log, { query: 'why' })).toEqual([b]);
  });
  it('snapshots before/after so later mutation of the source cannot rewrite history', () => {
    const before = { price: 290 };
    const r = makeAudit({ actor: SYSTEM_ACTOR, action: 'product.price.changed', entity: { type: 'product', id: 'x' }, before, after: { price: 310 }, reason: null, source: 'admin-ui' });
    before.price = 1;
    expect(r.before).toEqual({ price: 290 });
    expect(diff(r.before, r.after)).toEqual([{ field: 'price', before: 290, after: 310 }]);
  });
});

describe('order operations', () => {
  it('reads required-by from the slot text', () => {
    const evening = order();
    expect(requiredBy(evening).getHours()).toBe(18);
    expect(deliverBy(evening).getHours()).toBe(20);
    const dated = order({ slot: 'Tue, 6 Oct · 14:00–16:00' });
    expect(requiredBy(dated).getDate()).toBe(6);
    expect(requiredBy(dated).getHours()).toBe(14);
    // A same-day window that already ended when the order was placed means tomorrow.
    const late = order({ slot: '10:00–12:00' }, undefined, new Date('2026-10-04T21:00:00+05:30'));
    expect(requiredBy(late).getDate()).toBe(5);
  });
  it('flags late and at-risk orders, never finished ones', () => {
    const o = order();
    expect(dueState(o, new Date('2026-10-04T12:00:00+05:30'))).toBe('on-track');
    expect(dueState(o, new Date('2026-10-04T17:50:00+05:30'))).toBe('at-risk');
    expect(dueState(o, new Date('2026-10-04T18:30:00+05:30'))).toBe('late');
    expect(priorityOf(o, new Date('2026-10-04T18:30:00+05:30'))).toBe('URGENT');
    expect(dueState({ ...o, status: 'DELIVERED' }, new Date('2026-10-05T00:00:00+05:30'))).toBe('done');
  });
  it('filters, searches (id, name, phone, email, product, custom cake) and sorts', () => {
    const a = order({ id: 'TRS-2001', createdAt: '2026-10-04T04:00:00.000Z' });
    const b = order({ id: 'TRS-2002', status: 'PREPARING', total: 9999, createdAt: '2026-10-04T05:00:00.000Z' });
    const c = { ...order({ id: 'TRS-2003', createdAt: '2026-10-04T06:00:00.000Z' }, [makeCustomLine(defaultConfig())]) };
    const all = [a, b, c];
    expect(matchesQuery(a, '2001')).toBe(true);
    expect(matchesQuery(a, 'asha')).toBe(true);
    expect(matchesQuery(a, '98450 12345')).toBe(true);
    expect(matchesQuery(a, 'example.com')).toBe(true);
    expect(matchesQuery(a, 'latte')).toBe(true);
    expect(matchesQuery(c, 'custom cake')).toBe(true);
    expect(matchesQuery(a, 'custom cake')).toBe(false);
    expect(queryOrders(all, { filter: 'PREPARING', query: '', sort: 'newest', now: at }).map((o) => o.id)).toEqual(['TRS-2002']);
    expect(queryOrders(all, { filter: 'ALL', query: '', sort: 'value', now: at })[0].id).toBe('TRS-2002');
    expect(queryOrders(all, { filter: 'ALL', query: '', sort: 'oldest', now: at })[0].id).toBe('TRS-2001');
    expect(filterCounts(all, at)).toMatchObject({ ALL: 3, ACTIVE: 3, PREPARING: 1, CONFIRMED: 2 });
  });
  it('plans bulk steps only for orders in the right state', () => {
    const a = order({ id: 'TRS-1', status: 'NEW', history: [{ status: 'NEW', at: at.toISOString() }] });
    const b = order({ id: 'TRS-2', status: 'PREPARING' });
    expect(bulkPlan([a, b], ['TRS-1', 'TRS-2', 'TRS-9'], 'confirm')).toEqual({ apply: ['TRS-1'], skipped: [{ id: 'TRS-2', reason: 'is preparing' }, { id: 'TRS-9', reason: 'no longer exists' }] });
    expect(bulkPlan([a, b], ['TRS-1', 'TRS-2'], 'ready').apply).toEqual(['TRS-2']);
  });
  it('explains the stock and payment impact of a cancel', () => {
    const confirmed = order();
    const impact = cancelImpact(confirmed, initialInventory);
    expect(impact).toMatchObject({ allowed: true, restoresStock: true });
    expect(impact.ingredients.map((i) => i.id)).toContain('beans');
    expect(impact.payment).toMatch(/refund pending/);
    expect(cancelImpact({ ...confirmed, status: 'PREPARING' }, initialInventory).restoresStock).toBe(false);
    expect(cancelImpact({ ...confirmed, status: 'OUT_FOR_DELIVERY' }, initialInventory).allowed).toBe(false);
  });
  it('pages large lists without losing items', () => {
    const list = Array.from({ length: 103 }, (_, i) => i);
    expect(paginate(list, 5, 25)).toMatchObject({ page: 5, pages: 5, total: 103 });
    expect(paginate(list, 5, 25).items).toEqual([100, 101, 102]);
    expect(paginate(list, 99, 25).page).toBe(5);
  });
});

describe('customers', () => {
  it('groups orders by normalised phone and excludes cancelled spend', () => {
    const a = order({ id: 'TRS-1', createdAt: '2026-09-01T05:00:00.000Z' });
    const b = order({ id: 'TRS-2', customer: { ...details.customer, phone: '+91 98450 12345' } });
    const c = order({ id: 'TRS-3', status: 'CANCELLED' });
    const [cust] = buildCustomers([a, b, c], at);
    expect(cust.orders.map((o) => o.id).sort()).toEqual(['TRS-1', 'TRS-2', 'TRS-3']);
    expect(cust.orderCount).toBe(2);
    expect(cust.totalSpend).toBe(a.total + b.total);
    expect(cust.favorites[0]).toMatchObject({ productId: 'tresor-latte', qty: 4 });
  });
  it('applies the lifecycle rules in order', () => {
    const d = (days: number) => new Date(at.getTime() - days * 86400000).toISOString();
    expect(lifecycleOf({ orderCount: 1, totalSpend: 500, firstOrderAt: d(2), lastOrderAt: d(2) }, at)).toBe('NEW');
    expect(lifecycleOf({ orderCount: 1, totalSpend: 500, firstOrderAt: d(35), lastOrderAt: d(35) }, at)).toBe('ACTIVE');
    expect(lifecycleOf({ orderCount: 3, totalSpend: 1500, firstOrderAt: d(60), lastOrderAt: d(10) }, at)).toBe('RETURNING');
    expect(lifecycleOf({ orderCount: 3, totalSpend: 1500, firstOrderAt: d(120), lastOrderAt: d(60) }, at)).toBe('AT_RISK');
    expect(lifecycleOf({ orderCount: 2, totalSpend: 12000, firstOrderAt: d(40), lastOrderAt: d(5) }, at)).toBe('HIGH_VALUE');
    expect(lifecycleOf({ orderCount: 8, totalSpend: 12000, firstOrderAt: d(400), lastOrderAt: d(100) }, at)).toBe('INACTIVE');
  });
});

describe('product catalogue', () => {
  it('starts from the code menu and applies stored changes', () => {
    const base = buildCatalog({});
    expect(base).toHaveLength(baseProducts.length);
    const tart = base.find((r) => r.id === 'pistachio-tart')!;
    const changed = buildCatalog({ [tart.id]: { ...tart, price: 310, available: false } });
    expect(changed.find((r) => r.id === tart.id)).toMatchObject({ price: 310, available: false });
    const shop = storefrontProducts(changed);
    expect(shop.find((x) => x.id === tart.id)).toMatchObject({ price: 310, available: false });
  });
  it('removes disabled and archived products from the shop, keeps them in the catalogue', () => {
    const base = buildCatalog({});
    const latte = base.find((r) => r.id === 'tresor-latte')!;
    const cat = buildCatalog({ [latte.id]: { ...latte, status: 'ARCHIVED' } });
    expect(cat.some((r) => r.id === 'tresor-latte')).toBe(true);
    expect(storefrontProducts(cat).some((x) => x.id === 'tresor-latte')).toBe(false);
  });
  it('a price change never touches an existing order', () => {
    const sold = order();
    const stored = JSON.parse(JSON.stringify(sold));
    const base = buildCatalog({});
    const latte = base.find((r) => r.id === 'tresor-latte')!;
    storefrontProducts(buildCatalog({ [latte.id]: { ...latte, price: 999 } }));
    expect(normalizeOrder(stored)!.items[0].unitPrice).toBe(210);
  });
  it('validates, creates and duplicates', () => {
    const all = buildCatalog({});
    const fresh = newProduct(all, at);
    expect(validateProduct(fresh, all)).toMatchObject({ ok: false });
    const ok = { ...fresh, name: 'Cardamom Bun', slug: 'cardamom-bun', price: 180, description: 'Soft bun with cardamom sugar.', seoTitle: 'x' };
    expect(validateProduct(ok, all)).toEqual({ ok: true });
    expect(validateProduct({ ...ok, slug: 'tresor-latte' }, all)).toMatchObject({ ok: false });
    expect(validateProduct({ ...ok, compareAtPrice: 150 }, all)).toMatchObject({ ok: false });
    const copy = duplicateProduct(all[0], all, at);
    expect(copy).toMatchObject({ status: 'INACTIVE', createdInAdmin: true });
    expect(copy.slug).not.toBe(all[0].slug);
  });
});

describe('cake builder', () => {
  it('changes the live price for new designs, never for an order already placed', () => {
    const cfg = { ...defaultConfig(), sponge: 'pistachio' };
    const placed = makeCustomLine(cfg);
    const sponge = DEFAULT_CAKE_CATALOG.sponges.find((s) => s.id === 'pistachio')! as unknown as AnyOption;
    const over = withOptionChange(EMPTY_OVERRIDES, 'sponge', { ...sponge, price: 500 });
    setCakeCatalog(buildCakeCatalog(over));
    expect(price(cfg).total).toBe(placed.unitPrice + 200);
    expect(price(cfg).version).toMatch(/\+r1$/);
    const restored = normalizeOrder(JSON.parse(JSON.stringify(createOrder(details, [placed], [], at))))!;
    expect(restored.items[0].unitPrice).toBe(placed.unitPrice);
  });
  it('archived options are hidden from customers but still resolve for old designs, and are refused on new ones', () => {
    const ruffled = DEFAULT_CAKE_CATALOG.finishes.find((f) => f.id === 'ruffled')! as unknown as AnyOption;
    setCakeCatalog(buildCakeCatalog(withOptionChange(EMPTY_OVERRIDES, 'finish', { ...ruffled, status: 'ARCHIVED' })));
    expect(options('finish').some((o) => o.id === 'ruffled')).toBe(false);
    expect(find('finish', 'ruffled')?.name).toBe('Ruffled');
    expect(validate({ ...defaultConfig(), finish: 'ruffled' }).some((i) => i.level === 'error' && i.field === 'finish')).toBe(true);
  });
  it('adds duplicated options and can disable rules', () => {
    const vanilla = DEFAULT_CAKE_CATALOG.sponges[0] as unknown as AnyOption;
    const copy = { ...duplicateOption(vanilla, DEFAULT_CAKE_CATALOG.sponges as unknown as AnyOption[]), status: 'ACTIVE' as const, name: 'Lemon', price: 120 };
    let over = withOptionChange(EMPTY_OVERRIDES, 'sponge', copy);
    over = { ...over, rules: { 'whipped-no-ruffles': { enabled: false } } };
    setCakeCatalog(buildCakeCatalog(over));
    expect(options('sponge').some((o) => o.id === copy.id)).toBe(true);
    expect(violations({ ...defaultConfig(), frosting: 'whipped', finish: 'ruffled' })).toHaveLength(0);
  });
  it('drives the print minimum size rule from the print setting', () => {
    setCakeCatalog(buildCakeCatalog({ ...EMPTY_OVERRIDES, printRules: { minSizeInches: 8 } }));
    const withPrint = (size: string) => ({ ...defaultConfig(), size, print: { ...defaultConfig().print, enabled: true, assetId: 'x' } });
    expect(violations(withPrint('6in')).some((r) => r.id === 'print-min-size')).toBe(true);
    expect(violations(withPrint('8in')).some((r) => r.id === 'print-min-size')).toBe(false);
  });
  it('validates options and print rules', () => {
    const all = DEFAULT_CAKE_CATALOG.toppings as unknown as AnyOption[];
    expect(validateOption('toppings', { ...all[0], maxQuantity: 0 }, all)).toHaveProperty('maxQuantity');
    expect(validateOption('toppings', { ...all[0], id: all[1].id }, all)).toHaveProperty('id');
    expect(validatePrintRules({ ...DEFAULT_CAKE_CATALOG.printRules, minDotsPerCm: 5 })).toHaveProperty('minDotsPerCm');
    expect(normalizeOverrides('junk')).toEqual(EMPTY_OVERRIDES);
  });
});

describe('settings', () => {
  it('keeps defaults equal to the current behaviour', () => {
    expect(rulesFromSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_RULES);
  });
  it('changes delivery pricing for new bags only, and validates input', () => {
    const v = normalizeSettings({ 'delivery.fee': 90, 'delivery.freeFrom': 1500, bogus: 1 });
    expect(v).not.toHaveProperty('bogus');
    setBusinessRules(rulesFromSettings(v));
    expect(businessRules()).toMatchObject({ deliveryFee: 90, freeDeliveryFrom: 1500 });
    const o = order();
    expect(o.delivery).toBe(90);
    expect(validateSettings({ ...v, 'delivery.fee': -5 })).toHaveProperty(['delivery.fee']);
    expect(validateSettings({ ...v, 'business.name': 'sk_live_abcdefghijklmnop' })).toHaveProperty(['business.name']);
  });
});

describe('attention', () => {
  it('derives items with links, and resolved ones disappear', () => {
    const failedJob = { id: 'whatsapp:TRS-9:confirmation', kind: 'whatsapp' as const, orderId: 'TRS-9', topic: 'confirmation', status: 'failed' as const, attempts: 3, lastError: 'timeout', createdAt: at.toISOString(), updatedAt: at.toISOString(), claimedAt: null, result: null };
    const items = deriveAttention({ orders: [order({ id: 'TRS-9' })], inventory: initialInventory, jobs: [failedJob], events: [], now: at, thresholds: { lowStock: true, customCakeDueHours: 24, deliveryDelayMinutes: 45 }, newSince: new Date(at.getTime() - 3600000).toISOString() });
    const wa = items.find((i) => i.kind === 'WHATSAPP_FAILED')!;
    expect(wa.href).toContain('/admin/automations');
    expect(wa.detail).toMatch(/order is safe/);
    expect(items.some((i) => i.kind === 'LOW_STOCK' && i.href.includes('/admin/inventory'))).toBe(true);
    expect(withStates(items, { [wa.id]: 'RESOLVED' }).some((i) => i.id === wa.id)).toBe(false);
  });
});

describe('search', () => {
  it('finds an order number across order, customer, invoice and custom cake, respecting PII permission', () => {
    const o = order({ id: 'TRS-1048' }, [makeCustomLine(defaultConfig())]);
    const data = { orders: [o], customers: buildCustomers([o], at), catalog: buildCatalog({}), inventory: initialInventory, invoices: { [o.id]: buildInvoice(o, at) }, campaigns: [], audit: [], attention: [] };
    const owner = seedStaff(at)[0];
    const types = adminSearch('TRS-1048', data, owner).map((r) => r.type);
    expect(types).toEqual(expect.arrayContaining(['order', 'customer', 'invoice', 'customCake']));
    const baker = seedStaff(at).find((s) => s.role === 'BAKER')!;
    expect(adminSearch('TRS-1048', data, baker).map((r) => r.type)).toEqual(['customCake']);
    expect(adminSearch('98450 12345', data, owner).some((r) => r.type === 'customer')).toBe(true);
    const kitchen = seedStaff(at).find((s) => s.role === 'KITCHEN')!;
    expect(adminSearch('98450 12345', data, kitchen)).toEqual([]);
  });
});

describe('invoices', () => {
  it('lists status per order and regenerates with the same number and a new revision', () => {
    const o = order({ id: 'TRS-1050' });
    const inv = buildInvoice(o, at);
    expect(inv.customerSnapshot?.name).toBe('Asha Rao');
    const rows = invoiceRows([o, order({ id: 'TRS-1051' })], { [o.id]: inv }, []);
    expect(rows.find((r) => r.order.id === 'TRS-1050')!.status).toBe('ISSUED');
    expect(rows.find((r) => r.order.id === 'TRS-1051')!.status).toBe('NOT_REQUESTED');
    const next = regenerateInvoice(o, inv, 'Owner', 'Customer asked for GSTIN', at);
    expect(next.invoiceNumber).toBe(inv.invoiceNumber);
    expect(next.revision).toBe(2);
    expect(next.revisions?.map((r) => r.revision)).toEqual([1, 2]);
    expect(next.total).toBe(o.total);
  });
});

describe('campaigns and content', () => {
  it('moves by explicit transitions and dates', () => {
    const c = { ...newCampaign(at), name: 'Diwali cakes' };
    expect(validateCampaign(c)).toEqual({});
    expect(validateCampaign({ ...c, cta: { label: 'Go', href: 'https://example.com' } })).toHaveProperty('cta');
    expect(canMove(c, 'SCHEDULED', at)).toBe(true);
    expect(canMove(c, 'LIVE', at)).toBe(false);
    const scheduled = { ...c, status: 'SCHEDULED' as const };
    expect(effectiveStatus(scheduled, new Date(Date.parse(c.start) + 1000))).toBe('LIVE');
    expect(effectiveStatus(scheduled, new Date(Date.parse(c.end) + 1000))).toBe('ENDED');
  });
  it('shows only an active announcement inside its dates', () => {
    const a = { id: 'a1', text: 'Closed on Diwali', href: '', start: at.toISOString(), end: new Date(at.getTime() + 86400000).toISOString(), active: true, updatedAt: at.toISOString() };
    expect(liveAnnouncement([a], new Date(at.getTime() + 1000))?.id).toBe('a1');
    expect(liveAnnouncement([{ ...a, active: false }], new Date(at.getTime() + 1000))).toBeNull();
    expect(liveAnnouncement([a], new Date(at.getTime() + 2 * 86400000))).toBeNull();
  });
});

describe('csv', () => {
  it('quotes, doubles quotes and neutralises formulas', () => {
    expect(toCsv([['a"b', '=SUM(A1)', -5, null]])).toBe('"a""b","\'=SUM(A1)","-5",""');
  });
});
