// Browser runner for the mock automations. Jobs, invoices, the WhatsApp outbox
// and the event log persist in localStorage, so the admin (in any tab) sees them
// live. A job is claimed before it runs, so two tabs never process it twice.

import type { Order, OrderStatus } from '@/lib/orders';
import { sessionId } from '@/engine/intelligence/context/context';
import { emitDomain } from '@/lib/admin/domain-events';
import { isRecord, recordsOnly } from '@/lib/safe-storage';
import {
  afterAttempt, buildInvoice, maskPhone, newJob, NOTIFY_STATUSES, RETRY_DELAYS_MS, whatsappMessage,
  type AutomationEvent, type AutomationEventType, type Faults, type Invoice, type Job,
} from './automation';

const KEYS = { jobs: 'tresor-automation-jobs', log: 'tresor-automation-log', invoices: 'tresor-invoices', outbox: 'tresor-whatsapp-outbox', faults: 'tresor-mock-faults', client: 'tresor-client-id' };
export const AUTOMATION_KEYS = KEYS;

export type OutboxMessage = { jobId: string; orderId: string; to: string; text: string; sentAt: string };

const read = <T,>(k: string, fallback: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); window.dispatchEvent(new Event('tresor-automation')); } catch { /* storage full */ } };

export const readJobs = () => recordsOnly<Job>(read<unknown>(KEYS.jobs, []), (j) => typeof j.id === 'string' && typeof j.orderId === 'string');
export const readLog = () => recordsOnly<AutomationEvent>(read<unknown>(KEYS.log, []), (e) => typeof e.type === 'string');
export const readInvoices = () => { const v = read<unknown>(KEYS.invoices, {}); return (isRecord(v) ? v : {}) as Record<string, Invoice>; };
export const readOutbox = () => recordsOnly<OutboxMessage>(read<unknown>(KEYS.outbox, []));
export const readFaults = () => { const v = read<unknown>(KEYS.faults, {}); return (isRecord(v) ? v : {}) as Faults; };

let seq = 0;
function log(type: AutomationEventType, orderId: string, status: AutomationEvent['status'], detail?: string) {
  const entry: AutomationEvent = {
    id: `ae-${Date.now().toString(36)}-${(seq += 1)}`, type, orderId, status, detail,
    clientId: read<string | null>(KEYS.client, null), sessionId: sessionId(), timestamp: new Date().toISOString(),
  };
  write(KEYS.log, [...readLog(), entry].slice(-2000));
}

function saveJob(job: Job) {
  write(KEYS.jobs, [...readJobs().filter((j) => j.id !== job.id), job]);
}

/** Enqueue a job once. A repeated trigger is logged as suppressed, never run twice. */
function enqueue(kind: Job['kind'], order: Order, topic: string) {
  const job = newJob(kind, order.id, topic);
  if (readJobs().some((j) => j.id === job.id)) { log('automation.duplicate_suppressed', order.id, 'skipped', job.id); return; }
  saveJob(job);
  log(kind === 'invoice' ? 'invoice.requested' : 'whatsapp.requested', order.id, 'ok', topic);
  void run(job.id, () => order);
}

// Fail-once faults fail the first attempt of each job, then succeed.
async function provider(job: Job, order: Order, faults: Faults): Promise<{ ok: true; result: Job['result'] } | { ok: false; error: string }> {
  await new Promise((r) => setTimeout(r, 120));
  if (job.kind === 'invoice') {
    if (faults.invoice === 'fail-always' || (faults.invoice === 'fail-once' && job.attempts === 0)) return { ok: false, error: 'Invoice service unavailable (simulated)' };
    const inv = buildInvoice(order);
    write(KEYS.invoices, { ...readInvoices(), [order.id]: inv });
    return { ok: true, result: { invoiceNumber: inv.invoiceNumber } };
  }
  if (faults.whatsapp === 'fail-always') return { ok: false, error: 'WhatsApp provider error (simulated)' };
  if (faults.whatsapp === 'timeout-once' && job.attempts === 0) { await new Promise((r) => setTimeout(r, 600)); return { ok: false, error: 'WhatsApp provider timed out (simulated)' }; }
  const outbox = readOutbox();
  if (outbox.some((m) => m.jobId === job.id)) return { ok: true, result: { to: maskPhone(order.customer.phone), text: outbox.find((m) => m.jobId === job.id)!.text } };
  const text = whatsappMessage(order, job.topic);
  write(KEYS.outbox, [...outbox, { jobId: job.id, orderId: order.id, to: order.customer.phone, text, sentAt: new Date().toISOString() }]);
  return { ok: true, result: { to: maskPhone(order.customer.phone), text } };
}

async function run(id: string, getOrder: () => Order | undefined) {
  const job = readJobs().find((j) => j.id === id);
  if (!job || job.status === 'succeeded' || job.status === 'failed') return;
  if (job.claimedAt && Date.now() - job.claimedAt < 5000) return; // another tab is on it
  const order = getOrder();
  if (!order) return;
  saveJob({ ...job, claimedAt: Date.now() });
  const outcome = await provider(job, order, readFaults());
  const next = afterAttempt(job, outcome);
  saveJob(next);
  const kind = job.kind;
  if (next.status === 'succeeded') {
    log(kind === 'invoice' ? 'invoice.generated' : 'whatsapp.sent', order.id, 'ok', next.result?.invoiceNumber ?? job.topic);
    emitDomain(kind === 'invoice' ? 'invoice.generated' : 'notification.sent', order.id, { jobId: job.id, topic: job.topic });
  }
  else if (next.status === 'retrying') {
    log(kind === 'invoice' ? 'invoice.retrying' : 'whatsapp.retrying', order.id, 'retry', next.lastError ?? undefined);
    setTimeout(() => void run(id, getOrder), RETRY_DELAYS_MS[next.attempts - 1] ?? 1600);
  } else {
    log(kind === 'invoice' ? 'invoice.failed' : 'whatsapp.failed', order.id, 'failed', next.lastError ?? undefined);
    emitDomain(kind === 'invoice' ? 'invoice.failed' : 'notification.failed', order.id, { jobId: job.id, topic: job.topic, error: next.lastError });
  }
}

// ---------- Triggers ----------

export function onOrderCreated(order: Order) {
  log('order.created', order.id, 'ok', `₹${order.total}`);
  log('admin.order.created', order.id, 'ok');
  log('analytics.order.created', order.id, 'ok');
  enqueue('invoice', order, 'confirmation');
  enqueue('whatsapp', order, 'confirmation');
}

export function onStatusChanged(order: Order, status: OrderStatus) {
  log('order.status.changed', order.id, 'ok', status);
  if (NOTIFY_STATUSES.includes(status)) enqueue('whatsapp', order, `status:${status}`);
}

/** A person retries a failed job from the admin. */
/** Jobs from the shipped demo dataset (read-only). Retrying one copies it into this browser first. */
const seedJobs = new Map<string, Job>();
export function registerSeedJobs(jobs: Job[]) { seedJobs.clear(); for (const j of jobs) seedJobs.set(j.id, j); }

export function retryJob(id: string, getOrder: () => Order | undefined) {
  const job = readJobs().find((j) => j.id === id) ?? seedJobs.get(id);
  if (!job || job.status !== 'failed') return;
  saveJob({ ...job, status: 'retrying', attempts: 0, claimedAt: null });
  void run(id, getOrder);
}

/** On load, pick up jobs that a closed tab left unfinished. */
export function resumePending(findOrder: (id: string) => Order | undefined) {
  for (const j of readJobs()) if (j.status === 'requested' || j.status === 'retrying') void run(j.id, () => findOrder(j.orderId));
}
