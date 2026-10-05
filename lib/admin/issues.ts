// Order issues and support: categories, explicit status transitions, assignment, internal notes,
// customer messages and resolution. Pure functions; the admin stores changes as a browser overlay
// on top of the shipped issues. Customer messages are simulated (nothing is sent).

import type { IssueCategory, IssuePriority, IssueStatus, SeedIssue } from '@/lib/mock-data/types';

export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = {
  OPEN: 'Open', ACKNOWLEDGED: 'Acknowledged', INVESTIGATING: 'Investigating', WAITING_CUSTOMER: 'Waiting for customer', RESOLVED: 'Resolved', CLOSED: 'Closed',
};
export const ISSUE_CATEGORY_LABEL: Record<IssueCategory, string> = {
  DELIVERY_DELAY: 'Delivery delay', QUALITY: 'Quality', WRONG_ITEM: 'Wrong item', MISSING_ITEM: 'Missing item', PAYMENT: 'Payment',
  REFUND_REQUEST: 'Refund request', CUSTOM_CAKE: 'Custom cake', OTHER: 'Other',
};
export const ISSUE_PRIORITY_LABEL: Record<IssuePriority, string> = { URGENT: 'Urgent', HIGH: 'High', NORMAL: 'Normal', LOW: 'Low' };
export const PRIORITY_RANK: Record<IssuePriority, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

/** Allowed moves, explicitly. Closed is final; a resolved issue can be reopened. */
export const ISSUE_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  OPEN: ['ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED'],
  ACKNOWLEDGED: ['INVESTIGATING', 'WAITING_CUSTOMER', 'RESOLVED'],
  INVESTIGATING: ['WAITING_CUSTOMER', 'RESOLVED'],
  WAITING_CUSTOMER: ['INVESTIGATING', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'INVESTIGATING'],
  CLOSED: [],
};
export const isOpenIssue = (i: Pick<SeedIssue, 'status'>) => i.status !== 'RESOLVED' && i.status !== 'CLOSED';
export const canMoveIssue = (from: IssueStatus, to: IssueStatus) => ISSUE_TRANSITIONS[from].includes(to);

export type IssueResult = { ok: true; issue: SeedIssue } | { ok: false; reason: string };

export function moveIssue(issue: SeedIssue, to: IssueStatus, at: Date, resolution?: string): IssueResult {
  if (!canMoveIssue(issue.status, to)) return { ok: false, reason: `${ISSUE_STATUS_LABEL[issue.status]} can’t move to ${ISSUE_STATUS_LABEL[to]}.` };
  if (to === 'RESOLVED' && !(resolution ?? '').trim()) return { ok: false, reason: 'Describe how it was resolved.' };
  const iso = at.toISOString();
  const resolved = to === 'RESOLVED' || to === 'CLOSED';
  return {
    ok: true,
    issue: {
      ...issue, status: to, updatedAt: iso,
      resolvedAt: resolved ? (issue.resolvedAt ?? iso) : null,
      resolution: to === 'RESOLVED' ? resolution!.trim().slice(0, 500) : to === 'CLOSED' ? issue.resolution : null,
    },
  };
}

export function assignIssue(issue: SeedIssue, staffId: string | null, at: Date): SeedIssue {
  // Picking it up acknowledges an open issue.
  return { ...issue, assignedTo: staffId, status: issue.status === 'OPEN' && staffId ? 'ACKNOWLEDGED' : issue.status, updatedAt: at.toISOString() };
}

export function addInternalNote(issue: SeedIssue, by: string, body: string, at: Date): IssueResult {
  const text = body.trim();
  if (text.length < 2) return { ok: false, reason: 'Write a note first.' };
  return { ok: true, issue: { ...issue, internalNotes: [...issue.internalNotes, { by, at: at.toISOString(), body: text.slice(0, 1000) }], updatedAt: at.toISOString() } };
}

/** A reply to the customer (simulated: recorded on the issue, not sent anywhere). */
export function addCustomerMessage(issue: SeedIssue, by: string, body: string, at: Date): IssueResult {
  const text = body.trim();
  if (text.length < 2) return { ok: false, reason: 'Write a message first.' };
  return { ok: true, issue: { ...issue, messages: [...issue.messages, { direction: 'outbound', channel: 'whatsapp', body: text.slice(0, 1000), at: at.toISOString(), by }], updatedAt: at.toISOString() } };
}

/** The next issue number after everything that exists (shipped and created here). */
export function nextIssueId(existing: Pick<SeedIssue, 'id'>[]): string {
  const highest = existing.reduce((m, i) => Math.max(m, Number(i.id.replace(/\D/g, '')) || 0), 0);
  return `ISS-${String(highest + 1).padStart(4, '0')}`;
}

export function newIssue(input: { orderId: string; customerId: string; category: IssueCategory; priority: IssuePriority; description: string; existing: Pick<SeedIssue, 'id'>[]; at: Date }): IssueResult {
  const description = input.description.trim();
  if (description.length < 5) return { ok: false, reason: 'Describe the issue in a few words.' };
  const iso = input.at.toISOString();
  return {
    ok: true,
    issue: {
      id: nextIssueId(input.existing), orderId: input.orderId, customerId: input.customerId, category: input.category, priority: input.priority, status: 'OPEN',
      description: description.slice(0, 500), assignedTo: null, internalNotes: [], messages: [], refundId: null, createdAt: iso, updatedAt: iso, resolvedAt: null, resolution: null,
    },
  };
}

/** Shipped issues with this browser's versions on top, plus issues created here. */
export function mergeIssues(seed: SeedIssue[], overlay: Record<string, SeedIssue>): SeedIssue[] {
  const merged = seed.map((i) => overlay[i.id] ?? i);
  const known = new Set(seed.map((i) => i.id));
  for (const i of Object.values(overlay)) if (!known.has(i.id)) merged.push(i);
  return merged;
}

export type IssueFilter = { view: 'open' | 'all' | IssueStatus; category: IssueCategory | 'ALL'; priority: IssuePriority | 'ALL'; assignee: string | 'ALL' | 'UNASSIGNED'; query: string };

/** Open issues first by priority then age; others newest first. */
export function queryIssues(list: SeedIssue[], f: IssueFilter, label: (i: SeedIssue) => string): SeedIssue[] {
  const q = f.query.trim().toLowerCase();
  return list
    .filter((i) => (f.view === 'all' || (f.view === 'open' ? isOpenIssue(i) : i.status === f.view))
      && (f.category === 'ALL' || i.category === f.category) && (f.priority === 'ALL' || i.priority === f.priority)
      && (f.assignee === 'ALL' || (f.assignee === 'UNASSIGNED' ? !i.assignedTo : i.assignedTo === f.assignee))
      && (!q || i.id.toLowerCase().includes(q) || i.orderId.toLowerCase().includes(q) || i.description.toLowerCase().includes(q) || label(i).toLowerCase().includes(q)))
    .sort((a, b) => {
      const ao = isOpenIssue(a), bo = isOpenIssue(b);
      if (ao !== bo) return ao ? -1 : 1;
      if (ao) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt.localeCompare(b.createdAt);
      return b.createdAt.localeCompare(a.createdAt);
    });
}
