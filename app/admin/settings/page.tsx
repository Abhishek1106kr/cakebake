'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState } from 'react';
import { useAdmin } from '@/components/admin/admin-provider';
import { ListInput, NumberInput, Toggle } from '@/components/admin/forms';
import { Badge, Field, Guard, PageHeader, Panel, useUrlParam } from '@/components/admin/ui';
import { SETTINGS_SCHEMA, validateSettings, type SettingField, type SettingsValues } from '@/lib/admin/settings';
import { diff } from '@/lib/admin/audit';

const LINKS: Record<string, { href: string; label: string }> = { cakeBuilder: { href: '/admin/cake-builder', label: 'Open Cake Builder' }, staff: { href: '/admin/staff', label: 'Open Staff' } };

export default function SettingsPage() {
  return <Guard permission="settings.view"><Settings /></Guard>;
}

function Settings() {
  const admin = useAdmin();
  const [sectionId, setSectionId] = useUrlParam('section', 'business');
  const section = SETTINGS_SCHEMA.find((s) => s.id === sectionId) ?? SETTINGS_SCHEMA[0];
  const [draft, setDraft] = useState<SettingsValues>(admin.settings);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { setDraft(admin.settings); setErrors({}); }, [admin.settings, section.id]);
  const canEdit = admin.can('settings.edit');
  const keys = section.fields.map((f) => f.key);
  const changed = keys.filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(admin.settings[k]));

  const save = async () => {
    const e = validateSettings(draft);
    const mine = Object.fromEntries(Object.entries(e).filter(([k]) => keys.includes(k)));
    setErrors(mine);
    if (Object.keys(mine).length) return;
    const live = section.fields.filter((f) => f.live && changed.includes(f.key));
    const r = await admin.confirm({
      title: `Save ${section.title.toLowerCase()} settings?`,
      impact: [...changed.map((k) => { const f = section.fields.find((x) => x.key === k)!; return `${f.label}: ${String(admin.settings[k] ?? '—')} → ${String(draft[k] ?? '—')}${f.live ? ' (takes effect now)' : ' (saved for later)'}`; }), ...(live.length ? ['Live changes apply to new orders and bags in every open tab; existing orders keep their values.'] : [])],
      confirmLabel: 'Save settings', tone: 'primary', reason: live.length ? 'required' : 'optional',
    });
    if (!r.ok) return;
    const next = { ...admin.settings, ...Object.fromEntries(keys.map((k) => [k, draft[k]])) };
    const d = diff(Object.fromEntries(changed.map((k) => [k, admin.settings[k]])), Object.fromEntries(changed.map((k) => [k, draft[k]])));
    admin.act({ permission: 'settings.edit', action: 'settings.changed', entity: { type: 'settings', id: section.id, label: section.title }, before: Object.fromEntries(d.map((c) => [c.field, c.before])), after: Object.fromEntries(d.map((c) => [c.field, c.after])), reason: r.reason, run: () => admin.saveSettings(next), success: `${section.title} saved` });
  };

  const input = (f: SettingField) => {
    const v = draft[f.key];
    const set = (val: SettingsValues[string]) => setDraft((d) => ({ ...d, [f.key]: val }));
    switch (f.type) {
      case 'boolean': return <Toggle checked={Boolean(v)} onChange={set} label={f.label} disabled={!canEdit} />;
      case 'number': return <NumberInput value={typeof v === 'number' ? v : null} onChange={(n) => set(n ?? NaN)} invalid={Boolean(errors[f.key])} />;
      case 'list': return <ListInput value={Array.isArray(v) ? v : []} onChange={set} />;
      case 'textarea': return <textarea rows={2} value={String(v ?? '')} onChange={(e) => set(e.target.value)} />;
      case 'time': return <input type="time" value={String(v ?? '')} onChange={(e) => set(e.target.value)} />;
      default: return <input value={String(v ?? '')} onChange={(e) => set(e.target.value)} aria-invalid={Boolean(errors[f.key])} />;
    }
  };

  return (
    <div>
      <PageHeader eyebrow="System" title="Settings" description="Business rules in one place. “Live” settings change how the shop and admin behave now; the rest are saved for the backend phase. No keys, tokens or passwords are ever stored here." />
      <div className="ad-split">
        <nav className="ad-subnav" aria-label="Settings sections">
          <select className="ad-select ad-subnav-select" value={section.id} onChange={(e) => setSectionId(e.target.value)} aria-label="Section">{SETTINGS_SCHEMA.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select>
          <ul>{SETTINGS_SCHEMA.map((s) => <li key={s.id}><button type="button" className={s.id === section.id ? 'is-on' : ''} aria-current={s.id === section.id ? 'true' : undefined} onClick={() => setSectionId(s.id)}>{s.title}{s.fields.some((f) => f.live) && <span className="ad-chip-count">live</span>}</button></li>)}</ul>
        </nav>
        <div className="ad-split-main">
          <Panel title={section.title} id={section.id} actions={canEdit && section.fields.length > 0 && <>
            {changed.length > 0 && <button type="button" className="ad-btn ad-btn-sm ad-btn-ghost" onClick={() => { setDraft(admin.settings); setErrors({}); }}>Discard</button>}
            <button type="button" className="ad-btn ad-btn-sm ad-btn-primary" disabled={!changed.length} onClick={save}>Save{changed.length ? ` (${changed.length})` : ''}</button>
          </>}>
            <p className="ad-muted" style={{ marginTop: -4 }}>{section.summary}</p>
            {section.note && <div className="ad-callout" style={{ marginBottom: 12 }}><span>{section.note}</span></div>}
            {LINKS[section.id] && <Link className="ad-btn" href={LINKS[section.id].href as Route}>{LINKS[section.id].label}</Link>}
            {section.fields.length > 0 && (
              <fieldset disabled={!canEdit} className="ad-form-fieldset">
                <div className="ad-form">
                  {section.fields.map((f) => (
                    f.type === 'boolean'
                      ? <div key={f.key} className="ad-field">{input(f)}<small>{f.live ? <Badge tone="ok">Live</Badge> : <Badge tone="muted">Saved for later</Badge>} {f.help}</small></div>
                      : <Field key={f.key} label={`${f.label}${f.unit ? ` (${f.unit})` : ''}`} error={errors[f.key]} hint={<>{f.live ? <Badge tone="ok">Live</Badge> : <Badge tone="muted">Saved for later</Badge>} {f.help}</>} wide={f.type === 'textarea' || f.type === 'list'}>{input(f)}</Field>
                  ))}
                </div>
              </fieldset>
            )}
            {!canEdit && section.fields.length > 0 && <p className="ad-muted small">Read only for your role.</p>}
          </Panel>
        </div>
      </div>
    </div>
  );
}
