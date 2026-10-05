'use client';

// The admin's state and its single action path.
//
// Every management mutation goes through `act()`:
//   authorize (business permission) → run the change → append the audit record →
//   toast the outcome. Nothing fails silently, and nothing changes without an audit
//   entry. Orders and inventory are changed through StoreProvider (the same records
//   the shop and tracking page use); everything else through the repositories.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useStore } from '@/components/store-provider';
import { useAutomation } from '@/components/use-automation';
import { useEvents } from '@/components/admin/insights';
import type { MockDataset } from '@/lib/mock-data/types';
import { createBrowserRepositories, storageProblem, type AdminRepositories, type Repository, type InternalNote, type KitchenState } from '@/lib/admin/repositories';
import { authorize, can, type Permission, type Staff } from '@/lib/admin/permissions';
import { makeAudit, type AuditRecord, type AuditSource, type EntityType } from '@/lib/admin/audit';
import { BrowserAdminEventSource, emitDomain, type DomainEvent } from '@/lib/admin/domain-events';
import { buildCatalog, type ProductRecord } from '@/lib/admin/catalog';
import { buildCakeCatalog, type CakeOverrides } from '@/lib/admin/cake-builder';
import { attentionThresholds, type SettingsValues } from '@/lib/admin/settings';
import { buildCustomers, type Customer, type CustomerProfile } from '@/lib/admin/customers';
import { deriveAttention, withStates, type AttentionItem, type AttentionState } from '@/lib/admin/attention';
import type { Announcement, Campaign, ContentSlot } from '@/lib/admin/marketing';
import type { MediaOverlay } from '@/lib/admin/media-library';
import { announceCatalogChange } from '@/lib/catalog/live';
import { registerSeedJobs, retryJob } from '@/lib/automation/runner';
import type { Invoice, Job, AutomationEvent } from '@/lib/automation/automation';
import type { CakeCatalog } from '@/lib/cake/config';

export type Toast = { id: number; tone: 'success' | 'warning' | 'error' | 'info'; title: string; detail?: string; action?: { label: string; run: () => void } };

export type ActInput = {
  permission: Permission;
  action: string;
  entity: { type: EntityType; id: string; label?: string };
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  source?: AuditSource;
  /** Performs the change. Return false or a message to report failure (nothing is audited then). */
  run: () => void | boolean | string;
  success?: string;
  quiet?: boolean;
};
export type ActResult = { ok: true } | { ok: false; reason: string };

export type ConfirmRequest = {
  title: string;
  body?: ReactNode;
  impact?: string[];
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  /** Ask for a reason (stored on the audit record). */
  reason?: 'required' | 'optional';
};
type ConfirmState = ConfirmRequest & { resolve: (r: { ok: boolean; reason: string }) => void };

function useRepo<T>(repo: Repository<T> | null, fallback: T): T {
  return useSyncExternalStore(
    useCallback((l: () => void) => (repo ? repo.subscribe(l) : () => {}), [repo]),
    () => (repo ? repo.read() : fallback),
    () => fallback,
  );
}

type AdminContext = {
  ready: boolean;
  repos: AdminRepositories | null;
  staff: Staff | null;
  staffList: Staff[];
  can: (p: Permission) => boolean;
  switchStaff: (id: string) => void;
  act: (input: ActInput) => ActResult;
  confirm: (req: ConfirmRequest) => Promise<{ ok: boolean; reason: string }>;
  toast: (t: Omit<Toast, 'id'>) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
  announce: (message: string) => void;
  liveMessage: string;
  now: Date;
  // Data
  audit: AuditRecord[];
  catalogRecords: Record<string, ProductRecord>;
  catalog: ProductRecord[];
  saveProduct: (r: ProductRecord) => void;
  cakeOverrides: CakeOverrides;
  cakeCatalog: CakeCatalog;
  saveCakeOverrides: (o: CakeOverrides) => void;
  settings: SettingsValues;
  saveSettings: (v: SettingsValues) => void;
  campaigns: Campaign[];
  saveCampaigns: (c: Campaign[]) => void;
  slots: ContentSlot[];
  saveSlots: (s: ContentSlot[]) => void;
  announcements: Announcement[];
  saveAnnouncements: (a: Announcement[]) => void;
  mediaOverlay: Record<string, MediaOverlay>;
  saveMediaOverlay: (m: Record<string, MediaOverlay>) => void;
  notes: Record<string, InternalNote[]>;
  addNote: (key: string, text: string) => ActResult;
  profiles: Record<string, CustomerProfile>;
  saveProfile: (p: CustomerProfile) => void;
  kitchen: Record<string, KitchenState>;
  saveKitchen: (k: Record<string, KitchenState>) => void;
  customers: Customer[];
  attention: (AttentionItem & { state: AttentionState })[];
  unread: number;
  setAttentionState: (ids: string[], state: AttentionState) => void;
  markAllRead: () => void;
  automation: ReturnType<typeof useAutomation>;
  events: ReturnType<typeof useEvents>;
  lastDomainEvent: DomainEvent | null;
};

const Ctx = createContext<AdminContext | null>(null);

const EMPTY = { staff: [] as Staff[], audit: [] as AuditRecord[], obj: {} as Record<string, never>, list: [] as never[] };

export function AdminProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const [repos, setRepos] = useState<AdminRepositories | null>(null);
  // The admin works on the shipped dataset plus this browser's changes: load it first.
  useEffect(() => { store.ensureSeed(); }, [store.ensureSeed]);
  useEffect(() => { if (store.seed) setRepos(createBrowserRepositories({ staff: store.seed.staff, campaigns: store.seed.campaigns })); }, [store.seed]);

  const staffList = useRepo(repos?.staff ?? null, EMPTY.staff);
  const sessionId = useRepo(repos?.session ?? null, null as string | null);
  const auditRepoValue = useSyncExternalStore(
    useCallback((l: () => void) => (repos ? repos.audit.subscribe(l) : () => {}), [repos]),
    () => (repos ? repos.audit.list() : EMPTY.audit),
    () => EMPTY.audit,
  );
  const catalogRecords = useRepo(repos?.catalog ?? null, EMPTY.obj as Record<string, ProductRecord>);
  const cakeOverrides = useRepo(repos?.cake ?? null, null as unknown as CakeOverrides);
  const settings = useRepo(repos?.settings ?? null, null as unknown as SettingsValues);
  const campaigns = useRepo(repos?.campaigns ?? null, EMPTY.list as Campaign[]);
  const slots = useRepo(repos?.slots ?? null, EMPTY.list as ContentSlot[]);
  const announcements = useRepo(repos?.announcements ?? null, EMPTY.list as Announcement[]);
  const mediaOverlay = useRepo(repos?.media ?? null, EMPTY.obj as Record<string, MediaOverlay>);
  const notes = useRepo(repos?.notes ?? null, EMPTY.obj as Record<string, InternalNote[]>);
  const profiles = useRepo(repos?.profiles ?? null, EMPTY.obj as Record<string, CustomerProfile>);
  const attentionStates = useRepo(repos?.attention ?? null, EMPTY.obj as Record<string, AttentionState>);
  const kitchen = useRepo(repos?.kitchen ?? null, EMPTY.obj as Record<string, KitchenState>);
  const seen = useRepo(repos?.seen ?? null, '');
  const localAutomation = useAutomation();
  const automation = useMemo(() => mergeAutomation(localAutomation, store.seed), [localAutomation, store.seed]);
  // Shipped staff actions first, then this browser's (append-only either way), oldest to newest.
  const audit = useMemo(() => (store.seed ? [...store.seed.audit, ...auditRepoValue] : auditRepoValue), [store.seed, auditRepoValue]);
  useEffect(() => { if (store.seed) registerSeedJobs(store.seed.automations.jobs); }, [store.seed]);
  const events = useEvents();

  const staff = staffList.find((s) => s.id === sessionId) ?? staffList.find((s) => s.role === 'OWNER') ?? null;
  const ready = Boolean(repos) && store.mounted && store.seedStatus === 'ready' && Boolean(settings) && Boolean(cakeOverrides);

  // A clock for due times and elapsed minutes (30 s is plenty for operations).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);

  // ---------- Toasts and announcements ----------
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = (toastSeq.current += 1);
    setToasts((all) => [...all.slice(-3), { ...t, id }]);
    window.setTimeout(() => dismissToast(id), t.tone === 'error' ? 9000 : t.action ? 8000 : 4500);
  }, [dismissToast]);
  const [liveMessage, setLiveMessage] = useState('');
  const announce = useCallback((m: string) => { setLiveMessage(''); window.setTimeout(() => setLiveMessage(m), 30); }, []);

  // ---------- The action path ----------
  const act = useCallback((input: ActInput): ActResult => {
    const auth = authorize(staff, input.permission);
    if (!auth.ok) { toast({ tone: 'error', title: 'Not allowed', detail: auth.reason }); return { ok: false, reason: auth.reason }; }
    let outcome: void | boolean | string;
    try { outcome = input.run(); } catch (e) {
      const reason = e instanceof Error && e.message ? e.message : 'Something went wrong. Nothing was changed.';
      toast({ tone: 'error', title: 'Couldn’t save', detail: reason });
      return { ok: false, reason };
    }
    if (outcome === false || typeof outcome === 'string') {
      const reason = typeof outcome === 'string' ? outcome : 'That change isn’t allowed right now.';
      toast({ tone: 'error', title: 'Not changed', detail: reason });
      return { ok: false, reason };
    }
    try {
      repos?.audit.append(makeAudit({
        actor: { id: staff!.id, name: staff!.name, role: staff!.role }, action: input.action, entity: input.entity,
        before: input.before ?? null, after: input.after ?? null, reason: input.reason?.trim() || null, source: input.source ?? 'admin-ui',
      }));
    } catch {
      toast({ tone: 'warning', title: 'Saved, but the audit entry couldn’t be written', detail: 'Browser storage is full. Export the audit log and clear old data.' });
    }
    if (!input.quiet) toast({ tone: 'success', title: input.success ?? 'Saved' });
    return { ok: true };
  }, [staff, repos, toast]);

  // ---------- Confirmations ----------
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const confirm = useCallback((req: ConfirmRequest) => new Promise<{ ok: boolean; reason: string }>((resolve) => setConfirmState({ ...req, resolve })), []);

  // ---------- Writers ----------
  const write = useCallback(<T,>(repo: Repository<T> | undefined, value: T) => { repo?.write(value); }, []);
  const saveProduct = useCallback((r: ProductRecord) => { write(repos?.catalog, { ...repos!.catalog.read(), [r.id]: r }); announceCatalogChange(); emitDomain('catalog.changed', r.id, { kind: 'product' }); }, [repos, write]);
  const saveCakeOverrides = useCallback((o: CakeOverrides) => { write(repos?.cake, o); announceCatalogChange(); emitDomain('catalog.changed', 'cake', { kind: 'cake', revision: o.revision }); }, [repos, write]);
  const saveSettings = useCallback((v: SettingsValues) => { write(repos?.settings, v); announceCatalogChange(); emitDomain('settings.changed', 'settings', {}); }, [repos, write]);
  const saveCampaigns = useCallback((c: Campaign[]) => write(repos?.campaigns, c), [repos, write]);
  const saveSlots = useCallback((s: ContentSlot[]) => write(repos?.slots, s), [repos, write]);
  const saveAnnouncements = useCallback((a: Announcement[]) => write(repos?.announcements, a), [repos, write]);
  const saveMediaOverlay = useCallback((m: Record<string, MediaOverlay>) => write(repos?.media, m), [repos, write]);
  const saveProfile = useCallback((p: CustomerProfile) => write(repos?.profiles, { ...repos!.profiles.read(), [p.id]: p }), [repos, write]);
  const saveKitchen = useCallback((k: Record<string, KitchenState>) => write(repos?.kitchen, k), [repos, write]);

  const addNote = useCallback((key: string, text: string): ActResult => {
    const clean = text.trim().slice(0, 500);
    if (!clean) return { ok: false, reason: 'Write the note first.' };
    const note: InternalNote = { id: `note-${Date.now().toString(36)}`, at: new Date().toISOString(), by: staff?.name ?? 'Unknown', text: clean };
    return act({
      permission: 'customCakes.notes', action: 'customCake.note.added', entity: { type: 'customCake', id: key }, after: { text: clean },
      run: () => { const all = repos!.notes.read(); repos!.notes.write({ ...all, [key]: [...(all[key] ?? []), note] }); },
      success: 'Note added (staff only)',
    });
  }, [act, repos, staff]);

  const switchStaff = useCallback((id: string) => {
    const next = staffList.find((s) => s.id === id);
    if (!next || !repos) return;
    repos.session.write(id);
    repos.audit.append(makeAudit({ actor: { id: next.id, name: next.name, role: next.role }, action: 'session.switched', entity: { type: 'session', id: next.id, label: next.name }, before: staff ? { staff: staff.name } : null, after: { staff: next.name }, reason: 'Demo staff switcher', source: 'admin-ui' }));
    toast({ tone: 'info', title: `Signed in as ${next.name}` });
  }, [staffList, repos, staff, toast]);

  // ---------- Derived ----------
  const catalog = useMemo(() => buildCatalog(catalogRecords), [catalogRecords]);
  const cakeCatalog = useMemo(() => buildCakeCatalog(cakeOverrides ?? { revision: 0, options: {}, fonts: {}, messageColors: {}, printRules: {}, rules: {}, createdRules: [], baseProductionHours: null }), [cakeOverrides]);
  const customers = useMemo(() => buildCustomers(store.orders, now), [store.orders, now]);
  const thresholds = useMemo(() => attentionThresholds(settings ?? {}), [settings]);
  const attentionItems = useMemo(() => deriveAttention({
    orders: store.orders, inventory: store.inventory, jobs: automation.jobs, events, now, thresholds,
    newSince: seen || new Date(now.getTime() - 3600000).toISOString(), storageWarning: storageProblem(),
  }), [store.orders, store.inventory, automation.jobs, events, now, thresholds, seen]);
  const attention = useMemo(() => withStates(attentionItems, attentionStates), [attentionItems, attentionStates]);
  const unread = attention.filter((a) => a.state === 'UNREAD').length;

  const setAttentionState = useCallback((ids: string[], state: AttentionState) => {
    if (!repos || !ids.length) return;
    const next = { ...repos.attention.read() };
    for (const id of ids) next[id] = state;
    repos.attention.write(next);
    if (state === 'RESOLVED' && staff) repos.audit.append(makeAudit({ actor: { id: staff.id, name: staff.name, role: staff.role }, action: 'notification.resolved', entity: { type: 'notification', id: ids.join(',') }, before: null, after: { state }, reason: null, source: 'admin-ui' }));
  }, [repos, staff]);
  const markAllRead = useCallback(() => {
    setAttentionState(attention.filter((a) => a.state === 'UNREAD').map((a) => a.id), 'READ');
    repos?.seen.write(new Date().toISOString());
  }, [attention, setAttentionState, repos]);

  // ---------- Live domain events ----------
  const [lastDomainEvent, setLastDomainEvent] = useState<DomainEvent | null>(null);
  const thresholdsRef = useRef(thresholds); thresholdsRef.current = thresholds;
  // Retry from a toast goes through the same audited path as the Automations page.
  const retryRef = useRef((jobId: string, orderId: string) => { void jobId; void orderId; });
  retryRef.current = (jobId, orderId) => act({
    permission: 'automations.retry', action: 'automation.retried', entity: { type: 'automation', id: jobId, label: orderId }, before: { status: 'failed' }, after: { status: 'retrying' },
    run: () => { retryJob(jobId, () => store.findOrder(orderId)); }, success: 'Retrying…',
  });
  useEffect(() => {
    const source = new BrowserAdminEventSource();
    source.connect();
    const off = source.subscribe((e) => {
      setLastDomainEvent(e);
      if (e.type === 'order.created' && thresholdsRef.current.announceNewOrders) {
        const msg = `New order ${e.entityId}, ₹${Number(e.data.total ?? 0).toLocaleString('en-IN')}${e.data.custom ? ', with a custom cake' : ''}.`;
        announce(msg);
        toast({ tone: 'info', title: `New order ${e.entityId}`, detail: msg });
      }
      if (e.type === 'invoice.failed' || e.type === 'notification.failed') {
        const jobId = String(e.data.jobId ?? '');
        toast({
          tone: 'warning', title: `${e.type === 'invoice.failed' ? 'Invoice' : 'WhatsApp'} failed for ${e.entityId}`, detail: 'The order is safe. Retry now?',
          action: jobId ? { label: 'Retry', run: () => retryRef.current(jobId, e.entityId) } : undefined,
        });
      }
    });
    return () => { off(); source.disconnect(); };
  }, [announce, toast]);

  const value: AdminContext = {
    ready, repos, staff, staffList, can: (p) => can(staff, p), switchStaff, act, confirm, toast, toasts, dismissToast, announce, liveMessage, now,
    audit, catalogRecords, catalog, saveProduct, cakeOverrides, cakeCatalog, saveCakeOverrides, settings, saveSettings,
    campaigns, saveCampaigns, slots, saveSlots, announcements, saveAnnouncements, mediaOverlay, saveMediaOverlay, notes, addNote,
    profiles, saveProfile, kitchen, saveKitchen, customers, attention, unread, setAttentionState, markAllRead, automation, events, lastDomainEvent,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      {confirmState && <ConfirmDialog state={confirmState} onDone={(r) => { confirmState.resolve(r); setConfirmState(null); }} />}
    </Ctx.Provider>
  );
}

export function useAdmin() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAdmin must be used inside AdminProvider');
  return v;
}

function ConfirmDialog({ state, onDone }: { state: ConfirmState; onDone: (r: { ok: boolean; reason: string }) => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const previous = useRef<Element | null>(null);
  useEffect(() => {
    previous.current = document.activeElement;
    box.current?.querySelector<HTMLElement>('textarea, button[data-confirm]')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDone({ ok: false, reason: '' }); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); (previous.current as HTMLElement | null)?.focus?.(); };
  }, [onDone]);
  const submit = () => {
    if (state.reason === 'required' && reason.trim().length < 3) { setError('Add a short reason. It’s kept in the audit log.'); return; }
    onDone({ ok: true, reason: reason.trim() });
  };
  return (
    <div className="ad-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onDone({ ok: false, reason: '' }); }}>
      <div className="ad-modal" role="alertdialog" aria-modal="true" aria-labelledby="ad-confirm-title" ref={box}>
        <h2 id="ad-confirm-title">{state.title}</h2>
        {state.body && <div className="ad-modal-body">{state.body}</div>}
        {state.impact && state.impact.length > 0 && (
          <div className="ad-impact"><div className="ad-impact-label">What happens</div><ul>{state.impact.map((i) => <li key={i}>{i}</li>)}</ul></div>
        )}
        {state.reason && (
          <label className="ad-field">
            <span>Reason{state.reason === 'optional' ? ' (optional)' : ''}</span>
            <textarea rows={2} value={reason} onChange={(e) => { setReason(e.target.value); setError(''); }} aria-invalid={Boolean(error)} />
            {error && <em className="ad-error" role="alert">{error}</em>}
          </label>
        )}
        <div className="ad-modal-actions">
          <button type="button" className="ad-btn" onClick={() => onDone({ ok: false, reason: '' })}>Keep as is</button>
          <button type="button" data-confirm className={`ad-btn ${state.tone === 'danger' ? 'ad-btn-danger' : 'ad-btn-primary'}`} onClick={submit}>{state.confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Shipped automation records with this browser's on top: a job, invoice or log entry made here
 * replaces the shipped one with the same id; newest first for the log.
 */
function mergeAutomation(local: ReturnType<typeof useAutomation>, seed: MockDataset | null): ReturnType<typeof useAutomation> {
  if (!seed) return local;
  const jobs = new Map<string, Job>(seed.automations.jobs.map((j) => [j.id, j]));
  for (const j of local.jobs) jobs.set(j.id, j);
  const invoices: Record<string, Invoice> = Object.fromEntries(seed.invoices.map((i) => [i.orderId, i]));
  Object.assign(invoices, local.invoices);
  const log: AutomationEvent[] = [...local.log, ...seed.automations.log].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return { ...local, jobs: [...jobs.values()], invoices, log };
}
