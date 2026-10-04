'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Copy, ExternalLink, Plus } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { useAdmin } from '@/components/admin/admin-provider';
import { ListInput, NumberInput, Toggle, useDraft } from '@/components/admin/forms';
import { Badge, Drawer, Empty, Field, Guard, PageHeader, Panel, rupees, useUrlParam } from '@/components/admin/ui';
import {
  GROUP_KEY, GROUP_LABEL, MONTH_LABELS, dpi, duplicateOption, groupOptions, optionUsage, validateOption, validatePrintRules, validateRule, withOptionChange,
  type AnyOption, type CakeOverrides,
} from '@/lib/admin/cake-builder';
import { CATALOGUE_GROUPS, type CatalogueGroup } from '@/lib/cake/engine';
import { DEFAULT_CAKE_CATALOG } from '@/lib/cake/config';
import type { CompatibilityRule, OptionStatus, PrintRules, RuleScope, ShapeOption } from '@/lib/cake/types';
import { initialInventory } from '@/lib/inventory';

type Section = CatalogueGroup | 'fonts' | 'messageColors' | 'print' | 'rules' | 'production' | 'seasons';
const SECTIONS: { id: Section; label: string }[] = [
  ...CATALOGUE_GROUPS.map((g) => ({ id: g as Section, label: GROUP_LABEL[g] })),
  { id: 'fonts', label: 'Message fonts' }, { id: 'messageColors', label: 'Message colours' }, { id: 'print', label: 'Photo print rules' },
  { id: 'rules', label: 'Compatibility rules' }, { id: 'production', label: 'Production times' }, { id: 'seasons', label: 'Seasonal availability' },
];
const STATUS_TONE: Record<OptionStatus, 'ok' | 'neutral' | 'muted'> = { ACTIVE: 'ok', INACTIVE: 'neutral', ARCHIVED: 'muted' };
const STATUS_TEXT: Record<OptionStatus, string> = { ACTIVE: 'Active', INACTIVE: 'Unavailable', ARCHIVED: 'Archived' };
const statusOf = (o: { status?: OptionStatus; available?: boolean }): OptionStatus => o.status ?? (o.available === false ? 'INACTIVE' : 'ACTIVE');
const SHAPES: ShapeOption['kind'][] = ['round', 'square', 'heart', 'rectangle'];

export default function CakeBuilderPage() {
  return <Guard permission="cakeBuilder.view"><CakeBuilder /></Guard>;
}

function CakeBuilder() {
  const admin = useAdmin();
  const [section, setSection] = useUrlParam('section', 'size');
  const s = (SECTIONS.some((x) => x.id === section) ? section : 'size') as Section;
  const isGroup = (CATALOGUE_GROUPS as string[]).includes(s);

  return (
    <div>
      <PageHeader eyebrow="Catalogue" title="Cake Builder" description={<>Everything the Cake Playground offers: options, prices, rules and production times. Changes apply to new designs right away. Orders already placed keep the price and spec they were sold with. <span className="ad-muted">Live catalogue version {admin.cakeCatalog.version}.</span></>}
        actions={<Link className="ad-btn" href="/customize" target="_blank">Open the playground <ExternalLink size={13} /></Link>} />
      <div className="ad-split">
        <nav className="ad-subnav" aria-label="Cake Builder sections">
          <select className="ad-select ad-subnav-select" value={s} onChange={(e) => setSection(e.target.value)} aria-label="Section">{SECTIONS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
          <ul>{SECTIONS.map((x, i) => <li key={x.id} className={i === CATALOGUE_GROUPS.length ? 'ad-subnav-sep' : ''}><button type="button" className={s === x.id ? 'is-on' : ''} aria-current={s === x.id ? 'true' : undefined} onClick={() => setSection(x.id)}>{x.label}{(CATALOGUE_GROUPS as string[]).includes(x.id) && <span className="ad-chip-count">{groupOptions(admin.cakeCatalog, x.id as CatalogueGroup).filter((o) => statusOf(o) !== 'ARCHIVED').length}</span>}</button></li>)}</ul>
        </nav>
        <div className="ad-split-main">
          {isGroup && <GroupSection group={s as CatalogueGroup} />}
          {s === 'fonts' && <FontsSection />}
          {s === 'messageColors' && <ColorsSection />}
          {s === 'print' && <PrintSection />}
          {s === 'rules' && <RulesSection />}
          {s === 'production' && <ProductionSection onEdit={(g) => setSection(g)} />}
          {s === 'seasons' && <SeasonsSection onEdit={(g) => setSection(g)} />}
        </div>
      </div>
    </div>
  );
}

function useSaveCake() {
  const admin = useAdmin();
  return (next: CakeOverrides, audit: { action: string; id: string; label?: string; before?: unknown; after?: unknown; reason?: string; price?: boolean; success: string }) => admin.act({
    permission: audit.price ? 'cakeBuilder.price' : 'cakeBuilder.edit', action: audit.action, entity: { type: audit.action.startsWith('cake.rule') ? 'cakeRule' : audit.action.startsWith('cake.print') ? 'printRules' : 'cakeOption', id: audit.id, label: audit.label },
    before: audit.before, after: audit.after, reason: audit.reason, run: () => admin.saveCakeOverrides(next), success: audit.success,
  });
}

function GroupSection({ group }: { group: CatalogueGroup }) {
  const admin = useAdmin();
  const { orders } = useStore();
  const save = useSaveCake();
  const [editing, setEditing] = useState<{ option: AnyOption; isNew: boolean } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const list = groupOptions(admin.cakeCatalog, group);
  const shown = list.filter((o) => showArchived || statusOf(o) !== 'ARCHIVED');
  const canEdit = admin.can('cakeBuilder.edit');

  const setStatus = async (o: AnyOption, status: OptionStatus) => {
    const used = optionUsage(group, o.id, orders as never);
    if (status === 'ARCHIVED') {
      const r = await admin.confirm({ title: `Archive “${o.name}”?`, impact: ['Customers stop seeing it in the Cake Playground.', `${used} past order${used === 1 ? '' : 's'} chose it. They keep their spec and price; nothing is deleted.`, 'Saved designs that use it ask the customer to pick another.'], confirmLabel: 'Archive option', tone: 'danger', reason: 'required' });
      if (!r.ok) return;
      save(withOptionChange(admin.cakeOverrides, group, { ...o, status }), { action: 'cake.option.archived', id: `${group}:${o.id}`, label: o.name, before: { status: statusOf(o) }, after: { status }, reason: r.reason, success: `${o.name} archived` });
      return;
    }
    save(withOptionChange(admin.cakeOverrides, group, { ...o, status, available: status === 'ACTIVE' ? true : o.available }), { action: status === 'ACTIVE' ? 'cake.option.enabled' : 'cake.option.disabled', id: `${group}:${o.id}`, label: o.name, before: { status: statusOf(o) }, after: { status }, success: status === 'ACTIVE' ? `${o.name} is offered again` : `${o.name} shown as unavailable` });
  };

  return (
    <Panel title={GROUP_LABEL[group]} actions={<>
      <label className="ad-toggle small"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived</label>
      {canEdit && list.length > 0 && <button type="button" className="ad-btn ad-btn-sm ad-btn-primary" onClick={() => setEditing({ option: { ...duplicateOption(list[0], list), name: '', description: '' }, isNew: true })}><Plus size={13} /> Add option</button>}
    </>}>
      <p className="ad-muted small" style={{ marginTop: -4 }}>New options start from an existing one, so the preview knows how to draw them. They begin unavailable until you activate them.</p>
      {shown.length === 0 ? <Empty>No options.</Empty> : (
        <div className="ad-table-wrap">
          <table className="table ad-cards">
            <thead><tr><th>Option</th><th className="num">Price</th><th className="num">+ Hours</th><th>Status</th><th>Season</th><th>Allergens</th><th className="num">Orders</th><th /></tr></thead>
            <tbody>
              {shown.map((o) => {
                const st = statusOf(o);
                const used = optionUsage(group, o.id, orders as never);
                return (
                  <tr key={o.id}>
                    <td data-label="Option"><button type="button" className="ad-link ad-rowlink" onClick={() => setEditing({ option: o, isNew: false })}>{o.name}</button><span className="ad-sub ad-mono">{o.id}{typeof o.hex === 'string' && <> · <span className="ad-swatch" style={{ background: o.hex as string }} aria-hidden /> {o.hex as string}</>}</span></td>
                    <td data-label="Price" className="num">{group === 'toppings' ? <>{rupees(o.perUnit ?? 0)}<span className="ad-sub">per portion · max {o.maxQuantity}</span></> : rupees(o.price)}</td>
                    <td data-label="+ Hours" className="num">{o.productionHours ? `${o.productionHours} h` : '—'}</td>
                    <td data-label="Status"><Badge tone={STATUS_TONE[st]}>{STATUS_TEXT[st]}</Badge></td>
                    <td data-label="Season">{o.seasonMonths ? o.seasonMonths.map((m) => MONTH_LABELS[m - 1]).join(', ') : <span className="ad-muted">All year</span>}</td>
                    <td data-label="Allergens">{o.allergens?.length ? o.allergens.join(', ') : <span className="ad-muted">—</span>}</td>
                    <td data-label="Orders" className="num">{used}</td>
                    <td data-label="" className="cell-actions">
                      {canEdit && <>
                        <button type="button" className="ad-btn ad-btn-sm" onClick={() => setEditing({ option: o, isNew: false })}>Edit</button>
                        <button type="button" className="ad-btn ad-btn-sm ad-btn-ghost" onClick={() => setEditing({ option: duplicateOption(o, list), isNew: true })} aria-label={`Duplicate ${o.name}`}><Copy size={12} /></button>
                        {st === 'ARCHIVED' ? <button type="button" className="ad-btn ad-btn-sm ad-btn-ghost" onClick={() => setStatus(o, 'INACTIVE')}>Restore</button>
                          : <><button type="button" className="ad-btn ad-btn-sm ad-btn-ghost" onClick={() => setStatus(o, st === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}>{st === 'ACTIVE' ? 'Disable' : 'Enable'}</button>
                            <button type="button" className="ad-btn ad-btn-sm ad-btn-ghost ad-btn-quiet-danger" onClick={() => setStatus(o, 'ARCHIVED')}>Archive</button></>}
                      </>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {editing && <OptionEditor group={group} initial={editing.option} isNew={editing.isNew} all={list} usage={optionUsage(group, editing.option.id, orders as never)} onClose={() => setEditing(null)} />}
    </Panel>
  );
}

function OptionEditor({ group, initial, isNew, all, usage, onClose }: { group: CatalogueGroup; initial: AnyOption; isNew: boolean; all: AnyOption[]; usage: number; onClose: () => void }) {
  const admin = useAdmin();
  const save = useSaveCake();
  const { draft, patch, dirty } = useDraft<AnyOption>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (!draft) return null;
  const canEdit = admin.can('cakeBuilder.edit');
  const months = draft.seasonMonths ?? null;

  const submit = async () => {
    const others = isNew ? [...all, draft] : all.map((o) => (o.id === initial.id ? draft : o));
    const e = validateOption(group, draft, others);
    setErrors(e);
    if (Object.keys(e).length) { admin.toast({ tone: 'error', title: 'Check the highlighted fields', detail: Object.values(e)[0] }); return; }
    const priceChanged = !isNew && (draft.price !== initial.price || draft.perUnit !== initial.perUnit);
    let reason = '';
    if (priceChanged) {
      if (!admin.can('cakeBuilder.price')) { admin.toast({ tone: 'error', title: 'Price changes need approval', detail: 'Your role can edit options but not prices.' }); return; }
      const r = await admin.confirm({ title: `Change the price of “${draft.name}”?`, impact: [group === 'toppings' ? `${rupees(initial.perUnit ?? 0)} → ${rupees(draft.perUnit ?? 0)} per portion.` : `${rupees(initial.price)} → ${rupees(draft.price)}.`, 'New designs and bags are priced with it immediately.', `${usage} past order${usage === 1 ? '' : 's'} keep the price they paid (order snapshot).`], confirmLabel: 'Change price', tone: 'primary', reason: 'required' });
      if (!r.ok) return;
      reason = r.reason;
    }
    const res = save(withOptionChange(admin.cakeOverrides, group, draft), {
      action: isNew ? 'cake.option.created' : priceChanged ? 'cake.option.price.changed' : 'cake.option.updated', id: `${group}:${draft.id}`, label: draft.name,
      before: isNew ? null : initial, after: draft, reason, price: priceChanged, success: isNew ? `${draft.name} added (unavailable until activated)` : `${draft.name} saved`,
    });
    if (res.ok) onClose();
  };

  const ingredients = Object.entries(draft.ingredients ?? {});
  return (
    <Drawer open onClose={onClose} title={isNew ? `New ${GROUP_LABEL[group].toLowerCase().replace(/s$/, '')}` : draft.name} subtitle={!isNew && <><Badge tone={STATUS_TONE[statusOf(initial)]}>{STATUS_TEXT[statusOf(initial)]}</Badge><span>{usage} order{usage === 1 ? '' : 's'} chose it</span></>}
      footer={canEdit && <button type="button" className="ad-btn ad-btn-primary" disabled={!dirty && !isNew} onClick={submit}>{isNew ? 'Add option' : 'Save'}</button>}>
      <fieldset disabled={!canEdit} className="ad-form-fieldset">
        <div className="ad-form">
          <Field label="Name" error={errors.name}><input value={draft.name} onChange={(e) => patch({ name: e.target.value })} aria-invalid={Boolean(errors.name)} /></Field>
          <Field label="Id" error={errors.id} hint={isNew ? 'Lowercase with hyphens. Fixed once created.' : 'Fixed: saved designs and orders refer to it.'}><input value={draft.id} disabled={!isNew} onChange={(e) => patch({ id: e.target.value })} aria-invalid={Boolean(errors.id)} /></Field>
          <Field label="Description" wide><input value={draft.description ?? ''} onChange={(e) => patch({ description: e.target.value })} /></Field>
          {group === 'toppings' ? <>
            <Field label="Price per portion (₹)" error={errors.perUnit}><NumberInput value={draft.perUnit ?? 0} onChange={(v) => patch({ perUnit: v ?? 0 })} /></Field>
            <Field label="Max portions" error={errors.maxQuantity}><NumberInput value={draft.maxQuantity ?? 1} onChange={(v) => patch({ maxQuantity: v ?? 1 })} /></Field>
            <Field label="Flat price (₹)" error={errors.price} hint="Added once, on top of portions. Usually 0."><NumberInput value={draft.price} onChange={(v) => patch({ price: v ?? 0 })} /></Field>
            <fieldset className="ad-fieldset"><legend>Compatible shapes</legend><div className="ad-row">{SHAPES.map((k) => <label key={k} className="ad-toggle small"><input type="checkbox" checked={!draft.compatibleShapes || draft.compatibleShapes.includes(k)} onChange={(e) => { const cur = draft.compatibleShapes ?? SHAPES; const next = e.target.checked ? [...new Set([...cur, k])] : cur.filter((x) => x !== k); patch({ compatibleShapes: next.length === SHAPES.length ? undefined : next }); }} /> {k}</label>)}</div></fieldset>
          </> : <Field label="Price (₹)" error={errors.price}><NumberInput value={draft.price} onChange={(v) => patch({ price: v ?? 0 })} invalid={Boolean(errors.price)} /></Field>}
          <Field label="Extra production hours" error={errors.productionHours}><NumberInput value={draft.productionHours ?? 0} onChange={(v) => patch({ productionHours: v ? v : undefined })} /></Field>
          <Field label="Status"><select value={statusOf(draft)} onChange={(e) => patch({ status: e.target.value as OptionStatus, available: e.target.value === 'ACTIVE' ? true : draft.available })}><option value="ACTIVE">Active</option><option value="INACTIVE">Unavailable</option><option value="ARCHIVED">Archived</option></select></Field>
          <div className="ad-field"><span>Availability</span><Toggle checked={draft.available} onChange={(v) => patch({ available: v })} label="Available today" /></div>
          {group === 'size' && <>
            <Field label="Inches" error={errors.inches}><NumberInput value={Number(draft.inches)} onChange={(v) => patch({ inches: v ?? 0, diameterCm: Math.round((v ?? 0) * 2.54) })} /></Field>
            <Field label="Layers" error={errors.layers}><NumberInput value={Number(draft.layers)} onChange={(v) => patch({ layers: v ?? 1 })} /></Field>
            <Field label="Serves"><input value={String(draft.servings ?? '')} onChange={(e) => patch({ servings: e.target.value })} /></Field>
          </>}
          {group === 'color' && <>
            <Field label="Colour" error={errors.hex}><input type="color" value={String(draft.hex)} onChange={(e) => patch({ hex: e.target.value.toUpperCase() })} /></Field>
            <Field label="Shade" error={errors.shade}><input type="color" value={String(draft.shade)} onChange={(e) => patch({ shade: e.target.value.toUpperCase() })} /></Field>
          </>}
          <Field label="Allergens" wide><ListInput value={draft.allergens ?? []} onChange={(v) => patch({ allergens: v.length ? v : undefined })} placeholder="gluten, egg, dairy, nuts" /></Field>
          <fieldset className="ad-fieldset">
            <legend>Ingredients per cake (6-inch; scaled by size)</legend>
            {ingredients.length === 0 && <p className="ad-muted small">No stock tracked for this option.</p>}
            {ingredients.map(([id, amount]) => {
              const ing = initialInventory.find((i) => i.id === id);
              return (
                <div key={id} className="ad-row" style={{ marginBottom: 6 }}>
                  <span style={{ minWidth: 140 }}>{ing?.name ?? id}</span>
                  <NumberInput value={amount} step={0.01} onChange={(v) => patch({ ingredients: { ...draft.ingredients, [id]: v ?? 0 } })} />
                  <span className="ad-muted small">{ing?.unit}</span>
                  <button type="button" className="ad-btn ad-btn-sm ad-btn-ghost" onClick={() => { const next = { ...draft.ingredients }; delete next[id]; patch({ ingredients: Object.keys(next).length ? next : undefined }); }}>Remove</button>
                </div>
              );
            })}
            <select className="ad-select" value="" onChange={(e) => { if (e.target.value) patch({ ingredients: { ...(draft.ingredients ?? {}), [e.target.value]: 0.1 } }); }} aria-label="Add an ingredient">
              <option value="">Add an ingredient…</option>
              {initialInventory.filter((i) => !(draft.ingredients ?? {})[i.id]).map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
            </select>
            {errors.ingredients && <em className="ad-error">{errors.ingredients}</em>}
          </fieldset>
          <fieldset className="ad-fieldset">
            <legend>Season</legend>
            <Toggle checked={months === null} onChange={(v) => patch({ seasonMonths: v ? undefined : [new Date().getMonth() + 1] })} label="Available all year" />
            {months && <div className="ad-months" style={{ marginTop: 6 }}>{MONTH_LABELS.map((m, i) => <label key={m}><input type="checkbox" checked={months.includes(i + 1)} onChange={(e) => patch({ seasonMonths: e.target.checked ? [...months, i + 1].sort((a, b) => a - b) : months.filter((x) => x !== i + 1) })} />{m}</label>)}</div>}
            {errors.seasonMonths && <em className="ad-error">{errors.seasonMonths}</em>}
            <Field label="Customer note when out of season" wide><input value={draft.note ?? ''} onChange={(e) => patch({ note: e.target.value || undefined })} placeholder="In season March to June" /></Field>
          </fieldset>
        </div>
      </fieldset>
    </Drawer>
  );
}

function FontsSection() {
  const admin = useAdmin();
  const save = useSaveCake();
  const fonts = admin.cakeCatalog.fonts;
  const set = (id: string, status: OptionStatus) => {
    const active = fonts.filter((f) => (f.id === id ? status : f.status ?? 'ACTIVE') === 'ACTIVE');
    if (!active.length) { admin.toast({ tone: 'error', title: 'Keep at least one font', detail: 'Customers need a font for their message.' }); return; }
    save({ ...admin.cakeOverrides, revision: admin.cakeOverrides.revision + 1, fonts: { ...admin.cakeOverrides.fonts, [id]: { status } } }, { action: 'cake.font.changed', id: `font:${id}`, before: { status: fonts.find((f) => f.id === id)?.status ?? 'ACTIVE' }, after: { status }, success: 'Font updated' });
  };
  return (
    <Panel title="Message fonts">
      <p className="ad-muted small" style={{ marginTop: -4 }}>The approved styles the bakery can pipe or print. Turning one off hides it in the playground; past orders keep theirs.</p>
      <table className="table ad-cards"><thead><tr><th>Font</th><th>Sample</th><th>Note</th><th>Status</th><th /></tr></thead>
        <tbody>{fonts.map((f) => <tr key={f.id}><td data-label="Font"><strong>{f.name}</strong><span className="ad-sub ad-mono">{f.id}</span></td><td data-label="Sample" style={{ fontFamily: f.family, fontSize: 18 }}>Happy Birthday</td><td data-label="Note">{f.note}</td><td data-label="Status"><Badge tone={STATUS_TONE[f.status ?? 'ACTIVE']}>{STATUS_TEXT[f.status ?? 'ACTIVE']}</Badge></td>
          <td data-label="" className="cell-actions">{admin.can('cakeBuilder.edit') && <button type="button" className="ad-btn ad-btn-sm" onClick={() => set(f.id, (f.status ?? 'ACTIVE') === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}>{(f.status ?? 'ACTIVE') === 'ACTIVE' ? 'Disable' : 'Enable'}</button>}</td></tr>)}</tbody>
      </table>
    </Panel>
  );
}

function ColorsSection() {
  const admin = useAdmin();
  const save = useSaveCake();
  const [name, setName] = useState('');
  const [hex, setHex] = useState('#7E9291');
  const colors = admin.cakeCatalog.messageColors;
  const set = (id: string, status: OptionStatus) => save({ ...admin.cakeOverrides, revision: admin.cakeOverrides.revision + 1, messageColors: { ...admin.cakeOverrides.messageColors, [id]: { ...admin.cakeOverrides.messageColors[id], status } } }, { action: 'cake.messageColor.changed', id: `messageColor:${id}`, after: { status }, success: 'Message colour updated' });
  const add = () => {
    const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (name.trim().length < 2 || !/^#[0-9a-f]{6}$/i.test(hex)) { admin.toast({ tone: 'error', title: 'Add a name and a colour' }); return; }
    if (colors.some((c) => c.id === id || c.hex.toLowerCase() === hex.toLowerCase())) { admin.toast({ tone: 'error', title: 'That colour already exists' }); return; }
    const r = save({ ...admin.cakeOverrides, revision: admin.cakeOverrides.revision + 1, messageColors: { ...admin.cakeOverrides.messageColors, [id]: { name: name.trim(), hex: hex.toUpperCase(), status: 'ACTIVE', createdInAdmin: true } } }, { action: 'cake.messageColor.created', id: `messageColor:${id}`, after: { name, hex }, success: `${name} added` });
    if (r.ok) setName('');
  };
  return (
    <Panel title="Message colours">
      <table className="table ad-cards"><thead><tr><th>Colour</th><th>Hex</th><th>Status</th><th /></tr></thead>
        <tbody>{colors.map((c) => <tr key={c.id}><td data-label="Colour"><span className="ad-swatch" style={{ background: c.hex }} aria-hidden /> {c.name}</td><td data-label="Hex" className="ad-mono">{c.hex}</td><td data-label="Status"><Badge tone={STATUS_TONE[c.status ?? 'ACTIVE']}>{STATUS_TEXT[c.status ?? 'ACTIVE']}</Badge></td>
          <td data-label="" className="cell-actions">{admin.can('cakeBuilder.edit') && <button type="button" className="ad-btn ad-btn-sm" onClick={() => set(c.id, (c.status ?? 'ACTIVE') === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}>{(c.status ?? 'ACTIVE') === 'ACTIVE' ? 'Disable' : 'Enable'}</button>}</td></tr>)}</tbody>
      </table>
      {admin.can('cakeBuilder.edit') && <div className="ad-row" style={{ marginTop: 10 }}><input className="ad-input" style={{ maxWidth: 220 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Rose gold" aria-label="New colour name" /><input type="color" value={hex} onChange={(e) => setHex(e.target.value)} aria-label="New colour" /><button type="button" className="ad-btn ad-btn-sm" onClick={add}><Plus size={12} /> Add colour</button></div>}
    </Panel>
  );
}

function PrintSection() {
  const admin = useAdmin();
  const save = useSaveCake();
  const current = admin.cakeCatalog.printRules;
  const { draft, patch, dirty } = useDraft<PrintRules>(current);
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (!draft) return null;
  const submit = async () => {
    const e = validatePrintRules(draft);
    setErrors(e);
    if (Object.keys(e).length) return;
    const priceChanged = draft.price !== current.price;
    if (priceChanged && !admin.can('cakeBuilder.price')) { admin.toast({ tone: 'error', title: 'Price changes need approval' }); return; }
    const r = await admin.confirm({ title: 'Save photo print rules?', impact: ['Applies to new designs and to photos customers upload from now on.', ...(priceChanged ? [`Print price ${rupees(current.price)} → ${rupees(draft.price)}; past orders keep theirs.`] : [])], confirmLabel: 'Save rules', tone: 'primary', reason: priceChanged ? 'required' : 'optional' });
    if (!r.ok) return;
    save({ ...admin.cakeOverrides, revision: admin.cakeOverrides.revision + 1, printRules: draft }, { action: 'cake.print.updated', id: 'print-rules', before: current, after: draft, reason: r.reason, price: priceChanged, success: 'Print rules saved' });
  };
  return (
    <Panel title="Photo print rules" actions={admin.can('cakeBuilder.edit') && <button type="button" className="ad-btn ad-btn-sm ad-btn-primary" disabled={!dirty} onClick={submit}>Save</button>}>
      <fieldset disabled={!admin.can('cakeBuilder.edit')} className="ad-form-fieldset">
        <div className="ad-form">
          <Field label="Price (₹)" error={errors.price}><NumberInput value={draft.price} onChange={(v) => patch({ price: v ?? 0 })} /></Field>
          <Field label="Extra production hours" error={errors.productionHours}><NumberInput value={draft.productionHours} onChange={(v) => patch({ productionHours: v ?? 0 })} /></Field>
          <Field label="Minimum cake size (inches)" error={errors.minSizeInches} hint="Smaller sizes can’t have a print (drives the compatibility rule)."><NumberInput value={draft.minSizeInches ?? 6} onChange={(v) => patch({ minSizeInches: v ?? undefined })} /></Field>
          <Field label="Safe area margin (%)" error={errors.printableInset} hint="Distance from the edge where nothing prints."><NumberInput value={Math.round(draft.printableInset * 100)} onChange={(v) => patch({ printableInset: (v ?? 0) / 100 })} /></Field>
          <Field label={`Minimum resolution (dots per cm) · about ${dpi(draft.minDotsPerCm)} DPI`} error={errors.minDotsPerCm}><NumberInput value={draft.minDotsPerCm} onChange={(v) => patch({ minDotsPerCm: v ?? 0 })} /></Field>
          <Field label="Max upload size (MB)" error={errors.maxUploadBytes}><NumberInput value={Math.round((draft.maxUploadBytes / 1048576) * 10) / 10} step={0.5} onChange={(v) => patch({ maxUploadBytes: Math.round((v ?? 0) * 1048576) })} /></Field>
          <fieldset className="ad-fieldset"><legend>Allowed file types</legend><div className="ad-row">{['image/jpeg', 'image/png', 'image/webp'].map((t) => <label key={t} className="ad-toggle small"><input type="checkbox" checked={draft.acceptedTypes.includes(t)} onChange={(e) => patch({ acceptedTypes: e.target.checked ? [...draft.acceptedTypes, t] : draft.acceptedTypes.filter((x) => x !== t) })} /> {t.replace('image/', '').toUpperCase()}</label>)}</div>{errors.acceptedTypes && <em className="ad-error">{errors.acceptedTypes}</em>}</fieldset>
        </div>
      </fieldset>
    </Panel>
  );
}

const SCOPE_GROUPS: { key: keyof RuleScope; group: CatalogueGroup | null; label: string }[] = [
  { key: 'size', group: 'size', label: 'Size' }, { key: 'shape', group: 'shape', label: 'Shape' }, { key: 'sponge', group: 'sponge', label: 'Sponge' }, { key: 'filling', group: 'filling', label: 'Filling' },
  { key: 'frosting', group: 'frosting', label: 'Frosting' }, { key: 'finish', group: 'finish', label: 'Finish' }, { key: 'color', group: 'color', label: 'Colour' },
  { key: 'topping', group: 'toppings', label: 'Topping' }, { key: 'decoration', group: 'decorations', label: 'Decoration' }, { key: 'topper', group: 'topper', label: 'Topper' }, { key: 'candles', group: 'candles', label: 'Candles' },
  { key: 'print', group: null, label: 'Photo print' },
];

function describeScope(scope: RuleScope, nameOf: (key: keyof RuleScope, id: string) => string): string {
  return Object.entries(scope).map(([k, v]) => (k === 'print' ? 'photo print' : `${SCOPE_GROUPS.find((g) => g.key === k)?.label.toLowerCase()} ${(v as string[]).map((id) => nameOf(k as keyof RuleScope, id)).join(' / ')}`)).join(' and ');
}

function RulesSection() {
  const admin = useAdmin();
  const save = useSaveCake();
  const rules = admin.cakeCatalog.rules;
  const nameOf = (key: keyof RuleScope, id: string) => { const g = SCOPE_GROUPS.find((x) => x.key === key)?.group; return g ? groupOptions(admin.cakeCatalog, g).find((o) => o.id === id)?.name ?? id : id; };
  const [form, setForm] = useState<{ whenKey: keyof RuleScope; whenIds: string[]; blockKey: keyof RuleScope; blockIds: string[]; reason: string }>({ whenKey: 'size', whenIds: [], blockKey: 'finish', blockIds: [], reason: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const canEdit = admin.can('cakeBuilder.edit');

  const toggle = (r: CompatibilityRule) => save({ ...admin.cakeOverrides, revision: admin.cakeOverrides.revision + 1, rules: { ...admin.cakeOverrides.rules, [r.id]: { ...admin.cakeOverrides.rules[r.id], enabled: r.enabled === false } } },
    { action: 'cake.rule.toggled', id: r.id, label: r.reason, before: { enabled: r.enabled !== false }, after: { enabled: r.enabled === false }, success: r.enabled === false ? 'Rule turned on' : 'Rule turned off' });
  const scope = (key: keyof RuleScope, ids: string[]): RuleScope => (key === 'print' ? { print: true } : { [key]: ids });
  const add = () => {
    const rule: CompatibilityRule = { id: `custom-${form.whenKey}-${form.blockKey}-${Date.now().toString(36)}`, when: scope(form.whenKey, form.whenIds), block: scope(form.blockKey, form.blockIds), reason: form.reason.trim(), enabled: true };
    const e = validateRule(rule, rules);
    setErrors(e);
    if (Object.keys(e).length) return;
    const r = save({ ...admin.cakeOverrides, revision: admin.cakeOverrides.revision + 1, createdRules: [...admin.cakeOverrides.createdRules, rule] }, { action: 'cake.rule.created', id: rule.id, label: rule.reason, after: rule, success: 'Rule added' });
    if (r.ok) setForm({ ...form, whenIds: [], blockIds: [], reason: '' });
  };
  const picker = (key: keyof RuleScope, ids: string[], onChange: (ids: string[]) => void) => {
    const g = SCOPE_GROUPS.find((x) => x.key === key)?.group;
    if (!g) return <p className="ad-muted small">Applies when a photo print is on.</p>;
    return <div className="ad-months">{groupOptions(admin.cakeCatalog, g).filter((o) => statusOf(o) !== 'ARCHIVED').map((o) => <label key={o.id}><input type="checkbox" checked={ids.includes(o.id)} onChange={(e) => onChange(e.target.checked ? [...ids, o.id] : ids.filter((x) => x !== o.id))} />{o.name}</label>)}</div>;
  };
  return (
    <>
      <Panel title="Compatibility rules">
        <p className="ad-muted small" style={{ marginTop: -4 }}>When the first part matches, the second is ruled out, and customers see the reason. Built-in rules can be turned off but not deleted.</p>
        <table className="table ad-cards"><thead><tr><th>When</th><th>Rules out</th><th>Reason shown</th><th>Status</th><th /></tr></thead>
          <tbody>{rules.map((r) => <tr key={r.id}><td data-label="When">{describeScope(r.when, nameOf) || <span className="ad-muted">nothing (no sizes below the print minimum)</span>}</td><td data-label="Rules out">{describeScope(r.block, nameOf)}</td><td data-label="Reason">{r.reason}</td><td data-label="Status"><Badge tone={r.enabled === false ? 'muted' : 'ok'}>{r.enabled === false ? 'Off' : 'On'}</Badge>{!DEFAULT_CAKE_CATALOG.rules.some((d) => d.id === r.id) && <span className="ad-sub">added in admin</span>}</td>
            <td data-label="" className="cell-actions">{canEdit && r.id !== 'print-min-size' && <button type="button" className="ad-btn ad-btn-sm" onClick={() => toggle(r)}>{r.enabled === false ? 'Turn on' : 'Turn off'}</button>}</td></tr>)}</tbody>
        </table>
      </Panel>
      {canEdit && (
        <Panel title="Add a rule">
          <div className="ad-form">
            <Field label="When the cake has" error={errors.when} wide><select value={form.whenKey} onChange={(e) => setForm({ ...form, whenKey: e.target.value as keyof RuleScope, whenIds: [] })}>{SCOPE_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}</select>{picker(form.whenKey, form.whenIds, (ids) => setForm({ ...form, whenIds: ids }))}</Field>
            <Field label="Rule out" error={errors.block} wide><select value={form.blockKey} onChange={(e) => setForm({ ...form, blockKey: e.target.value as keyof RuleScope, blockIds: [] })}>{SCOPE_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}</select>{picker(form.blockKey, form.blockIds, (ids) => setForm({ ...form, blockIds: ids }))}</Field>
            <Field label="Reason customers see" error={errors.reason} wide><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Gold leaf needs a frosted side to hold." /></Field>
          </div>
          <div className="ad-row" style={{ marginTop: 10, justifyContent: 'flex-end' }}><button type="button" className="ad-btn ad-btn-primary" onClick={add}>Add rule</button></div>
        </Panel>
      )}
    </>
  );
}

function ProductionSection({ onEdit }: { onEdit: (g: string) => void }) {
  const admin = useAdmin();
  const save = useSaveCake();
  const base = admin.cakeCatalog.baseProductionHours;
  const [hours, setHours] = useState<number | null>(base);
  const rows = CATALOGUE_GROUPS.flatMap((g) => groupOptions(admin.cakeCatalog, g).filter((o) => o.productionHours && statusOf(o) !== 'ARCHIVED').map((o) => ({ g, o })));
  const submit = async () => {
    if (hours === null || hours < 1 || hours > 96) { admin.toast({ tone: 'error', title: 'Base time is 1 to 96 hours' }); return; }
    const r = await admin.confirm({ title: `Change the base production time to ${hours} h?`, impact: ['Earliest delivery slots for new custom cakes move accordingly.', 'Orders already placed keep their slot and production time.'], confirmLabel: 'Save', tone: 'primary', reason: 'optional' });
    if (!r.ok) return;
    save({ ...admin.cakeOverrides, revision: admin.cakeOverrides.revision + 1, baseProductionHours: hours }, { action: 'cake.production.base.changed', id: 'base-production-hours', before: { hours: base }, after: { hours }, reason: r.reason, success: 'Base production time saved' });
  };
  return (
    <Panel title="Production times">
      <div className="ad-row"><Field label="Base time for every custom cake (hours)"><NumberInput value={hours} onChange={setHours} /></Field>{admin.can('cakeBuilder.edit') && <button type="button" className="ad-btn ad-btn-primary" style={{ alignSelf: 'flex-end' }} disabled={hours === base} onClick={submit}>Save</button>}</div>
      <div className="ad-section-title">Options that add time</div>
      <table className="table ad-cards"><thead><tr><th>Group</th><th>Option</th><th className="num">+ Hours</th><th /></tr></thead>
        <tbody>{rows.map(({ g, o }) => <tr key={`${g}:${o.id}`}><td data-label="Group">{GROUP_LABEL[g]}</td><td data-label="Option">{o.name}</td><td data-label="+ Hours" className="num">{o.productionHours} h</td><td data-label="" className="cell-actions"><button type="button" className="ad-btn ad-btn-sm" onClick={() => onEdit(g)}>Edit in {GROUP_LABEL[g]}</button></td></tr>)}
          <tr><td data-label="Group">Photo print</td><td data-label="Option">Edible print</td><td data-label="+ Hours" className="num">{admin.cakeCatalog.printRules.productionHours} h</td><td data-label="" className="cell-actions"><button type="button" className="ad-btn ad-btn-sm" onClick={() => onEdit('print')}>Edit print rules</button></td></tr></tbody>
      </table>
      <p className="ad-muted small">A cake’s time = base + the extra hours of everything chosen. Slots offered at checkout start after that time.</p>
    </Panel>
  );
}

function SeasonsSection({ onEdit }: { onEdit: (g: string) => void }) {
  const admin = useAdmin();
  const month = new Date().getMonth() + 1;
  const rows = useMemo(() => CATALOGUE_GROUPS.flatMap((g) => groupOptions(admin.cakeCatalog, g).filter((o) => o.seasonMonths && statusOf(o) !== 'ARCHIVED').map((o) => ({ g, o }))), [admin.cakeCatalog]);
  return (
    <Panel title="Seasonal availability">
      {rows.length === 0 ? <Empty>Every option is available all year.</Empty> : (
        <div className="ad-table-wrap"><table className="table ad-season">
          <thead><tr><th>Option</th>{MONTH_LABELS.map((m, i) => <th key={m} className={i + 1 === month ? 'is-now' : ''}>{m}</th>)}<th /></tr></thead>
          <tbody>{rows.map(({ g, o }) => <tr key={`${g}:${o.id}`}><td><strong>{o.name}</strong><span className="ad-sub">{GROUP_LABEL[g]}</span></td>{MONTH_LABELS.map((m, i) => <td key={m} className={`${o.seasonMonths!.includes(i + 1) ? 'is-in' : ''} ${i + 1 === month ? 'is-now' : ''}`}>{o.seasonMonths!.includes(i + 1) ? <span aria-label="in season">●</span> : <span className="ad-sr">out</span>}</td>)}<td className="cell-actions"><button type="button" className="ad-btn ad-btn-sm" onClick={() => onEdit(g)}>Edit</button></td></tr>)}</tbody>
        </table></div>
      )}
      <p className="ad-muted small">Out-of-season options show as unavailable in the playground with the option’s note.</p>
    </Panel>
  );
}
