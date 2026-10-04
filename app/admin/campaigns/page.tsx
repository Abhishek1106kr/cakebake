'use client';

import { useMemo, useState } from 'react';
import { Copy, Plus } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { useAdmin } from '@/components/admin/admin-provider';
import { NumberInput, useDraft } from '@/components/admin/forms';
import { Badge, Chips, Drawer, Empty, Field, Guard, Kpi, PageHeader, Panel, dateTime, rupees, useUrlParam } from '@/components/admin/ui';
import { AUDIENCE_LABEL, campaignPerformance, canMove, effectiveStatus, newCampaign, validateCampaign, type Audience, type Campaign, type CampaignStatus } from '@/lib/admin/marketing';
import { CATEGORIES } from '@/lib/admin/catalog';
import { registryAssets } from '@/lib/admin/media-library';
import { emitDomain } from '@/lib/admin/domain-events';

type F = 'ALL' | CampaignStatus | 'ARCHIVED';
const FILTERS: { id: F; label: string }[] = [{ id: 'ALL', label: 'All' }, { id: 'LIVE', label: 'Live' }, { id: 'SCHEDULED', label: 'Scheduled' }, { id: 'DRAFT', label: 'Draft' }, { id: 'PAUSED', label: 'Paused' }, { id: 'ENDED', label: 'Ended' }, { id: 'ARCHIVED', label: 'Archived' }];
const TONE: Record<CampaignStatus, 'ok' | 'info' | 'neutral' | 'warn' | 'muted'> = { LIVE: 'ok', SCHEDULED: 'info', DRAFT: 'neutral', PAUSED: 'warn', ENDED: 'muted' };
const toLocal = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : '');

export default function CampaignsPage() {
  return <Guard permission="campaigns.view"><Campaigns /></Guard>;
}

function Campaigns() {
  const { orders } = useStore();
  const admin = useAdmin();
  const { now } = admin;
  const [filter, setFilter] = useUrlParam('status', 'ALL');
  const [openId, setOpenId] = useUrlParam('c', '');
  const [creating, setCreating] = useState<Campaign | null>(null);
  const f = (FILTERS.some((x) => x.id === filter) ? filter : 'ALL') as F;
  const matches = (c: Campaign, x: F) => (x === 'ARCHIVED' ? c.archived : !c.archived && (x === 'ALL' || effectiveStatus(c, now) === x));
  const shown = admin.campaigns.filter((c) => matches(c, f)).sort((a, b) => a.priority - b.priority || b.start.localeCompare(a.start));
  const counts = Object.fromEntries(FILTERS.map((x) => [x.id, admin.campaigns.filter((c) => matches(c, x.id)).length])) as Record<F, number>;
  const editing = creating ?? admin.campaigns.find((c) => c.id === openId) ?? null;

  return (
    <div>
      <PageHeader eyebrow="Growth" title="Campaigns" description="Plan seasonal pushes and featured products. Launching a campaign needs approval; nothing goes live by itself before its start date."
        actions={admin.can('campaigns.edit') && <button type="button" className="ad-btn ad-btn-primary" onClick={() => setCreating(newCampaign(now))}><Plus size={14} /> New campaign</button>} />
      <div className="ad-kpis">
        <Kpi label="Live" value={counts.LIVE} tone={counts.LIVE ? 'ok' : undefined} />
        <Kpi label="Scheduled" value={counts.SCHEDULED} />
        <Kpi label="Drafts" value={counts.DRAFT} />
        <Kpi label="Campaign views" value={admin.events.filter((e) => e.type === 'campaign_view').length} meta="All campaigns, recorded events" />
      </div>
      <Panel>
        <div className="ad-toolbar"><Chips label="Campaign status" items={FILTERS} value={f} onChange={setFilter} counts={counts} /></div>
        {shown.length === 0 ? <Empty action={admin.can('campaigns.edit') && admin.campaigns.length === 0 && <button type="button" className="ad-btn" onClick={() => setCreating(newCampaign(now))}><Plus size={13} /> Create the first campaign</button>}>{admin.campaigns.length ? 'No campaigns here.' : 'No campaigns yet.'}</Empty> : (
          <div className="ad-table-wrap"><table className="table ad-cards">
            <thead><tr><th>Campaign</th><th>Status</th><th>Runs</th><th>Audience</th><th>Featured</th><th className="num">Priority</th><th className="num">Views / clicks</th><th className="num">Featured revenue</th></tr></thead>
            <tbody>{shown.map((c) => {
              const perf = campaignPerformance(c, admin.events, orders);
              const st = effectiveStatus(c, now);
              return (
                <tr key={c.id}>
                  <td data-label="Campaign"><button type="button" className="ad-link ad-rowlink" onClick={() => setOpenId(c.id)}>{c.name || 'Untitled'}</button><span className="ad-sub">{c.description.slice(0, 70)}</span></td>
                  <td data-label="Status">{c.archived ? <Badge tone="muted">Archived</Badge> : <Badge tone={TONE[st]}>{st.charAt(0) + st.slice(1).toLowerCase()}</Badge>}</td>
                  <td data-label="Runs">{dateTime(c.start)} → {dateTime(c.end)}</td>
                  <td data-label="Audience">{AUDIENCE_LABEL[c.audience]}</td>
                  <td data-label="Featured">{c.featuredProductIds.length ? `${c.featuredProductIds.length} product${c.featuredProductIds.length === 1 ? '' : 's'}` : c.category ?? '—'}</td>
                  <td data-label="Priority" className="num">{c.priority}</td>
                  <td data-label="Views / clicks" className="num">{perf.views} / {perf.clicks}</td>
                  <td data-label="Featured revenue" className="num">{rupees(perf.featuredRevenue)}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
        <p className="ad-muted small">Views and clicks come from campaign events the storefront records. Lift (against a baseline) is left to the backend phase, when there’s enough history to compare.</p>
      </Panel>
      {editing && <CampaignEditor key={editing.id} campaign={editing} isNew={Boolean(creating)} onClose={() => { setCreating(null); setOpenId(''); }} onCreated={(id) => { setCreating(null); setOpenId(id); }} />}
    </div>
  );
}

function CampaignEditor({ campaign, isNew, onClose, onCreated }: { campaign: Campaign; isNew: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const admin = useAdmin();
  const { orders } = useStore();
  const { now } = admin;
  const { draft, patch, dirty } = useDraft<Campaign>(campaign);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const heroes = useMemo(() => registryAssets().filter((a) => a.type === 'image' && (a.role === 'hero' || a.role === 'scene' || a.role === 'lifestyle' || a.role === 'editorial')), []);
  if (!draft) return null;
  const canEdit = admin.can('campaigns.edit') && !campaign.archived;
  const st = effectiveStatus(campaign, now);
  const perf = campaignPerformance(campaign, admin.events, orders);

  const persist = (next: Campaign, action: string, success: string, extra: { reason?: string; permission?: 'campaigns.edit' | 'campaigns.publish'; before?: unknown } = {}) => admin.act({
    permission: extra.permission ?? 'campaigns.edit', action, entity: { type: 'campaign', id: next.id, label: next.name }, before: extra.before ?? (isNew ? null : { status: campaign.status, name: campaign.name }), after: { status: next.status, name: next.name, start: next.start, end: next.end }, reason: extra.reason,
    run: () => admin.saveCampaigns(admin.campaigns.some((c) => c.id === next.id) ? admin.campaigns.map((c) => (c.id === next.id ? next : c)) : [...admin.campaigns, next]), success,
  });

  const save = () => {
    const e = validateCampaign(draft);
    setErrors(e);
    if (Object.keys(e).length) return;
    const r = persist({ ...draft, updatedAt: new Date().toISOString() }, isNew ? 'campaign.created' : 'campaign.updated', isNew ? 'Campaign saved as a draft' : 'Campaign saved');
    if (r.ok && isNew) onCreated(draft.id);
  };

  const move = async (to: CampaignStatus) => {
    if (!canMove(campaign, to, now)) return;
    if (to === 'SCHEDULED') {
      const e = validateCampaign(campaign);
      if (Object.keys(e).length) { setErrors(e); admin.toast({ tone: 'error', title: 'Fix the campaign before publishing', detail: Object.values(e)[0] }); return; }
      const r = await admin.confirm({ title: `Publish “${campaign.name}”?`, impact: [`Goes live ${new Date(campaign.start) <= now ? 'immediately' : `on ${dateTime(campaign.start)}`} and ends ${dateTime(campaign.end)}.`, `Audience: ${AUDIENCE_LABEL[campaign.audience]}. Featured: ${campaign.featuredProductIds.length} product(s).`, 'Customers will see it wherever content slots are set to this campaign.'], confirmLabel: 'Approve and publish', tone: 'primary', reason: 'required' });
      if (!r.ok) return;
      const res = persist({ ...campaign, status: 'SCHEDULED', updatedAt: new Date().toISOString() }, 'campaign.published', 'Campaign published', { reason: r.reason, permission: 'campaigns.publish' });
      if (res.ok) emitDomain('campaign.published', campaign.id, { start: campaign.start, end: campaign.end });
      return;
    }
    const labels: Record<CampaignStatus, string> = { DRAFT: 'Back to draft', PAUSED: 'Paused', LIVE: 'Resumed', ENDED: 'Ended', SCHEDULED: 'Scheduled' };
    let reason = '';
    if (to === 'ENDED') { const r = await admin.confirm({ title: `End “${campaign.name}” now?`, impact: ['It stops showing immediately and can’t be restarted (duplicate it instead).'], confirmLabel: 'End campaign', tone: 'danger', reason: 'optional' }); if (!r.ok) return; reason = r.reason; }
    persist({ ...campaign, status: to, ...(to === 'ENDED' ? { end: new Date().toISOString() } : {}), updatedAt: new Date().toISOString() }, `campaign.${to.toLowerCase()}`, labels[to], { reason, permission: to === 'LIVE' ? 'campaigns.publish' : 'campaigns.edit' });
  };

  const duplicate = () => {
    const copy: Campaign = { ...campaign, id: `cmp-${Date.now().toString(36)}`, name: `${campaign.name} (copy)`, status: 'DRAFT', archived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const r = persist(copy, 'campaign.duplicated', 'Copy created as a draft', { before: { from: campaign.id } });
    if (r.ok) onCreated(copy.id);
  };
  const archive = async () => {
    const r = await admin.confirm({ title: `Archive “${campaign.name}”?`, impact: ['It stops showing and moves to Archived. Its record and history are kept.'], confirmLabel: 'Archive', tone: 'danger', reason: 'optional' });
    if (r.ok) persist({ ...campaign, archived: true, updatedAt: new Date().toISOString() }, 'campaign.archived', 'Campaign archived', { reason: r.reason });
  };

  return (
    <Drawer open onClose={onClose} wide title={isNew ? 'New campaign' : campaign.name || 'Untitled'} subtitle={!isNew && (campaign.archived ? <Badge tone="muted">Archived</Badge> : <Badge tone={TONE[st]}>{st}</Badge>)}
      footer={!campaign.archived && <>
        {!isNew && admin.can('campaigns.edit') && <button type="button" className="ad-btn ad-btn-ghost" onClick={duplicate}><Copy size={13} /> Duplicate</button>}
        {!isNew && admin.can('campaigns.edit') && <button type="button" className="ad-btn ad-btn-ghost ad-btn-quiet-danger" onClick={archive}>Archive…</button>}
        {!isNew && canMove(campaign, 'DRAFT', now) && <button type="button" className="ad-btn" onClick={() => move('DRAFT')}>Unpublish</button>}
        {!isNew && canMove(campaign, 'PAUSED', now) && <button type="button" className="ad-btn" onClick={() => move('PAUSED')}>Pause</button>}
        {!isNew && canMove(campaign, 'LIVE', now) && admin.can('campaigns.publish') && <button type="button" className="ad-btn" onClick={() => move('LIVE')}>Resume</button>}
        {!isNew && canMove(campaign, 'ENDED', now) && <button type="button" className="ad-btn" onClick={() => move('ENDED')}>End…</button>}
        {!isNew && canMove(campaign, 'SCHEDULED', now) && admin.can('campaigns.publish') && <button type="button" className="ad-btn ad-btn-primary" disabled={dirty} title={dirty ? 'Save your changes first' : undefined} onClick={() => move('SCHEDULED')}>Publish…</button>}
        {canEdit && <button type="button" className="ad-btn ad-btn-primary" disabled={!dirty && !isNew} onClick={save}>{isNew ? 'Save draft' : 'Save'}</button>}
      </>}>
      {!isNew && (
        <div className="ad-kpis">
          <Kpi label="Views" value={perf.views} /><Kpi label="Clicks" value={perf.clicks} meta={perf.ctr === null ? 'No views yet' : `${Math.round(perf.ctr * 100)}% click-through`} />
          <Kpi label="Featured product views" value={perf.featuredViews} meta="During the campaign window" /><Kpi label="Featured revenue" value={rupees(perf.featuredRevenue)} meta={`${perf.featuredUnits} units`} />
        </div>
      )}
      <fieldset disabled={!canEdit} className="ad-form-fieldset">
        <div className="ad-form">
          <Field label="Name" error={errors.name}><input value={draft.name} onChange={(e) => patch({ name: e.target.value })} aria-invalid={Boolean(errors.name)} /></Field>
          <Field label="Priority (1 = highest)" error={errors.priority}><NumberInput value={draft.priority} onChange={(v) => patch({ priority: v ?? 3 })} /></Field>
          <Field label="Description" wide><textarea rows={2} value={draft.description} onChange={(e) => patch({ description: e.target.value })} /></Field>
          <Field label="Starts" error={errors.start}><input type="datetime-local" value={toLocal(draft.start)} onChange={(e) => patch({ start: fromLocal(e.target.value) })} /></Field>
          <Field label="Ends" error={errors.end}><input type="datetime-local" value={toLocal(draft.end)} onChange={(e) => patch({ end: fromLocal(e.target.value) })} /></Field>
          <Field label="Audience"><select value={draft.audience} onChange={(e) => patch({ audience: e.target.value as Audience })}>{(Object.keys(AUDIENCE_LABEL) as Audience[]).map((a) => <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>)}</select></Field>
          <Field label="Category"><select value={draft.category ?? ''} onChange={(e) => patch({ category: e.target.value || null })}><option value="">None</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Hero image"><select value={draft.heroMediaId ?? ''} onChange={(e) => patch({ heroMediaId: e.target.value || null })}><option value="">None</option>{heroes.map((h) => <option key={h.id} value={h.id}>{h.id}</option>)}</select></Field>
          <Field label="Button label" error={errors.cta}><input value={draft.cta.label} onChange={(e) => patch({ cta: { ...draft.cta, label: e.target.value } })} /></Field>
          <Field label="Button link (a page on this site)" wide hint="Starts with /, e.g. /shop or /customize."><input value={draft.cta.href} onChange={(e) => patch({ cta: { ...draft.cta, href: e.target.value } })} /></Field>
          <fieldset className="ad-fieldset"><legend>Featured products</legend>
            <div className="ad-months">{admin.catalog.filter((p) => p.status === 'ACTIVE').map((p) => <label key={p.id}><input type="checkbox" checked={draft.featuredProductIds.includes(p.id)} onChange={(e) => patch({ featuredProductIds: e.target.checked ? [...draft.featuredProductIds, p.id] : draft.featuredProductIds.filter((x) => x !== p.id) })} />{p.name}</label>)}</div>
          </fieldset>
        </div>
      </fieldset>
    </Drawer>
  );
}
