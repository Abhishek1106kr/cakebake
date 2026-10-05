// Shapes of the shipped demo dataset (public/mock-data/*.json). Generated deterministically by
// scripts/generate-mock-data.ts, checked by scripts/validate-mock-data.ts, loaded by store.ts.
// Seed records are read-only; anything a visitor changes is stored as a browser overlay.

import type { Order, PaymentMethod } from '@/lib/orders';
import type { Ingredient } from '@/lib/inventory';
import type { AutomationEvent, Invoice, Job } from '@/lib/automation/automation';
import type { Campaign } from '@/lib/admin/marketing';
import type { Role } from '@/lib/admin/permissions';
import type { CakeConfiguration } from '@/lib/cake/types';
import type { AuditRecord } from '@/lib/admin/audit';

export const MOCK_DATA_FILES = [
  'manifest', 'customers', 'orders', 'products', 'custom-cakes', 'payments', 'invoices', 'issues',
  'notifications', 'automations', 'inventory', 'analytics', 'staff', 'campaigns', 'audit',
] as const;
export type MockDataFile = (typeof MOCK_DATA_FILES)[number];

export type SeedManifest = {
  version: string;
  /** The moment the dataset was generated for. Loading shifts history so the anchor day becomes today. */
  anchor: string;
  timezone: 'Asia/Kolkata';
  seed: number;
  counts: Record<string, number>;
  /** Orders placed on the anchor day, re-timed relative to "now" when loaded. */
  liveOrderIds: string[];
  /** Ingredient levels at the anchor (the storefront needs only these, not the history). */
  inventoryLevels: { id: string; onHand: number; reserved: number }[];
  note: string;
};

export type SeedCustomer = {
  id: string; // CUS-00001
  name: string;
  phone: string; // synthetic: starts with 5550 (no Indian mobile number starts with 5)
  email: string; // example.com / example.net / example.org only
  address: string;
  locality: string;
  pin: string;
  createdAt: string;
  marketingOptIn: boolean;
  preferredMethod: PaymentMethod;
  tags: string[];
  notes: string;
  orderIds: string[]; // oldest first
  orderCount: number; // excludes cancelled
  totalSpend: number; // sum of order totals, excludes cancelled
  refunded: number; // processed refunds on their orders
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  customCakeIds: string[];
  issueIds: string[];
};

/** A shipped order: the app's own Order shape plus the customer it belongs to. */
export type SeedOrder = Order & { customerId: string; liveOffsetMin?: number };

export type PaymentRecordStatus = 'CREATED' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'CANCELLED' | 'REFUND_PENDING' | 'PARTIALLY_REFUNDED' | 'REFUNDED';

export type SeedRefund = {
  id: string; // RFD-0001
  paymentId: string;
  orderId: string;
  amount: number;
  reason: string;
  status: 'PENDING' | 'PROCESSED';
  issueId: string | null;
  by: string; // staff id
  createdAt: string;
  processedAt: string | null;
};

export type SeedPayment = {
  id: string; // PAY-000001
  orderId: string;
  customerId: string;
  /** 'simulated' for UPI and card (no real gateway in the demo), 'cod' for pay at door. */
  provider: 'simulated' | 'cod';
  method: PaymentMethod;
  status: PaymentRecordStatus;
  amount: number;
  attempt: number; // 1 for the first try on this order
  reference: string | null;
  failureReason: string | null;
  createdAt: string;
  capturedAt: string | null;
  refundedAmount: number;
  refunds: SeedRefund[];
};

export type SeedCustomCake = {
  id: string; // design id (TC-...)
  orderId: string;
  customerId: string;
  lineId: string;
  occasion: string;
  title: string;
  message: string;
  config: CakeConfiguration;
  lines: string[];
  productionHours: number;
  price: number;
  priceVersion: string;
  slot: string;
  createdAt: string;
};

export type IssueStatus = 'OPEN' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED';
export type IssuePriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type IssueCategory = 'DELIVERY_DELAY' | 'QUALITY' | 'WRONG_ITEM' | 'MISSING_ITEM' | 'PAYMENT' | 'REFUND_REQUEST' | 'CUSTOM_CAKE' | 'OTHER';

export type SeedIssue = {
  id: string; // ISS-0001
  orderId: string;
  customerId: string;
  category: IssueCategory;
  priority: IssuePriority;
  status: IssueStatus;
  description: string;
  assignedTo: string | null; // staff id
  internalNotes: { by: string; at: string; body: string }[];
  messages: { direction: 'inbound' | 'outbound'; channel: 'whatsapp' | 'email' | 'phone'; body: string; at: string; by: string | null }[];
  refundId: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolution: string | null;
};

export type NotificationType = 'PAYMENT_FAILURE' | 'ORDER_URGENT' | 'LOW_STOCK' | 'ISSUE_CREATED' | 'AUTOMATION_FAILURE' | 'CUSTOM_CAKE_DEADLINE' | 'DELIVERY_DELAY';

export type SeedNotification = {
  id: string; // NTF-0001
  type: NotificationType;
  title: string;
  body: string;
  resourceType: 'order' | 'ingredient' | 'issue' | 'payment' | 'job';
  resourceId: string;
  href: string;
  state: 'UNREAD' | 'READ' | 'RESOLVED';
  createdAt: string;
  readAt: string | null;
  resolvedAt: string | null;
};

export type SeedAutomations = { jobs: Job[]; log: AutomationEvent[] };

/** Stock movements: the app's reasons plus 'Sale' (online orders and counter use for a period). */
export type SeedMovement = {
  id: string;
  at: string;
  ingredientId: string;
  delta: number;
  reason: 'Restock' | 'Wastage' | 'Correction' | 'Sale';
  note?: string;
  actor?: string;
  /** For 'Sale': the part used by online orders (in `orderIds`) and the part used at the counter. */
  online?: number;
  counter?: number;
  orderIds?: string[];
  period?: 'day' | 'week';
};

export type SeedInventory = { ingredients: Ingredient[]; movements: SeedMovement[] };

export type SeedAnalyticsDay = {
  date: string; // YYYY-MM-DD (IST)
  sessions: number;
  productViews: number;
  addToCart: number;
  checkoutStarted: number;
  paymentFailures: number;
  orders: number;
  revenue: number;
  searches: number;
  cakePlaygroundSessions: number;
  customCakeAdds: number;
  recommendationImpressions: number;
  recommendationClicks: number;
};

export type SeedAnalytics = {
  days: SeedAnalyticsDay[];
  topSearches: { term: string; count: number; resultCount: number }[];
  note: string;
};

export type SeedStaff = { id: string; name: string; role: Role; active: boolean; createdAt: string; email: string };

export type SeedCampaign = Campaign & { attributedOrderIds: string[]; attributedRevenue: number };

export type MockDataset = {
  manifest: SeedManifest;
  customers: SeedCustomer[];
  orders: SeedOrder[];
  products: { id: string; name: string; category: string; price: number; available: boolean }[];
  customCakes: SeedCustomCake[];
  payments: SeedPayment[];
  invoices: Invoice[];
  issues: SeedIssue[];
  notifications: SeedNotification[];
  automations: SeedAutomations;
  inventory: SeedInventory;
  analytics: SeedAnalytics;
  staff: SeedStaff[];
  campaigns: SeedCampaign[];
  /** Staff actions over the dataset's history (status changes, refunds, stock, issues, campaigns). */
  audit: AuditRecord[];
};
