'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Copy, Plus } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { useAdmin } from '@/components/admin/admin-provider';
import { ListInput, NumberInput, Toggle, useDraft } from '@/components/admin/forms';
import { Badge, Chips, Drawer, Empty, Field, Guard, PageHeader, Pager, Panel, SearchField, rupees, useUrlParam } from '@/components/admin/ui';
import { CATEGORIES, MEDIA_ROLES, duplicateProduct, newProduct, ordersReferencing, productsCsvRows, validateProduct, type MediaRole, type ProductRecord, type ProductStatus, type StockPolicy } from '@/lib/admin/catalog';
import { registryAssets } from '@/lib/admin/media-library';
import { paginate } from '@/lib/admin/order-ops';
import { toCsv, downloadText, stamp } from '@/lib/admin/csv';
import { diff } from '@/lib/admin/audit';
import { availableUnits } from '@/lib/inventory';

type StatusFilter = 'ALL' | ProductStatus | 'SOLD_OUT';
const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'ACTIVE', label: 'Active' }, { id: 'SOLD_OUT', label: 'Sold out' }, { id: 'INACTIVE', label: 'Disabled' }, { id: 'ARCHIVED', label: 'Archived' }, { id: 'ALL', label: 'All' },
];
const STATUS_TONE: Record<ProductStatus, 'ok' | 'muted' | 'neutral'> = { ACTIVE: 'ok', INACTIVE: 'neutral', ARCHIVED: 'muted' };
const STATUS_LABEL: Record<ProductStatus, string> = { ACTIVE: 'Active', INACTIVE: 'Disabled', ARCHIVED: 'Archived' };

export default function ProductsPage() {
  return <Guard permission="products.view"><Products /></Guard>;
}

function Products() {
  const { orders, inventory } = useStore();
  const admin = useAdmin();
  const [filter, setFilter] = useUrlParam('status', 'ACTIVE');
  const [category, setCategory] = useUrlParam('category', '');
  const [query, setQuery] = useUrlParam('q', '');
  const [openId, setOpenId] = useUrlParam('p', '');
  const [creating, setCreating] = useState<ProductRecord | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const f = (STATUS_FILTERS.some((x) => x.id === filter) ? filter : 'ACTIVE') as StatusFilter;

  const week = Date.now() - 7 * 86400000;
  const sold = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders) if (o.status !== 'CANCELLED' && Date.parse(o.createdAt) >= week) for (const l of o.items) m.set(l.product.id, (m.get(l.product.id) ?? 0) + l.qty);
    return m;
  }, [orders, week]);
  const views = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of admin.events) if (e.type === 'product_view') m.set(String(e.payload.productId), (m.get(String(e.payload.productId)) ?? 0) + 1);
    return m;
  }, [admin.events]);

  const matches = (r: ProductRecord, sf: StatusFilter) => sf === 'ALL' || (sf === 'SOLD_OUT' ? r.status === 'ACTIVE' && !r.available : r.status === sf);
  const shown = admin.catalog.filter((r) => matches(r, f) && (!category || r.category === category) && (!query || `${r.name} ${r.id} ${r.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())));
  const counts = Object.fromEntries(STATUS_FILTERS.map((x) => [x.id, admin.catalog.filter((r) => matches(r, x.id)).length])) as Record<StatusFilter, number>;
  const paged = paginate(shown, page, 30);
  useEffect(() => { setPage(1); }, [f, category, query]);
  const editing = creating ?? admin.catalog.find((r) => r.id === openId) ?? null;

  const bulkSet = async (patch: Partial<ProductRecord>, label: string, permission: 'products.edit') => {
    const list = admin.catalog.filter((r) => selected.has(r.id));
    if (!list.length) return;
    const r = await admin.confirm({ title: `${label} ${list.length} product${list.length === 1 ? '' : 's'}?`, impact: [list.map((x) => x.name).slice(0, 8).join(', ') + (list.length > 8 ? '…' : ''), patch.status === 'ARCHIVED' ? 'Archived products leave the shop; past orders keep their own copy.' : 'The shop updates immediately in every open tab.'], confirmLabel: label, tone: patch.status === 'ARCHIVED' ? 'danger' : 'primary', reason: patch.status === 'ARCHIVED' ? 'required' : 'optional' });
    if (!r.ok) return;
    for (const p of list) {
      admin.act({ permission, action: 'product.bulk.updated', entity: { type: 'product', id: p.id, label: p.name }, before: Object.fromEntries(Object.keys(patch).map((k) => [k, p[k as keyof ProductRecord]])), after: patch, reason: r.reason, source: 'bulk', quiet: true,
        run: () => admin.saveProduct({ ...p, ...patch, updatedAt: new Date().toISOString() }) });
    }
    admin.toast({ tone: 'success', title: `${label}: ${list.length} product${list.length === 1 ? '' : 's'}` });
    setSelected(new Set());
  };

  return (
    <div>
      <PageHeader eyebrow="Catalogue" title="Products" description="What the shop sells. Changes reach the shop immediately; orders already placed keep the name and price they were sold at."
        actions={<>
          <button type="button" className="ad-btn" onClick={() => downloadText(`tresor-products-${stamp()}.csv`, toCsv(productsCsvRows(shown)))}>Export ({shown.length}) <ArrowUpRight size={14} /></button>
          {admin.can('products.edit') && <button type="button" className="ad-btn ad-btn-primary" onClick={() => setCreating(newProduct(admin.catalog))}><Plus size={14} /> New product</button>}
        </>} />
      <Panel>
        <div className="ad-toolbar"><Chips label="Product status" items={STATUS_FILTERS} value={f} onChange={setFilter} counts={counts} /></div>
        <div className="ad-toolbar">
          <select className="ad-select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category"><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          <SearchField value={query} onChange={setQuery} placeholder="Name, id or tag" label="Search products" />
        </div>
        {selected.size > 0 && admin.can('products.edit') && (
          <div className="ad-bulkbar" role="region" aria-label="Bulk actions">
            <strong>{selected.size} selected</strong>
            <button type="button" className="ad-btn ad-btn-sm" onClick={() => bulkSet({ available: true }, 'Mark available', 'products.edit')}>Mark available</button>
            <button type="button" className="ad-btn ad-btn-sm" onClick={() => bulkSet({ available: false }, 'Mark sold out', 'products.edit')}>Mark sold out</button>
            <button type="button" className="ad-btn ad-btn-sm" onClick={() => bulkSet({ status: 'ARCHIVED' }, 'Archive', 'products.edit')}>Archive</button>
            <button type="button" className="ad-btn ad-btn-sm" onClick={() => downloadText(`tresor-products-selected-${stamp()}.csv`, toCsv(productsCsvRows(admin.catalog.filter((r) => selected.has(r.id)))))}>Export</button>
            <button type="button" className="ad-btn ad-btn-sm ad-btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}
        {shown.length === 0 ? <Empty>No products match.</Empty> : (
          <div className="ad-table-wrap">
            <table className="table ad-cards">
              <thead><tr><th /><th>Product</th><th>Category</th><th className="num">Price</th><th>Status</th><th>Availability</th><th className="num">Sold (7 d)</th><th className="num">Views</th><th>Prep</th><th /></tr></thead>
              <tbody>
                {paged.items.map((r) => {
                  const canMake = r.stockPolicy === 'ingredients' ? availableUnits(inventory, [], r.id, 'Regular') : null;
                  return (
                    <tr key={r.id} className={selected.has(r.id) ? 'is-selected' : ''}>
                      <td data-label=""><input type="checkbox" className="ad-check" checked={selected.has(r.id)} onChange={() => setSelected((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} aria-label={`Select ${r.name}`} /></td>
                      <td data-label="Product"><button type="button" className="ad-link ad-rowlink" onClick={() => setOpenId(r.id)}>{r.name || 'Untitled product'}</button><span className="ad-sub ad-mono">{r.id}</span></td>
                      <td data-label="Category">{r.category}</td>
                      <td data-label="Price" className="num">{rupees(r.price)}{r.compareAtPrice && <span className="ad-sub"><s>{rupees(r.compareAtPrice)}</s></span>}</td>
                      <td data-label="Status"><Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge></td>
                      <td data-label="Availability">{!r.available ? <Badge tone="warn">Sold out (manual)</Badge> : canMake === null ? <span className="ad-muted">{r.stockPolicy === 'made-to-order' ? 'Made to order' : 'No stock limit'}</span> : canMake === 0 ? <Badge tone="bad">Out of ingredients</Badge> : canMake <= 5 ? <Badge tone="warn">Only {canMake}</Badge> : <Badge tone="ok">{canMake >= 99 ? 'Plenty' : `${canMake} can be made`}</Badge>}</td>
                      <td data-label="Sold (7 d)" className="num">{sold.get(r.id) ?? 0}</td>
                      <td data-label="Views" className="num">{views.get(r.id) ?? 0}</td>
                      <td data-label="Prep">{r.prepMinutes >= 60 ? `${Math.round(r.prepMinutes / 60)} h` : `${r.prepMinutes} min`}</td>
                      <td data-label="" className="cell-actions"><button type="button" className="ad-btn ad-btn-sm" onClick={() => setOpenId(r.id)}>Edit</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={paged.page} pages={paged.pages} total={paged.total} onPage={setPage} label="products" />
      </Panel>
      {editing && <ProductEditor key={editing.id} record={editing} isNew={Boolean(creating)} usage={ordersReferencing(editing.id, orders)} onClose={() => { setCreating(null); setOpenId(''); }} onCreated={(id) => { setCreating(null); setOpenId(id); }} />}
    </div>
  );
}

function ProductEditor({ record, isNew, usage, onClose, onCreated }: { record: ProductRecord; isNew: boolean; usage: number; onClose: () => void; onCreated: (id: string) => void }) {
  const admin = useAdmin();
  const { draft, patch, dirty } = useDraft<ProductRecord>(record);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const media = useMemo(() => registryAssets(), []);
  const canEdit = admin.can('products.edit');
  if (!draft) return null;
  const set = <K extends keyof ProductRecord>(k: K) => (v: ProductRecord[K]) => patch({ [k]: v } as Partial<ProductRecord>);

  const save = async (next: ProductRecord = draft, label = 'Saved') => {
    const all = isNew ? [...admin.catalog, next] : admin.catalog.map((r) => (r.id === next.id ? next : r));
    const v = validateProduct(next, all);
    if (!v.ok) { setErrors(v.errors); admin.toast({ tone: 'error', title: 'Check the highlighted fields', detail: Object.values(v.errors)[0] }); return; }
    setErrors({});
    const priceChanged = !isNew && (next.price !== record.price || next.compareAtPrice !== record.compareAtPrice);
    let reason = '';
    if (priceChanged) {
      if (!admin.can('products.price')) { admin.toast({ tone: 'error', title: 'Price changes need approval', detail: 'Your role can edit products but not prices. Ask an owner or admin.' }); return; }
      const r = await admin.confirm({ title: `Change ${next.name}’s price?`, impact: [`${rupees(record.price)} → ${rupees(next.price)} for new bags from now on.`, `${usage} past order${usage === 1 ? '' : 's'} keep the price they were sold at.`, 'Carts already holding it are re-priced when the customer next loads the shop.'], confirmLabel: 'Change price', tone: 'primary', reason: 'required' });
      if (!r.ok) return;
      reason = r.reason;
    }
    const stamped = { ...next, id: isNew ? next.slug : next.id, updatedAt: new Date().toISOString() };
    const changes = diff(record, stamped).filter((c) => c.field !== 'updatedAt');
    const res = admin.act({
      permission: priceChanged ? 'products.price' : 'products.edit', action: isNew ? 'product.created' : priceChanged ? 'product.price.changed' : 'product.updated',
      entity: { type: 'product', id: stamped.id, label: stamped.name }, before: isNew ? null : Object.fromEntries(changes.map((c) => [c.field, c.before])), after: Object.fromEntries(changes.map((c) => [c.field, c.after])), reason,
      run: () => admin.saveProduct(stamped), success: isNew ? `${stamped.name} created (disabled until you activate it)` : label,
    });
    if (res.ok && isNew) onCreated(stamped.id);
  };

  const setStatus = async (status: ProductStatus) => {
    if (status === 'ARCHIVED') {
      const r = await admin.confirm({ title: `Archive ${draft.name}?`, impact: ['It leaves the shop and search immediately.', `${usage} past order${usage === 1 ? '' : 's'} reference it; they keep their own copy and stay intact.`, 'Nothing is deleted: you can restore it later.'], confirmLabel: 'Archive product', tone: 'danger', reason: 'required' });
      if (!r.ok) return;
      admin.act({ permission: 'products.edit', action: 'product.archived', entity: { type: 'product', id: draft.id, label: draft.name }, before: { status: record.status }, after: { status }, reason: r.reason, run: () => admin.saveProduct({ ...record, status, updatedAt: new Date().toISOString() }), success: `${draft.name} archived` });
      return;
    }
    admin.act({ permission: 'products.edit', action: status === 'ACTIVE' ? 'product.enabled' : 'product.disabled', entity: { type: 'product', id: draft.id, label: draft.name }, before: { status: record.status }, after: { status }, run: () => admin.saveProduct({ ...record, status, updatedAt: new Date().toISOString() }), success: status === 'ACTIVE' ? `${draft.name} is live in the shop` : `${draft.name} disabled` });
  };

  const duplicate = () => {
    const copy = duplicateProduct(record, admin.catalog);
    admin.act({ permission: 'products.edit', action: 'product.duplicated', entity: { type: 'product', id: copy.id, label: copy.name }, before: { from: record.id }, after: { id: copy.id }, run: () => admin.saveProduct(copy), success: `Copy created: ${copy.name} (disabled)` });
    onCreated(copy.id);
  };

  return (
    <Drawer open onClose={onClose} wide title={isNew ? 'New product' : draft.name || 'Untitled'}
      subtitle={!isNew && <><Badge tone={STATUS_TONE[record.status]}>{STATUS_LABEL[record.status]}</Badge><span>{usage} order{usage === 1 ? '' : 's'} reference it</span>{record.status === 'ACTIVE' && <Link className="ad-link" href={`/shop/${record.id}` as Route} target="_blank">View in shop</Link>}</>}
      footer={canEdit && <>
        {!isNew && <button type="button" className="ad-btn ad-btn-ghost" onClick={duplicate}><Copy size={13} /> Duplicate</button>}
        {!isNew && record.status !== 'ARCHIVED' && <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setStatus(record.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}>{record.status === 'ACTIVE' ? 'Disable' : 'Activate'}</button>}
        {!isNew && (record.status === 'ARCHIVED' ? <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setStatus('INACTIVE')}>Restore</button> : <button type="button" className="ad-btn ad-btn-ghost ad-btn-quiet-danger" onClick={() => setStatus('ARCHIVED')}>Archive…</button>)}
        <button type="button" className="ad-btn ad-btn-primary" disabled={!dirty && !isNew} onClick={() => save()}>{isNew ? 'Create product' : 'Save changes'}</button>
      </>}>
      <fieldset disabled={!canEdit} className="ad-form-fieldset">
        <div className="ad-section-title">Basics</div>
        <div className="ad-form">
          <Field label="Name" error={errors.name}><input value={draft.name} onChange={(e) => patch({ name: e.target.value, ...(isNew ? { slug: e.target.value.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-') } : {}) })} aria-invalid={Boolean(errors.name)} /></Field>
          <Field label="Slug (URL)" error={errors.slug} hint={isNew ? 'Becomes the product id. Can’t change after creation.' : 'Fixed: orders and links use it.'}><input value={draft.slug} disabled={!isNew} onChange={(e) => set('slug')(e.target.value)} aria-invalid={Boolean(errors.slug)} /></Field>
          <Field label="Category" error={errors.category}><select value={draft.category} onChange={(e) => set('category')(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Tags" hint="First tag shows on the card (e.g. Bestseller)."><ListInput value={draft.tags} onChange={set('tags')} /></Field>
          <Field label="Description" error={errors.description} wide><textarea rows={2} value={draft.description} onChange={(e) => set('description')(e.target.value)} aria-invalid={Boolean(errors.description)} /></Field>
        </div>
        <div className="ad-section-title">Price and availability</div>
        <div className="ad-form">
          <Field label="Price (₹)" error={errors.price} hint={!admin.can('products.price') ? 'Your role can’t change prices.' : undefined}><NumberInput value={draft.price} onChange={(v) => set('price')(v ?? 0)} invalid={Boolean(errors.price)} /></Field>
          <Field label="Compare-at price (₹)" error={errors.compareAtPrice} hint="Optional; shown struck through."><NumberInput value={draft.compareAtPrice} onChange={set('compareAtPrice')} invalid={Boolean(errors.compareAtPrice)} /></Field>
          <Field label="Stock policy"><select value={draft.stockPolicy} onChange={(e) => set('stockPolicy')(e.target.value as StockPolicy)}><option value="ingredients">From ingredient stock</option><option value="made-to-order">Made to order</option><option value="unlimited">No stock limit</option></select></Field>
          <Field label="Prep time (minutes)" error={errors.prepMinutes}><NumberInput value={draft.prepMinutes} onChange={(v) => set('prepMinutes')(v ?? 0)} /></Field>
          <div className="ad-field"><span>Availability</span><Toggle checked={draft.available} onChange={set('available')} label="Available to order (untick to show as sold out)" /></div>
          <div className="ad-field"><span>Featured</span><Toggle checked={draft.featured} onChange={set('featured')} label="Feature where the shop shows featured products" /></div>
        </div>
        <div className="ad-section-title">Details</div>
        <div className="ad-form">
          <Field label="Ingredients"><ListInput value={draft.ingredients} onChange={set('ingredients')} /></Field>
          <Field label="Allergens" hint="Suggested from the copy; confirm with the kitchen."><ListInput value={draft.allergens} onChange={set('allergens')} /></Field>
          <Field label="Dietary"><ListInput value={draft.dietary} onChange={set('dietary')} /></Field>
          <Field label="Flavour profile"><ListInput value={draft.flavorProfile} onChange={set('flavorProfile')} /></Field>
          <Field label="Texture"><input value={draft.texture} onChange={(e) => set('texture')(e.target.value)} /></Field>
          <Field label="Sweetness (1–5)" error={errors.sweetness}><NumberInput value={draft.sweetness} onChange={set('sweetness')} /></Field>
          <Field label="Occasion" wide><ListInput value={draft.occasion} onChange={set('occasion')} /></Field>
          <Field label="Search terms" wide hint="Words customers might type."><ListInput value={draft.searchTerms} onChange={set('searchTerms')} /></Field>
        </div>
        <div className="ad-section-title">Media</div>
        <p className="ad-muted small">Choose from the media library by role. Paths stay in the asset registry, never in product data.</p>
        <div className="ad-form">
          {MEDIA_ROLES.map((role) => (
            <Field key={role} label={role.charAt(0).toUpperCase() + role.slice(1)}>
              <select value={draft.media[role] ?? ''} onChange={(e) => patch({ media: { ...draft.media, [role]: e.target.value || undefined } })}>
                <option value="">None</option>
                {media.filter((m) => role === 'video' ? m.type === 'video' : role === 'poster' ? m.type === 'poster' : m.type === 'image').map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}
              </select>
            </Field>
          ))}
          <Field label="Gallery" wide hint="Media ids, comma separated."><ListInput value={draft.gallery} onChange={set('gallery')} /></Field>
        </div>
        <div className="ad-section-title">SEO</div>
        <div className="ad-form">
          <Field label={`SEO title (${draft.seoTitle.length}/70)`} error={errors.seoTitle} wide><input value={draft.seoTitle} onChange={(e) => set('seoTitle')(e.target.value)} /></Field>
          <Field label={`SEO description (${draft.seoDescription.length}/160)`} error={errors.seoDescription} wide><textarea rows={2} value={draft.seoDescription} onChange={(e) => set('seoDescription')(e.target.value)} /></Field>
        </div>
        {!canEdit && <p className="ad-muted small">Read only for your role.</p>}
      </fieldset>
      <MediaRoleNote roles={Object.keys(draft.media) as MediaRole[]} />
    </Drawer>
  );
}

function MediaRoleNote({ roles }: { roles: MediaRole[] }) {
  return roles.length ? <p className="ad-muted small" style={{ marginTop: 12 }}>Assigned roles: {roles.join(', ')}. All current images are reference placeholders that never ship; real photography replaces them under the same ids.</p> : null;
}
