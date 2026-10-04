'use client';

import { Fragment, useState } from 'react';
import { Check, Plus, ShieldAlert } from 'lucide-react';
import { useAdmin } from '@/components/admin/admin-provider';
import { Badge, Field, Guard, PageHeader, Panel, dateTime } from '@/components/admin/ui';
import { PERMISSIONS, ROLES, ROLE_LABEL, ROLE_PERMISSIONS, ROLE_SUMMARY, validateStaffChange, type Role, type Staff } from '@/lib/admin/permissions';

const GROUPS = [...new Set(PERMISSIONS.map((p) => p.split('.')[0]))];

export default function StaffPage() {
  return <Guard permission="staff.view"><StaffAdmin /></Guard>;
}

function StaffAdmin() {
  const admin = useAdmin();
  const canManage = admin.can('staff.manage');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('KITCHEN');

  const write = (next: Staff[], action: string, entity: Staff, before: unknown, after: unknown, success: string, reason?: string) => admin.act({
    permission: 'staff.manage', action, entity: { type: 'staff', id: entity.id, label: entity.name }, before, after, reason, run: () => admin.repos!.staff.write(next), success,
  });

  const changeRole = async (s: Staff, to: Role) => {
    const next = { ...s, role: to };
    const v = validateStaffChange(admin.staffList, next);
    if (!v.ok) { admin.toast({ tone: 'error', title: 'Not changed', detail: v.reason }); return; }
    const gained = ROLE_PERMISSIONS[to].filter((p) => !ROLE_PERMISSIONS[s.role].includes(p));
    const lost = ROLE_PERMISSIONS[s.role].filter((p) => !ROLE_PERMISSIONS[to].includes(p));
    const r = await admin.confirm({ title: `Make ${s.name} ${ROLE_LABEL[to]}?`, impact: [ROLE_SUMMARY[to], gained.length ? `Gains ${gained.length}: ${gained.slice(0, 6).join(', ')}${gained.length > 6 ? '…' : ''}` : 'Gains nothing new.', lost.length ? `Loses ${lost.length}: ${lost.slice(0, 6).join(', ')}${lost.length > 6 ? '…' : ''}` : 'Loses nothing.'], confirmLabel: 'Change role', tone: 'primary', reason: 'required' });
    if (!r.ok) return;
    write(admin.staffList.map((x) => (x.id === s.id ? next : x)), 'staff.role.changed', s, { role: s.role }, { role: to }, `${s.name} is now ${ROLE_LABEL[to]}`, r.reason);
  };
  const setActive = async (s: Staff, active: boolean) => {
    const next = { ...s, active };
    const v = validateStaffChange(admin.staffList, next);
    if (!v.ok) { admin.toast({ tone: 'error', title: 'Not changed', detail: v.reason }); return; }
    if (!active && s.id === admin.staff?.id) { admin.toast({ tone: 'error', title: 'You can’t deactivate yourself' }); return; }
    const r = await admin.confirm({ title: `${active ? 'Reactivate' : 'Deactivate'} ${s.name}?`, impact: [active ? 'They can sign in and act again with their role.' : 'They can no longer sign in or change anything. Their past actions stay in the audit log.'], confirmLabel: active ? 'Reactivate' : 'Deactivate', tone: active ? 'primary' : 'danger', reason: 'required' });
    if (!r.ok) return;
    write(admin.staffList.map((x) => (x.id === s.id ? next : x)), active ? 'staff.activated' : 'staff.deactivated', s, { active: s.active }, { active }, `${s.name} ${active ? 'reactivated' : 'deactivated'}`, r.reason);
  };
  const add = () => {
    if (name.trim().length < 2) { admin.toast({ tone: 'error', title: 'Give the account a name' }); return; }
    const s: Staff = { id: `staff-${Date.now().toString(36)}`, name: name.trim(), role, active: true, createdAt: new Date().toISOString() };
    const r = write([...admin.staffList, s], 'staff.created', s, null, { name: s.name, role }, `${s.name} added as ${ROLE_LABEL[role]}`);
    if (r.ok) setName('');
  };

  return (
    <div>
      <PageHeader eyebrow="System" title="Staff" description="Accounts, roles and exactly what each role can do. Only owners change roles." />
      <div className="ad-callout"><ShieldAlert size={15} aria-hidden /><span>Demo accounts, one per role and labelled by role (no real team roster is stored). Permissions are enforced in this browser’s UI and action layer; a real deployment re-checks every request on the server with the same permission names, and sign-in uses real credentials there, never here.</span></div>
      <Panel title="Accounts" actions={<span className="ad-muted small">{admin.staffList.filter((s) => s.active).length} active</span>}>
        <div className="ad-table-wrap"><table className="table ad-cards">
          <thead><tr><th>Name</th><th>Role</th><th>What they can do</th><th>Status</th><th>Added</th><th /></tr></thead>
          <tbody>{admin.staffList.map((s) => (
            <tr key={s.id}>
              <td data-label="Name"><strong>{s.name}</strong>{s.id === admin.staff?.id && <span className="ad-sub">signed in</span>}</td>
              <td data-label="Role">{canManage ? <select className="ad-select" value={s.role} onChange={(e) => changeRole(s, e.target.value as Role)} aria-label={`Role for ${s.name}`}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select> : ROLE_LABEL[s.role]}</td>
              <td data-label="Can" className="ad-muted">{ROLE_SUMMARY[s.role]}</td>
              <td data-label="Status">{s.active ? <Badge tone="ok">Active</Badge> : <Badge tone="muted">Deactivated</Badge>}</td>
              <td data-label="Added">{dateTime(s.createdAt)}</td>
              <td data-label="" className="cell-actions">
                {s.active && s.id !== admin.staff?.id && <button type="button" className="ad-btn ad-btn-sm" onClick={() => admin.switchStaff(s.id)}>Sign in as</button>}
                {canManage && <button type="button" className="ad-btn ad-btn-sm ad-btn-ghost" onClick={() => setActive(s, !s.active)}>{s.active ? 'Deactivate' : 'Reactivate'}</button>}
              </td>
            </tr>
          ))}</tbody>
        </table></div>
        {canManage && (
          <div className="ad-row" style={{ marginTop: 10, alignItems: 'flex-end' }}>
            <Field label="New account name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Morning baker" /></Field>
            <Field label="Role"><select value={role} onChange={(e) => setRole(e.target.value as Role)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
            <button type="button" className="ad-btn ad-btn-primary" onClick={add}><Plus size={13} /> Add account</button>
          </div>
        )}
      </Panel>
      <Panel title="Permission matrix">
        <div className="ad-table-wrap"><table className="table ad-matrix">
          <thead><tr><th>Permission</th>{ROLES.map((r) => <th key={r}>{ROLE_LABEL[r]}</th>)}</tr></thead>
          <tbody>{GROUPS.map((g) => (
            <Fragment key={g}>{PERMISSIONS.filter((p) => p.startsWith(`${g}.`)).map((p, i) => (
              <tr key={p} className={i === 0 ? 'ad-matrix-first' : ''}>
                <td className="ad-mono">{p}</td>
                {ROLES.map((r) => <td key={r}>{ROLE_PERMISSIONS[r].includes(p) ? <span aria-label="allowed"><Check size={13} aria-hidden /></span> : <span className="ad-sr">not allowed</span>}</td>)}
              </tr>
            ))}</Fragment>
          ))}</tbody>
        </table></div>
      </Panel>
    </div>
  );
}
