'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { useAdmin } from '@/components/admin/admin-provider';
import { Toggle } from '@/components/admin/forms';
import { Badge, Empty, Field, Guard, PageHeader, Panel, dateTime } from '@/components/admin/ui';
import { SLOT_INFO, SLOT_MODE_LABEL, effectiveStatus, liveAnnouncement, validateAnnouncement, type Announcement, type ContentSlot, type SlotMode } from '@/lib/admin/marketing';
import { buildContext, orderShowcase, unitsSold } from '@/engine/intelligence';
import { storefrontProducts } from '@/lib/admin/catalog';
import { availableUnits } from '@/lib/inventory';

const toLocal = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : '');
const WIRED: Partial<Record<string, string>> = { announcement: 'Live: the shop shows the active announcement above the header.' };

export default function ContentPage() {
  return <Guard permission="content.view"><Content /></Guard>;
}

function Content() {
  const admin = useAdmin();
  const { inventory, orders } = useStore();
  const { now } = admin;
  const canEdit = admin.can('content.edit');
  const shop = useMemo(() => storefrontProducts(admin.catalog), [admin.catalog]);
  // What the intelligence engine would choose right now (same function the shop's menu uses).
  const picks = useMemo(() => orderShowcase(buildContext({ at: now }), { products: shop, availability: (p) => (p.available === false ? 0 : availableUnits(inventory, [], p.id, 'Regular')), popularity: unitsSold(orders) }).result, [shop, inventory, orders, now]);

  const saveSlot = (slot: ContentSlot, before: ContentSlot) => admin.act({
    permission: 'content.edit', action: 'content.slot.changed', entity: { type: 'content', id: slot.id, label: SLOT_INFO[slot.id].title }, before: { mode: before.mode, productIds: before.productIds, campaignId: before.campaignId }, after: { mode: slot.mode, productIds: slot.productIds, campaignId: slot.campaignId },
    run: () => admin.saveSlots(admin.slots.map((s) => (s.id === slot.id ? { ...slot, updatedAt: new Date().toISOString() } : s))), success: `${SLOT_INFO[slot.id].title} updated`,
  });

  return (
    <div>
      <PageHeader eyebrow="Growth" title="Content" description="Where the storefront gets each piece of content: as designed in code, a manual pick, the intelligence engine, or a campaign. Announcements go live on the shop immediately." />
      <Announcements />
      <Panel title="Content slots">
        <p className="ad-muted small" style={{ marginTop: -4 }}>Slot choices are saved and resolvable now. The cinematic home and Our Story still render their designed content: wiring each slot into those scenes is the next step, so a change here doesn’t move the designed pages yet. The announcement bar is live.</p>
        <div className="ad-table-wrap"><table className="table ad-cards">
          <thead><tr><th>Slot</th><th>Where</th><th>Source</th><th>Selection</th><th>Updated</th></tr></thead>
          <tbody>{admin.slots.map((slot) => {
            const info = SLOT_INFO[slot.id];
            return (
              <tr key={slot.id}>
                <td data-label="Slot"><strong>{info.title}</strong></td>
                <td data-label="Where">{info.where}</td>
                <td data-label="Source"><select className="ad-select" value={slot.mode} disabled={!canEdit || info.modes.length === 1} onChange={(e) => saveSlot({ ...slot, mode: e.target.value as SlotMode }, slot)} aria-label={`Source for ${info.title}`}>{info.modes.map((m) => <option key={m} value={m}>{SLOT_MODE_LABEL[m]}</option>)}</select></td>
                <td data-label="Selection">
                  {slot.mode === 'code' && <span className="ad-muted">The designed content</span>}
                  {slot.mode === 'intelligence' && <span>{picks.slice(0, 4).map((p) => p.product.name).join(', ')}<span className="ad-sub">{picks[0]?.reason ?? 'Ranked by time of day, season, stock and popularity'}</span></span>}
                  {slot.mode === 'manual' && <ProductPicker value={slot.productIds} disabled={!canEdit} onChange={(ids) => saveSlot({ ...slot, productIds: ids }, slot)} />}
                  {slot.mode === 'campaign' && <select className="ad-select" value={slot.campaignId ?? ''} disabled={!canEdit} onChange={(e) => saveSlot({ ...slot, campaignId: e.target.value || null }, slot)} aria-label="Campaign"><option value="">Choose a campaign…</option>{admin.campaigns.filter((c) => !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name} · {effectiveStatus(c, now).toLowerCase()}</option>)}</select>}
                </td>
                <td data-label="Updated">{slot.updatedAt ? dateTime(slot.updatedAt) : <span className="ad-muted">Never</span>}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      </Panel>
    </div>
  );
}

function ProductPicker({ value, onChange, disabled }: { value: string[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  const admin = useAdmin();
  const [open, setOpen] = useState(false);
  const names = value.map((id) => admin.catalog.find((p) => p.id === id)?.name ?? id);
  return (
    <div>
      <button type="button" className="ad-link" onClick={() => setOpen((o) => !o)} disabled={disabled}>{names.length ? names.join(', ') : 'Choose products…'}</button>
      {open && <div className="ad-months" style={{ marginTop: 6 }}>{admin.catalog.filter((p) => p.status === 'ACTIVE').map((p) => <label key={p.id}><input type="checkbox" checked={value.includes(p.id)} onChange={(e) => onChange(e.target.checked ? [...value, p.id] : value.filter((x) => x !== p.id))} />{p.name}</label>)}</div>}
    </div>
  );
}

function Announcements() {
  const admin = useAdmin();
  const { now } = admin;
  const canEdit = admin.can('content.edit');
  const blank = (): Announcement => ({ id: `ann-${Date.now().toString(36)}`, text: '', href: '', start: now.toISOString(), end: new Date(now.getTime() + 3 * 86400000).toISOString(), active: false, updatedAt: now.toISOString() });
  const [draft, setDraft] = useState<Announcement | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const live = liveAnnouncement(admin.announcements, now);

  const save = async (a: Announcement, publishing: boolean) => {
    const e = validateAnnouncement(a);
    setErrors(e);
    if (Object.keys(e).length) return;
    if (publishing) {
      const r = await admin.confirm({ title: 'Show this announcement on the shop?', body: <>“{a.text}”</>, impact: [`Visible to every customer from ${dateTime(a.start)} to ${dateTime(a.end)}.`, live && live.id !== a.id ? `Replaces the current one: “${live.text}”.` : 'Appears above the shop header.'], confirmLabel: 'Publish', tone: 'primary', reason: 'optional' });
      if (!r.ok) return;
    }
    const next = { ...a, updatedAt: new Date().toISOString() };
    const exists = admin.announcements.some((x) => x.id === a.id);
    const res = admin.act({
      permission: 'content.edit', action: publishing ? 'content.announcement.published' : a.active ? 'content.announcement.updated' : 'content.announcement.saved', entity: { type: 'content', id: a.id, label: a.text.slice(0, 40) },
      before: exists ? admin.announcements.find((x) => x.id === a.id) : null, after: next,
      run: () => admin.saveAnnouncements(exists ? admin.announcements.map((x) => (x.id === a.id ? next : x)) : [...admin.announcements, next]), success: publishing ? 'Announcement published' : 'Announcement saved',
    });
    if (res.ok) setDraft(null);
  };
  const unpublish = (a: Announcement) => admin.act({ permission: 'content.edit', action: 'content.announcement.unpublished', entity: { type: 'content', id: a.id, label: a.text.slice(0, 40) }, before: { active: true }, after: { active: false }, run: () => admin.saveAnnouncements(admin.announcements.map((x) => (x.id === a.id ? { ...x, active: false, updatedAt: new Date().toISOString() } : x))), success: 'Announcement taken down' });

  return (
    <Panel title="Announcements" actions={canEdit && !draft && <button type="button" className="ad-btn ad-btn-sm ad-btn-primary" onClick={() => setDraft(blank())}><Plus size={13} /> New announcement</button>}>
      <p className="ad-muted small" style={{ marginTop: -4 }}>{WIRED.announcement}</p>
      {draft && (
        <div className="ad-movement">
          <div className="ad-form">
            <Field label={`Text (${draft.text.length}/120)`} error={errors.text} wide><input value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} placeholder="e.g. Closed on 1 November for Diwali. Pre-order cakes by 30 October." /></Field>
            <Field label="Link (optional, a page on this site)" error={errors.href}><input value={draft.href} onChange={(e) => setDraft({ ...draft, href: e.target.value })} placeholder="/customize" /></Field>
            <div className="ad-field"><span>Visibility</span><Toggle checked={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} label="Show on the shop" /></div>
            <Field label="From"><input type="datetime-local" value={toLocal(draft.start)} onChange={(e) => setDraft({ ...draft, start: fromLocal(e.target.value) })} /></Field>
            <Field label="Until" error={errors.end}><input type="datetime-local" value={toLocal(draft.end)} onChange={(e) => setDraft({ ...draft, end: fromLocal(e.target.value) })} /></Field>
          </div>
          <div className="ad-row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setDraft(null)}>Cancel</button>
            <button type="button" className="ad-btn ad-btn-primary" onClick={() => save(draft, draft.active)}>{draft.active ? 'Publish…' : 'Save'}</button>
          </div>
        </div>
      )}
      {admin.announcements.length === 0 && !draft ? <Empty>No announcements.</Empty> : (
        <ul className="ad-lines">{[...admin.announcements].reverse().map((a) => {
          const isLive = live?.id === a.id;
          return (
            <li key={a.id}>
              <span><strong>{a.text}</strong><span className="ad-sub">{dateTime(a.start)} → {dateTime(a.end)}{a.href && ` · links to ${a.href}`}</span></span>
              <span className="ad-row">{isLive ? <Badge tone="ok">Live</Badge> : a.active ? <Badge tone="info">{Date.parse(a.start) > now.getTime() ? 'Scheduled' : 'Ended'}</Badge> : <Badge tone="muted">Off</Badge>}
                {canEdit && <button type="button" className="ad-btn ad-btn-sm" onClick={() => setDraft(a)}>Edit</button>}
                {canEdit && a.active && <button type="button" className="ad-btn ad-btn-sm ad-btn-ghost" onClick={() => unpublish(a)}>Take down</button>}</span>
            </li>
          );
        })}</ul>
      )}
    </Panel>
  );
}
