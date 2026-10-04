// Repositories: the only way admin code reads and writes persistent data.
//
// Today every repository is a BrowserRepository (localStorage, synced across tabs by
// storage events). The future APIRepository implements the same interfaces against
// the backend: read() returns its cached snapshot, write() sends the change and
// reconciles, subscribe() is fed by the WebSocket/SSE source. Screens don't change.
//
// Orders, inventory and the cart stay owned by StoreProvider (the customer site uses
// them too). Their repositories here are read views over the same records, so the
// admin and the shop always refer to the same order.

import type { Order } from '@/lib/orders';
import type { Ingredient } from '@/lib/inventory';
import type { Invoice } from '@/lib/automation/automation';
import { AUTOMATION_KEYS } from '@/lib/automation/runner';
import { appendAudit, AUDIT_LIMIT, type AuditRecord } from './audit';
import type { Staff } from './permissions';
import { seedStaff } from './permissions';
import type { ProductRecord } from './catalog';
import { normalizeOverrides, type CakeOverrides } from './cake-builder';
import { normalizeSettings, type SettingsValues } from './settings';
import { DEFAULT_SLOTS, type Announcement, type Campaign, type ContentSlot } from './marketing';
import type { MediaOverlay } from './media-library';
import type { CustomerProfile } from './customers';
import type { AttentionState } from './attention';

export const ADMIN_KEYS = {
  staff: 'tresor-staff', session: 'tresor-admin-session', audit: 'tresor-audit', catalog: 'tresor-catalog', cake: 'tresor-cake-overrides',
  settings: 'tresor-settings', campaigns: 'tresor-campaigns', slots: 'tresor-content-slots', announcements: 'tresor-announcements',
  media: 'tresor-media-overlay', notes: 'tresor-internal-notes', profiles: 'tresor-customer-profiles', attention: 'tresor-attention-states',
  kitchen: 'tresor-kitchen-state', seen: 'tresor-admin-seen',
} as const;

/** A document-shaped store: one value, read, replaced, observed. */
export interface Repository<T> {
  read(): T;
  write(next: T): void;
  subscribe(listener: () => void): () => void;
}

export interface AuditRepository {
  list(): AuditRecord[];
  /** The only write: records are appended, never edited or removed. */
  append(record: AuditRecord): void;
  subscribe(listener: () => void): () => void;
}

export interface OrderRepository { list(): Order[]; get(id: string): Order | undefined; subscribe(listener: () => void): () => void }
export interface InventoryRepository { list(): Ingredient[]; subscribe(listener: () => void): () => void }
export interface InvoiceRepository { all(): Record<string, Invoice>; save(invoice: Invoice): void; subscribe(listener: () => void): () => void }
export type ProductRepository = Repository<Record<string, ProductRecord>>;
export type CakeCatalogRepository = Repository<CakeOverrides>;
export type SettingsRepository = Repository<SettingsValues>;
export type CampaignRepository = Repository<Campaign[]>;
export type MediaRepository = Repository<Record<string, MediaOverlay>>;
export type StaffRepository = Repository<Staff[]>;
export type CustomerRepository = Repository<Record<string, CustomerProfile>>;

export type InternalNote = { id: string; at: string; by: string; text: string };
export type KitchenState = { paused: boolean; pausedAt: string | null; pausedMinutes: number; startedAt: string | null };

function readKey<T>(key: string, fallback: () => T, normalize?: (raw: unknown) => T): T {
  if (typeof window === 'undefined') return fallback();
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback();
    const parsed = JSON.parse(raw);
    return normalize ? normalize(parsed) : (parsed as T);
  } catch { return fallback(); }
}

export type WriteResult = { ok: true } | { ok: false; reason: string };
let lastWriteError: string | null = null;
export const storageProblem = () => lastWriteError;

function writeKey(key: string, value: unknown): WriteResult {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    lastWriteError = null;
    return { ok: true };
  } catch {
    lastWriteError = 'The browser refused to save (storage full or blocked). The last change was not kept.';
    return { ok: false, reason: lastWriteError };
  }
}

/** localStorage-backed repository with an in-memory cache, invalidated by other tabs. */
export class BrowserRepository<T> implements Repository<T> {
  private cache: { value: T } | null = null;
  private listeners = new Set<() => void>();
  constructor(private key: string, private fallback: () => T, private normalize?: (raw: unknown) => T) {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => { if (e.key === this.key) { this.cache = null; this.emit(); } });
    }
  }
  read(): T {
    if (!this.cache) this.cache = { value: readKey(this.key, this.fallback, this.normalize) };
    return this.cache.value;
  }
  write(next: T): void {
    const result = writeKey(this.key, next);
    if (result.ok) this.cache = { value: next };
    this.emit();
    if (!result.ok) throw new Error(result.reason);
  }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private emit() { this.listeners.forEach((l) => l()); }
}

class BrowserAuditRepository implements AuditRepository {
  private repo = new BrowserRepository<AuditRecord[]>(ADMIN_KEYS.audit, () => [], (raw) => (Array.isArray(raw) ? (raw as AuditRecord[]) : []));
  list() { return this.repo.read(); }
  append(record: AuditRecord) { this.repo.write(appendAudit(this.repo.read(), record, AUDIT_LIMIT)); }
  subscribe(listener: () => void) { return this.repo.subscribe(listener); }
}

class BrowserInvoiceRepository implements InvoiceRepository {
  private listeners = new Set<() => void>();
  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('tresor-automation', () => this.listeners.forEach((l) => l()));
      window.addEventListener('storage', (e) => { if (e.key === AUTOMATION_KEYS.invoices) this.listeners.forEach((l) => l()); });
    }
  }
  all() { return readKey<Record<string, Invoice>>(AUTOMATION_KEYS.invoices, () => ({})); }
  save(invoice: Invoice) {
    const r = writeKey(AUTOMATION_KEYS.invoices, { ...this.all(), [invoice.orderId]: invoice });
    window.dispatchEvent(new Event('tresor-automation'));
    if (!r.ok) throw new Error(r.reason);
  }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
}

const isObj = (raw: unknown): raw is Record<string, unknown> => Boolean(raw) && typeof raw === 'object' && !Array.isArray(raw);

export function createBrowserRepositories() {
  return {
    staff: new BrowserRepository<Staff[]>(ADMIN_KEYS.staff, () => seedStaff(), (raw) => (Array.isArray(raw) && raw.length ? (raw as Staff[]) : seedStaff())),
    session: new BrowserRepository<string | null>(ADMIN_KEYS.session, () => 'staff-owner'),
    audit: new BrowserAuditRepository(),
    catalog: new BrowserRepository<Record<string, ProductRecord>>(ADMIN_KEYS.catalog, () => ({}), (raw) => (isObj(raw) ? (raw as Record<string, ProductRecord>) : {})),
    cake: new BrowserRepository<CakeOverrides>(ADMIN_KEYS.cake, () => normalizeOverrides(null), normalizeOverrides),
    settings: new BrowserRepository<SettingsValues>(ADMIN_KEYS.settings, () => normalizeSettings(null), normalizeSettings),
    campaigns: new BrowserRepository<Campaign[]>(ADMIN_KEYS.campaigns, () => [], (raw) => (Array.isArray(raw) ? (raw as Campaign[]) : [])),
    slots: new BrowserRepository<ContentSlot[]>(ADMIN_KEYS.slots, () => DEFAULT_SLOTS, (raw) => (Array.isArray(raw) ? DEFAULT_SLOTS.map((d) => ({ ...d, ...((raw as ContentSlot[]).find((s) => s.id === d.id) ?? {}) })) : DEFAULT_SLOTS)),
    announcements: new BrowserRepository<Announcement[]>(ADMIN_KEYS.announcements, () => [], (raw) => (Array.isArray(raw) ? (raw as Announcement[]) : [])),
    media: new BrowserRepository<Record<string, MediaOverlay>>(ADMIN_KEYS.media, () => ({}), (raw) => (isObj(raw) ? (raw as Record<string, MediaOverlay>) : {})),
    notes: new BrowserRepository<Record<string, InternalNote[]>>(ADMIN_KEYS.notes, () => ({}), (raw) => (isObj(raw) ? (raw as Record<string, InternalNote[]>) : {})),
    profiles: new BrowserRepository<Record<string, CustomerProfile>>(ADMIN_KEYS.profiles, () => ({}), (raw) => (isObj(raw) ? (raw as Record<string, CustomerProfile>) : {})),
    attention: new BrowserRepository<Record<string, AttentionState>>(ADMIN_KEYS.attention, () => ({}), (raw) => (isObj(raw) ? (raw as Record<string, AttentionState>) : {})),
    kitchen: new BrowserRepository<Record<string, KitchenState>>(ADMIN_KEYS.kitchen, () => ({}), (raw) => (isObj(raw) ? (raw as Record<string, KitchenState>) : {})),
    seen: new BrowserRepository<string>(ADMIN_KEYS.seen, () => new Date(Date.now() - 3600000).toISOString()),
    invoices: new BrowserInvoiceRepository(),
  };
}

export type AdminRepositories = ReturnType<typeof createBrowserRepositories>;
