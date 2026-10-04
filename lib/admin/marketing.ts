// Campaigns and content slots. Campaigns move through explicit states; content
// slots say where the storefront gets each piece: the code default (the designed
// cinematic site), a manual pick, the intelligence engine, or a campaign.

import type { TresorEvent } from '@/engine/intelligence';
import type { Order } from '@/lib/orders';

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'PAUSED' | 'ENDED';
export type Audience = 'everyone' | 'new' | 'returning' | 'high-value';

export type Campaign = {
  id: string;
  name: string;
  description: string;
  start: string; // ISO
  end: string;
  status: CampaignStatus;
  archived: boolean;
  audience: Audience;
  heroMediaId: string | null;
  featuredProductIds: string[];
  category: string | null;
  cta: { label: string; href: string };
  priority: number; // 1 (highest) – 5
  createdAt: string;
  updatedAt: string;
};

export const AUDIENCE_LABEL: Record<Audience, string> = { everyone: 'Everyone', new: 'New customers', returning: 'Returning customers', 'high-value': 'High-value customers' };

/** Allowed manual transitions. Scheduled campaigns go live and end by their dates. */
export const CAMPAIGN_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ['SCHEDULED'],
  SCHEDULED: ['DRAFT', 'PAUSED'],
  LIVE: ['PAUSED', 'ENDED'],
  PAUSED: ['LIVE', 'ENDED'],
  ENDED: [],
};

/** The status right now, letting dates move SCHEDULED → LIVE → ENDED. */
export function effectiveStatus(c: Campaign, now: Date): CampaignStatus {
  const t = now.getTime();
  if (c.status === 'SCHEDULED' || c.status === 'LIVE') {
    if (t >= Date.parse(c.end)) return 'ENDED';
    if (t >= Date.parse(c.start)) return 'LIVE';
    return 'SCHEDULED';
  }
  if (c.status === 'PAUSED' && t >= Date.parse(c.end)) return 'ENDED';
  return c.status;
}

export function canMove(c: Campaign, to: CampaignStatus, now: Date): boolean {
  if (c.archived) return false;
  return CAMPAIGN_TRANSITIONS[effectiveStatus(c, now)].includes(to);
}

export function validateCampaign(c: Campaign): Record<string, string> {
  const e: Record<string, string> = {};
  if (c.name.trim().length < 3) e.name = 'Give the campaign a name.';
  if (!Date.parse(c.start)) e.start = 'Choose a start.';
  if (!Date.parse(c.end)) e.end = 'Choose an end.';
  else if (Date.parse(c.end) <= Date.parse(c.start)) e.end = 'The end must be after the start.';
  // Links stay inside the site: no external URLs are invented or accepted here.
  if (c.cta.href && !/^\/[a-z0-9/_\-?=&#.]*$/i.test(c.cta.href)) e.cta = 'Link to a page on this site, starting with /.';
  if (c.cta.href && !c.cta.label.trim()) e.cta = 'Add a button label for the link.';
  if (!(c.priority >= 1 && c.priority <= 5)) e.priority = 'Priority is 1 (highest) to 5.';
  return e;
}

export function newCampaign(now = new Date()): Campaign {
  const start = new Date(now.getTime() + 86400000); start.setHours(9, 0, 0, 0);
  const end = new Date(start.getTime() + 7 * 86400000);
  return {
    id: `cmp-${now.getTime().toString(36)}`, name: '', description: '', start: start.toISOString(), end: end.toISOString(), status: 'DRAFT', archived: false,
    audience: 'everyone', heroMediaId: null, featuredProductIds: [], category: null, cta: { label: 'See the cakes', href: '/shop' }, priority: 3,
    createdAt: now.toISOString(), updatedAt: now.toISOString(),
  };
}

export type CampaignPerformance = { views: number; clicks: number; ctr: number | null; featuredViews: number; featuredRevenue: number; featuredUnits: number };

/** What the records can show today. Lift needs a baseline and is left to the backend phase. */
export function campaignPerformance(c: Campaign, events: TresorEvent[], orders: Order[]): CampaignPerformance {
  const from = Date.parse(c.start); const to = Date.parse(c.end);
  const inWindow = (iso: string) => { const t = Date.parse(iso); return t >= from && t < to; };
  const views = events.filter((e) => e.type === 'campaign_view' && e.payload.campaignId === c.id).length;
  const clicks = events.filter((e) => e.type === 'campaign_clicked' && e.payload.campaignId === c.id).length;
  const featured = new Set(c.featuredProductIds);
  const featuredViews = events.filter((e) => e.type === 'product_view' && featured.has(String(e.payload.productId)) && inWindow(e.timestamp)).length;
  let featuredRevenue = 0; let featuredUnits = 0;
  for (const o of orders) {
    if (o.status === 'CANCELLED' || !inWindow(o.createdAt)) continue;
    for (const l of o.items) if (featured.has(l.product.id)) { featuredRevenue += l.unitPrice * l.qty; featuredUnits += l.qty; }
  }
  return { views, clicks, ctr: views ? clicks / views : null, featuredViews, featuredRevenue, featuredUnits };
}

// ---------- Content ----------

export type SlotId = 'home.hero' | 'home.featuredCakes' | 'home.featuredProducts' | 'story' | 'customerLove' | 'seasonal';
export type SlotMode = 'code' | 'manual' | 'intelligence' | 'campaign';
export type ContentSlot = { id: SlotId; mode: SlotMode; productIds: string[]; campaignId: string | null; mediaId: string | null; updatedAt: string | null };

export const SLOT_INFO: Record<SlotId, { title: string; where: string; modes: SlotMode[] }> = {
  'home.hero': { title: 'Homepage hero', where: 'Home, first screen', modes: ['code', 'campaign'] },
  'home.featuredCakes': { title: 'Featured cakes', where: 'Home and the cakes collection', modes: ['code', 'manual', 'intelligence'] },
  'home.featuredProducts': { title: 'Featured products', where: 'Home menu preview', modes: ['code', 'manual', 'intelligence'] },
  story: { title: 'Story content', where: 'Our Story', modes: ['code'] },
  customerLove: { title: 'Customer Love', where: 'Our Story, testimonials', modes: ['code'] },
  seasonal: { title: 'Seasonal content', where: 'Home, seasonal band', modes: ['code', 'manual', 'campaign'] },
};

export const SLOT_MODE_LABEL: Record<SlotMode, string> = { code: 'As designed (code)', manual: 'Manual pick', intelligence: 'Intelligence engine', campaign: 'From a campaign' };

export const DEFAULT_SLOTS: ContentSlot[] = (Object.keys(SLOT_INFO) as SlotId[]).map((id) => ({ id, mode: 'code', productIds: [], campaignId: null, mediaId: null, updatedAt: null }));

export type Announcement = { id: string; text: string; href: string; start: string; end: string; active: boolean; updatedAt: string };

export function validateAnnouncement(a: Announcement): Record<string, string> {
  const e: Record<string, string> = {};
  if (a.text.trim().length < 4) e.text = 'Write the announcement.';
  if (a.text.length > 120) e.text = 'Keep it under 120 characters.';
  if (a.href && !/^\/[a-z0-9/_\-?=&#.]*$/i.test(a.href)) e.href = 'Link to a page on this site, starting with /.';
  if (!Date.parse(a.start) || !Date.parse(a.end) || Date.parse(a.end) <= Date.parse(a.start)) e.end = 'The end must be after the start.';
  return e;
}

/** The announcement the storefront shows now, if any (highest = most recently updated). */
export function liveAnnouncement(list: Announcement[], now: Date): Announcement | null {
  const t = now.getTime();
  return list.filter((a) => a.active && Date.parse(a.start) <= t && t < Date.parse(a.end)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}
