// Business settings. One schema drives the Settings page, validation and storage.
// Each field says whether the app reads it today ("live") or whether it is kept
// for the backend phase ("stored"), so nobody mistakes a saved value for a working
// rule. No credential, token or secret is ever a setting here: provider keys live
// on the server.

import { DEFAULT_RULES, type BusinessRules } from '@/lib/config/business';

export type FieldType = 'text' | 'number' | 'boolean' | 'time' | 'select' | 'list' | 'textarea';
export type SettingField = {
  key: string;
  label: string;
  type: FieldType;
  live: boolean;
  help?: string;
  min?: number;
  max?: number;
  options?: string[];
  unit?: string;
};
export type SettingSection = { id: string; title: string; summary: string; fields: SettingField[]; note?: string };

export const SETTINGS_SCHEMA: SettingSection[] = [
  { id: 'business', title: 'Business', summary: 'Who you are on invoices and messages.', fields: [
    { key: 'business.name', label: 'Trading name', type: 'text', live: false },
    { key: 'business.legalName', label: 'Legal name', type: 'text', live: false, help: 'As registered. Leave empty until confirmed.' },
    { key: 'business.address', label: 'Address', type: 'textarea', live: false },
    { key: 'business.phone', label: 'Contact phone', type: 'text', live: false },
    { key: 'business.email', label: 'Contact email', type: 'text', live: false },
  ] },
  { id: 'ordering', title: 'Ordering', summary: 'How orders arrive and how many you take.', fields: [
    { key: 'ordering.autoConfirm', label: 'Auto-confirm new orders', type: 'boolean', live: true, help: 'Off: new orders wait in NEW until someone confirms them.' },
    { key: 'ordering.lastOrderTime', label: 'Last order time', type: 'time', live: false },
    { key: 'ordering.maxOrdersPerSlot', label: 'Orders per delivery slot', type: 'number', live: false, min: 1, max: 500 },
    { key: 'ordering.maxCustomCakesPerOrder', label: 'Custom cakes per order', type: 'number', live: false, min: 1, max: 10, help: 'The checkout limit is 3 in code today.' },
  ] },
  { id: 'delivery', title: 'Delivery', summary: 'Fees, free-delivery threshold and areas.', fields: [
    { key: 'delivery.fee', label: 'Delivery fee', type: 'number', live: true, min: 0, max: 1000, unit: '₹' },
    { key: 'delivery.freeFrom', label: 'Free delivery from', type: 'number', live: true, min: 0, max: 100000, unit: '₹' },
    { key: 'delivery.pinPrefix', label: 'Delivery PIN prefix', type: 'text', live: false, help: 'Checkout accepts PIN codes starting 560 (Bengaluru) in code today.' },
    { key: 'delivery.areas', label: 'Delivery areas', type: 'list', live: false },
    { key: 'delivery.delayAlertMinutes', label: 'Flag deliveries out longer than', type: 'number', live: true, min: 10, max: 240, unit: 'min' },
  ] },
  { id: 'pickup', title: 'Pickup', summary: 'Collect-from-the-counter windows.', note: 'Checkout offers delivery only today; these are kept for when pickup launches.', fields: [
    { key: 'pickup.enabled', label: 'Offer pickup', type: 'boolean', live: false },
    { key: 'pickup.windows', label: 'Pickup windows', type: 'list', live: false },
  ] },
  { id: 'payments', title: 'Payments', summary: 'Which methods customers see.', note: 'Payments are simulated in this prototype. Gateway keys are configured on the server, never here.', fields: [
    { key: 'payments.upi', label: 'UPI', type: 'boolean', live: false },
    { key: 'payments.card', label: 'Card', type: 'boolean', live: false },
    { key: 'payments.cod', label: 'Cash on delivery', type: 'boolean', live: false },
  ] },
  { id: 'taxes', title: 'Taxes', summary: 'GST on invoices.', note: 'Confirm rates and registration with your accountant before invoices are issued for real.', fields: [
    { key: 'taxes.gstin', label: 'GSTIN', type: 'text', live: true, help: 'Printed on invoices issued from now on.' },
    { key: 'taxes.rate', label: 'GST rate', type: 'number', live: true, min: 0, max: 28, unit: '%', help: 'Shown as the tax inside each new invoice’s total. Issued invoices keep their snapshot.' },
    { key: 'taxes.inclusive', label: 'Menu prices include tax', type: 'boolean', live: true, help: 'Checkout charges prices as shown, so tax is always inside the total.' },
  ] },
  { id: 'invoices', title: 'Invoices', summary: 'Numbering and the footer note.', fields: [
    { key: 'invoices.prefix', label: 'Invoice prefix', type: 'text', live: false, help: 'Numbers are INV-<order number> today. Existing invoice numbers never change.' },
    { key: 'invoices.footer', label: 'Footer note', type: 'textarea', live: false },
  ] },
  { id: 'whatsapp', title: 'WhatsApp', summary: 'Order confirmations and status messages.', note: 'Simulated provider. The WhatsApp Business token is a server secret and is never entered in the browser.', fields: [
    { key: 'whatsapp.enabled', label: 'Send WhatsApp updates', type: 'boolean', live: false },
    { key: 'whatsapp.senderName', label: 'Sender name', type: 'text', live: false },
  ] },
  { id: 'email', title: 'Email', summary: 'Receipts by email.', note: 'No email provider is connected.', fields: [
    { key: 'email.enabled', label: 'Send email receipts', type: 'boolean', live: false },
    { key: 'email.from', label: 'From address', type: 'text', live: false },
  ] },
  { id: 'notifications', title: 'Notifications', summary: 'What the admin flags for attention.', fields: [
    { key: 'notifications.lowStock', label: 'Flag low stock', type: 'boolean', live: true },
    { key: 'notifications.customCakeDueHours', label: 'Flag custom cakes not started within', type: 'number', live: true, min: 1, max: 72, unit: 'h of their slot' },
    { key: 'notifications.newOrders', label: 'Announce new orders', type: 'boolean', live: true },
  ] },
  { id: 'cakeBuilder', title: 'Cake Builder', summary: 'Options, prices and rules.', note: 'Options, prices, print rules and production times are managed on the Cake Builder page.', fields: [] },
  { id: 'inventory', title: 'Inventory', summary: 'Stock thresholds.', fields: [
    { key: 'inventory.coverDays', label: 'Restock to cover', type: 'number', live: false, min: 1, max: 14, unit: 'days' },
  ] },
  { id: 'hours', title: 'Store hours', summary: 'When the bakery is open.', fields: [
    { key: 'hours.open', label: 'Opens', type: 'time', live: false },
    { key: 'hours.close', label: 'Closes', type: 'time', live: false },
    { key: 'hours.days', label: 'Open on', type: 'list', live: false },
  ] },
  { id: 'holidays', title: 'Holidays', summary: 'Days the bakery is closed.', fields: [
    { key: 'holidays.dates', label: 'Closed on (YYYY-MM-DD)', type: 'list', live: false },
  ] },
  { id: 'staff', title: 'Staff', summary: 'Accounts and roles.', note: 'Manage accounts and see the permission matrix on the Staff page.', fields: [] },
  { id: 'security', title: 'Security', summary: 'How the admin protects changes.', note: 'In this prototype permissions are enforced in the browser only. A real deployment checks every request on the server with the same permission names, and keeps secrets out of the frontend.', fields: [
    { key: 'security.sessionMinutes', label: 'Sign out after', type: 'number', live: false, min: 5, max: 720, unit: 'min idle' },
  ] },
  { id: 'brand', title: 'Brand', summary: 'Palette and type (read-only here).', note: 'Sage #7E9291 · deep #657876 · mist #A9B7B6 · ink #202625. Cormorant Garamond for headings, Inter for interface.', fields: [] },
];

export type SettingsValues = Record<string, string | number | boolean | string[]>;

export const DEFAULT_SETTINGS: SettingsValues = {
  'business.name': 'Tresor Bakery', 'business.legalName': '', 'business.address': 'Indiranagar, Bengaluru', 'business.phone': '', 'business.email': 'hello@tresor.cafe',
  'ordering.autoConfirm': DEFAULT_RULES.autoConfirm, 'ordering.lastOrderTime': '21:30', 'ordering.maxOrdersPerSlot': 40, 'ordering.maxCustomCakesPerOrder': 3,
  'delivery.fee': DEFAULT_RULES.deliveryFee, 'delivery.freeFrom': DEFAULT_RULES.freeDeliveryFrom, 'delivery.pinPrefix': '560', 'delivery.areas': ['Bengaluru'], 'delivery.delayAlertMinutes': 45,
  'pickup.enabled': false, 'pickup.windows': [],
  'payments.upi': true, 'payments.card': true, 'payments.cod': true,
  'taxes.gstin': '', 'taxes.rate': 0, 'taxes.inclusive': true,
  'invoices.prefix': 'INV-', 'invoices.footer': 'Simulated invoice for the Tresor prototype. No tax registration or payment is real.',
  'whatsapp.enabled': true, 'whatsapp.senderName': 'Tresor',
  'email.enabled': false, 'email.from': '',
  'notifications.lowStock': true, 'notifications.customCakeDueHours': 24, 'notifications.newOrders': true,
  'inventory.coverDays': 3,
  'hours.open': '08:00', 'hours.close': '22:00', 'hours.days': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  'holidays.dates': [],
  'security.sessionMinutes': 60,
};

const FIELDS = new Map(SETTINGS_SCHEMA.flatMap((s) => s.fields.map((f) => [f.key, f] as const)));
export const settingField = (key: string) => FIELDS.get(key);

/** Stored values over the defaults; unknown keys and wrong types are dropped. */
export function normalizeSettings(raw: unknown): SettingsValues {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: SettingsValues = { ...DEFAULT_SETTINGS };
  for (const [k, v] of Object.entries(r)) {
    const f = FIELDS.get(k);
    if (!f) continue;
    if (f.type === 'boolean' && typeof v === 'boolean') out[k] = v;
    else if (f.type === 'number' && typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (f.type === 'list' && Array.isArray(v)) out[k] = v.map(String);
    else if (['text', 'time', 'textarea', 'select'].includes(f.type) && typeof v === 'string') out[k] = v;
  }
  return out;
}

export function validateSettings(v: SettingsValues): Record<string, string> {
  const e: Record<string, string> = {};
  for (const f of FIELDS.values()) {
    const val = v[f.key];
    if (f.type === 'number') {
      if (typeof val !== 'number' || !Number.isFinite(val)) e[f.key] = 'Enter a number.';
      else if ((f.min !== undefined && val < f.min) || (f.max !== undefined && val > f.max)) e[f.key] = `Between ${f.min} and ${f.max}.`;
    }
    if (f.type === 'time' && typeof val === 'string' && val && !/^([01]\d|2[0-3]):[0-5]\d$/.test(val)) e[f.key] = 'Use HH:MM.';
  }
  const email = String(v['business.email'] ?? '');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) e['business.email'] = 'This email looks incomplete.';
  for (const d of (v['holidays.dates'] as string[]) ?? []) if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) e['holidays.dates'] = `“${d}” isn’t YYYY-MM-DD.`;
  // Anything shaped like an API key or access token is refused outright.
  const secretLike = /\b(sk|pk|rk)_(live|test)_\w+|\bEAA[A-Za-z0-9]{20,}|\b[A-Za-z0-9_-]{40,}\b/;
  for (const [k, val] of Object.entries(v)) if (typeof val === 'string' && secretLike.test(val)) e[k] = 'This looks like a key or token. Secrets belong on the server, never in settings.';
  return e;
}

/** The settings the shop reads at runtime. */
export function rulesFromSettings(v: SettingsValues): BusinessRules {
  return {
    deliveryFee: Number(v['delivery.fee']), freeDeliveryFrom: Number(v['delivery.freeFrom']), autoConfirm: Boolean(v['ordering.autoConfirm']),
    taxRate: Number(v['taxes.rate']) || 0, taxInclusive: Boolean(v['taxes.inclusive']), gstin: String(v['taxes.gstin'] ?? ''),
  };
}

/** Thresholds the admin's attention system reads. */
export function attentionThresholds(v: SettingsValues) {
  return {
    lowStock: Boolean(v['notifications.lowStock']),
    customCakeDueHours: Number(v['notifications.customCakeDueHours']) || 24,
    deliveryDelayMinutes: Number(v['delivery.delayAlertMinutes']) || 45,
    announceNewOrders: Boolean(v['notifications.newOrders']),
  };
}
