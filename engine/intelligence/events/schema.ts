// Versioned event schemas. Events carry identifiers and facts, never personal
// data: payloads containing names, phone numbers, addresses, emails or payment
// details are rejected.

export const EVENT_SCHEMA_VERSION = 1;

export const CUSTOMER_EVENTS = [
  'page_view', 'product_view', 'search_started', 'search_completed', 'category_view', 'product_added', 'product_removed',
  'cart_updated', 'checkout_started', 'payment_started', 'payment_success', 'payment_failure', 'order_created',
  'order_cancelled', 'tracking_viewed', 'recommendation_shown', 'recommendation_clicked', 'campaign_view', 'campaign_clicked',
  // Cake Playground
  'customizer_opened', 'option_selected', 'cake_started', 'cake_completed', 'message_added', 'image_uploaded', 'design_saved',
  'design_shared', 'design_reopened', 'custom_cake_added_to_cart', 'custom_cake_abandoned', 'custom_cake_ordered',
] as const;

export const OPERATIONAL_EVENTS = [
  'inventory_updated', 'product_created', 'product_updated', 'product_out_of_stock', 'delivery_status_changed', 'payment_provider_error',
] as const;

export const ADMIN_EVENTS = [
  'admin_login', 'insight_viewed', 'recommendation_accepted', 'recommendation_rejected', 'action_approved', 'action_rejected', 'action_executed',
] as const;

export type EventType = (typeof CUSTOMER_EVENTS)[number] | (typeof OPERATIONAL_EVENTS)[number] | (typeof ADMIN_EVENTS)[number];
export type Actor = 'customer' | 'system' | 'admin';

export type TresorEvent<P extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  type: EventType;
  timestamp: string;
  actor: Actor;
  sessionId: string | null;
  customerId: string | null;
  source: string;
  schemaVersion: number;
  payload: P;
};

/** Required payload keys per event type (v1). Types not listed have no required keys. */
export const REQUIRED_PAYLOAD: Partial<Record<EventType, string[]>> = {
  page_view: ['path'],
  product_view: ['productId'],
  search_started: ['query'],
  search_completed: ['query', 'resultCount'],
  category_view: ['category'],
  product_added: ['productId', 'qty'],
  product_removed: ['productId'],
  cart_updated: ['itemCount', 'subtotal'],
  checkout_started: ['itemCount', 'total'],
  payment_started: ['method', 'amount'],
  payment_success: ['method', 'amount'],
  payment_failure: ['method', 'reason'],
  order_created: ['orderId', 'total', 'items'],
  order_cancelled: ['orderId'],
  tracking_viewed: ['orderId'],
  recommendation_shown: ['surface', 'productIds'],
  recommendation_clicked: ['surface', 'productId'],
  campaign_view: ['campaignId'],
  campaign_clicked: ['campaignId'],
  option_selected: ['group', 'optionId'],
  design_saved: ['designId'],
  design_shared: ['designId'],
  design_reopened: ['designId'],
  custom_cake_added_to_cart: ['designId', 'total'],
  custom_cake_ordered: ['designId', 'orderId'],
  inventory_updated: ['ingredientId', 'delta', 'reason'],
  product_out_of_stock: ['productId'],
  delivery_status_changed: ['orderId', 'status'],
  payment_provider_error: ['provider', 'code'],
  insight_viewed: ['insightId'],
  recommendation_accepted: ['recommendationId'],
  recommendation_rejected: ['recommendationId'],
  action_approved: ['actionId'],
  action_rejected: ['actionId'],
  action_executed: ['actionId'],
};

/** Keys that would carry personal or payment data. Refused anywhere in a payload. */
export const FORBIDDEN_KEYS = ['name', 'customerName', 'phone', 'email', 'address', 'pin', 'cardNumber', 'cvc', 'upiId', 'password', 'token', 'apiKey', 'secret'];

const ALL_TYPES = new Set<string>([...CUSTOMER_EVENTS, ...OPERATIONAL_EVENTS, ...ADMIN_EVENTS]);

export type Validation = { ok: true } | { ok: false; errors: string[] };

function forbiddenPaths(value: unknown, path = 'payload'): string[] {
  if (!value || typeof value !== 'object') return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.includes(k)) out.push(`${path}.${k}`);
    out.push(...forbiddenPaths(v, `${path}.${k}`));
  }
  return out;
}

export function validateEvent(event: unknown): Validation {
  const errors: string[] = [];
  const e = event as Partial<TresorEvent>;
  if (!e || typeof e !== 'object') return { ok: false, errors: ['event must be an object'] };
  if (typeof e.id !== 'string' || !e.id) errors.push('id is required');
  if (typeof e.type !== 'string' || !ALL_TYPES.has(e.type)) errors.push(`unknown event type: ${String(e.type)}`);
  if (typeof e.timestamp !== 'string' || Number.isNaN(Date.parse(e.timestamp))) errors.push('timestamp must be an ISO date');
  if (!['customer', 'system', 'admin'].includes(String(e.actor))) errors.push('actor must be customer, system or admin');
  if (e.schemaVersion !== EVENT_SCHEMA_VERSION) errors.push(`schemaVersion must be ${EVENT_SCHEMA_VERSION}`);
  if (typeof e.source !== 'string' || !e.source) errors.push('source is required');
  if (!e.payload || typeof e.payload !== 'object' || Array.isArray(e.payload)) errors.push('payload must be an object');
  else {
    for (const key of REQUIRED_PAYLOAD[e.type as EventType] ?? []) if (!(key in e.payload)) errors.push(`payload.${key} is required for ${e.type}`);
    for (const p of forbiddenPaths(e.payload)) errors.push(`${p} is not allowed (personal or payment data)`);
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

let seq = 0;
export function createEvent<P extends Record<string, unknown>>(type: EventType, payload: P, opts: { actor?: Actor; sessionId?: string | null; customerId?: string | null; source?: string; at?: Date } = {}): TresorEvent<P> {
  const actor: Actor = opts.actor ?? ((ADMIN_EVENTS as readonly string[]).includes(type) ? 'admin' : (OPERATIONAL_EVENTS as readonly string[]).includes(type) ? 'system' : 'customer');
  return {
    id: `ev-${Date.now().toString(36)}-${(seq += 1).toString(36)}`,
    type,
    timestamp: (opts.at ?? new Date()).toISOString(),
    actor,
    sessionId: opts.sessionId ?? null,
    customerId: opts.customerId ?? null,
    source: opts.source ?? 'web',
    schemaVersion: EVENT_SCHEMA_VERSION,
    payload,
  };
}
