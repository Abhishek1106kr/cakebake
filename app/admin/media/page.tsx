'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Film, ImageOff } from 'lucide-react';
import { useAdmin } from '@/components/admin/admin-provider';
import { Badge, Chips, Drawer, Empty, Guard, PageHeader, Panel, SearchField, useUrlParam } from '@/components/admin/ui';
import { aspectLabel, libraryEntries, registryAssets, usageOf, type MediaEntry, type MediaOverlay, type MediaType } from '@/lib/admin/media-library';
import { MEDIA_ROLES, type MediaRole } from '@/lib/admin/catalog';

type TF = 'ALL' | MediaType | 'ARCHIVED' | 'UNUSED';
const FILTERS: { id: TF; label: string }[] = [{ id: 'ALL', label: 'All' }, { id: 'image', label: 'Images' }, { id: 'video', label: 'Videos' }, { id: 'poster', label: 'Posters' }, { id: 'UNUSED', label: 'Not used by a product' }, { id: 'ARCHIVED', label: 'Archived' }];

export default function MediaPage() {
  return <Guard permission="media.view"><Media /></Guard>;
}

function Thumb({ entry }: { entry: MediaEntry }) {
  const [failed, setFailed] = useState(false);
  if (!entry.desktop || entry.desktop.startsWith('none') || failed) return <span className="ad-thumb ad-thumb-missing"><ImageOff size={18} aria-hidden /><small>No file here</small></span>;
  if (entry.type === 'video') return <span className="ad-thumb ad-thumb-video"><Film size={18} aria-hidden /><small>Video</small></span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="ad-thumb" src={entry.desktop} alt={entry.alt} loading="lazy" onError={() => setFailed(true)} />;
}

function Media() {
  const admin = useAdmin();
  const [filter, setFilter] = useUrlParam('type', 'ALL');
  const [query, setQuery] = useUrlParam('q', '');
  const [openId, setOpenId] = useUrlParam('m', '');
  const f = (FILTERS.some((x) => x.id === filter) ? filter : 'ALL') as TF;
  const assets = useMemo(() => registryAssets(), []);
  const entries = useMemo(() => libraryEntries(assets, admin.mediaOverlay, admin.catalog), [assets, admin.mediaOverlay, admin.catalog]);
  const matches = (e: MediaEntry, x: TF) => (x === 'ARCHIVED' ? e.status === 'ARCHIVED' : e.status !== 'ARCHIVED' && (x === 'ALL' || (x === 'UNUSED' ? !e.productId : e.type === x)));
  const q = query.trim().toLowerCase();
  const shown = entries.filter((e) => matches(e, f) && (!q || `${e.id} ${e.alt} ${e.role}`.toLowerCase().includes(q)));
  const counts = Object.fromEntries(FILTERS.map((x) => [x.id, entries.filter((e) => matches(e, x.id)).length])) as Record<TF, number>;
  const open = entries.find((e) => e.id === openId);

  return (
    <div>
      <PageHeader eyebrow="Growth" title="Media" description="Every image and video the site’s asset registries know, with where it’s used and where it came from. Paths live in the registries; products and campaigns refer to assets by id." />
      <div className="ad-callout"><AlertTriangle size={15} aria-hidden /><span><strong>No asset here is cleared for publication.</strong> They are reference images the owner supplied (rights unknown), kept local and never committed or deployed. Licensed Tresor photography replaces each under the same id, with no code changes.</span></div>
      <Panel>
        <div className="ad-toolbar"><Chips label="Media type" items={FILTERS} value={f} onChange={setFilter} counts={counts} /><SearchField value={query} onChange={setQuery} placeholder="Id, alt text or role" label="Search media" /></div>
        {shown.length === 0 ? <Empty>No assets match.</Empty> : (
          <ul className="ad-media-grid">{shown.map((e) => (
            <li key={e.id}><button type="button" onClick={() => setOpenId(e.id)} aria-label={`${e.id}: ${e.alt}`}>
              <Thumb entry={e} />
              <span className="ad-media-meta"><strong className="ad-mono">{e.id}</strong><small>{e.type} · {e.role} · {aspectLabel(e.aspect)}{e.productId ? ` · ${admin.catalog.find((p) => p.id === e.productId)?.name ?? e.productId}` : ''}</small></span>
              {e.status === 'ARCHIVED' && <Badge tone="muted">Archived</Badge>}
            </button></li>
          ))}</ul>
        )}
      </Panel>
      {open && <MediaDrawer entry={open} onClose={() => setOpenId('')} all={entries} />}
    </div>
  );
}

function MediaDrawer({ entry, onClose, all }: { entry: MediaEntry; onClose: () => void; all: MediaEntry[] }) {
  const admin = useAdmin();
  const canEdit = admin.can('media.edit');
  const usage = usageOf(entry, admin.catalog, admin.campaigns, admin.slots, admin.now);
  const [alt, setAlt] = useState(entry.alt);
  const [assignTo, setAssignTo] = useState('');
  const [role, setRole] = useState<MediaRole>(entry.type === 'video' ? 'video' : entry.type === 'poster' ? 'poster' : 'product');
  const [replacement, setReplacement] = useState(entry.replacedBy ?? '');

  const overlay = (patch: MediaOverlay, action: string, success: string, reason?: string) => admin.act({
    permission: 'media.edit', action, entity: { type: 'media', id: entry.id }, before: admin.mediaOverlay[entry.id] ?? null, after: { ...admin.mediaOverlay[entry.id], ...patch }, reason,
    run: () => admin.saveMediaOverlay({ ...admin.mediaOverlay, [entry.id]: { ...admin.mediaOverlay[entry.id], ...patch } }), success,
  });

  const assign = () => {
    const product = admin.catalog.find((p) => p.id === assignTo);
    if (!product) return;
    admin.act({ permission: 'products.edit', action: 'media.assigned', entity: { type: 'product', id: product.id, label: product.name }, before: { [role]: product.media[role] ?? null }, after: { [role]: entry.id },
      run: () => admin.saveProduct({ ...product, media: { ...product.media, [role]: entry.id }, updatedAt: new Date().toISOString() }), success: `Assigned as ${product.name}’s ${role} image` });
  };

  const archive = async () => {
    const active = usage.filter((u) => u.active);
    const r = await admin.confirm({ title: `Archive ${entry.id}?`, impact: active.length ? [`Still used in ${active.length} active place${active.length === 1 ? '' : 's'}: ${active.map((u) => u.where).slice(0, 4).join('; ')}.`, 'Those places keep showing it until you assign a replacement. Archiving only hides it from pickers.'] : ['Not used by any active product, campaign or content slot.', 'It stays in the registry and can be restored.'], confirmLabel: 'Archive', tone: active.length ? 'danger' : 'primary', reason: active.length ? 'required' : 'optional' });
    if (r.ok) overlay({ status: 'ARCHIVED' }, 'media.archived', 'Archived', r.reason);
  };

  return (
    <Drawer open onClose={onClose} wide title={entry.id} subtitle={<><Badge tone={entry.status === 'ARCHIVED' ? 'muted' : 'ok'}>{entry.status === 'ARCHIVED' ? 'Archived' : 'Active'}</Badge><Badge tone="warn">Not licensed</Badge></>}
      footer={canEdit && (entry.status === 'ARCHIVED' ? <button type="button" className="ad-btn" onClick={() => overlay({ status: 'ACTIVE' }, 'media.restored', 'Restored')}>Restore</button> : <button type="button" className="ad-btn ad-btn-quiet-danger" onClick={archive}>Archive…</button>)}>
      <div className="ad-media-preview"><Thumb entry={entry} /></div>
      <dl className="ad-dl">
        <dt>Type</dt><dd>{entry.type}</dd>
        <dt>Role</dt><dd>{entry.role}</dd>
        <dt>Aspect ratio</dt><dd>{entry.aspect} ({aspectLabel(entry.aspect)})</dd>
        <dt>Desktop variant</dt><dd className="ad-mono">{entry.desktop || '—'}</dd>
        <dt>Mobile variant</dt><dd className="ad-mono">{entry.mobile ?? 'Same as desktop'}</dd>
        <dt>Product</dt><dd>{entry.productId ? admin.catalog.find((p) => p.id === entry.productId)?.name ?? entry.productId : '—'}</dd>
        <dt>Campaign</dt><dd>{admin.campaigns.find((c) => c.heroMediaId === entry.id)?.name ?? '—'}</dd>
        <dt>Source</dt><dd className="ad-mono">{entry.source}</dd>
        <dt>Provenance</dt><dd>{entry.provenance}</dd>
        {entry.replacedBy && <><dt>Replacement</dt><dd className="ad-mono">{entry.replacedBy}</dd></>}
      </dl>
      <h3 className="ad-section-title">Used in</h3>
      <ul className="ad-lines">{usage.map((u) => <li key={u.where}><span>{u.where}</span>{u.active ? <Badge tone="ok">Active</Badge> : <Badge tone="muted">Inactive</Badge>}</li>)}</ul>
      {canEdit && <>
        <h3 className="ad-section-title">Alt text</h3>
        <div className="ad-row"><input className="ad-input" value={alt} onChange={(e) => setAlt(e.target.value)} aria-label="Alt text" maxLength={200} /><button type="button" className="ad-btn ad-btn-sm" disabled={alt === entry.alt || alt.trim().length < 5} onClick={() => overlay({ alt: alt.trim() }, 'media.alt.changed', 'Alt text saved')}>Save</button></div>
        <h3 className="ad-section-title">Assign to a product</h3>
        <div className="ad-row">
          <select className="ad-select" value={assignTo} onChange={(e) => setAssignTo(e.target.value)} aria-label="Product"><option value="">Choose a product…</option>{admin.catalog.filter((p) => p.status !== 'ARCHIVED').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <select className="ad-select" value={role} onChange={(e) => setRole(e.target.value as MediaRole)} aria-label="Role">{MEDIA_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
          <button type="button" className="ad-btn ad-btn-sm" disabled={!assignTo} onClick={assign}>Assign</button>
        </div>
        <h3 className="ad-section-title">Replace</h3>
        <p className="ad-muted small">Records which asset should take this one’s place. The storefront follows the registry, so the swap is applied when the asset files are updated under the same id.</p>
        <div className="ad-row">
          <select className="ad-select" value={replacement} onChange={(e) => setReplacement(e.target.value)} aria-label="Replacement asset"><option value="">No replacement</option>{all.filter((a) => a.id !== entry.id && a.type === entry.type && a.status === 'ACTIVE').map((a) => <option key={a.id} value={a.id}>{a.id}</option>)}</select>
          <button type="button" className="ad-btn ad-btn-sm" disabled={replacement === (entry.replacedBy ?? '')} onClick={() => overlay({ replacedBy: replacement || null }, 'media.replacement.set', replacement ? 'Replacement recorded' : 'Replacement cleared')}>Save</button>
        </div>
      </>}
    </Drawer>
  );
}
