// Staff roles and an explicit permission matrix.
//
// Three layers, kept apart on purpose:
//   1. UI permission      – what a screen shows (nav items, buttons). Convenience only.
//   2. Business permission – `authorize()`, checked by the admin action layer before any
//                            mutation runs. In this frontend-only phase this is the guard.
//   3. Server authorization – the future API re-checks every request with the same
//                            permission names. Nothing here is a security boundary on its
//                            own: anyone with devtools can edit browser storage.

export type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'KITCHEN' | 'BAKER' | 'DELIVERY' | 'SUPPORT';
export const ROLES: Role[] = ['OWNER', 'ADMIN', 'MANAGER', 'KITCHEN', 'BAKER', 'DELIVERY', 'SUPPORT'];

export const PERMISSIONS = [
  'overview.view',
  'orders.view', 'orders.update', 'orders.cancel', 'orders.export',
  'kitchen.view', 'kitchen.update',
  'customCakes.view', 'customCakes.update', 'customCakes.notes',
  'products.view', 'products.edit', 'products.price',
  'cakeBuilder.view', 'cakeBuilder.edit', 'cakeBuilder.price',
  'inventory.view', 'inventory.adjust',
  'customers.view', 'customers.pii', 'customers.edit', 'customers.export',
  'campaigns.view', 'campaigns.edit', 'campaigns.publish',
  'content.view', 'content.edit',
  'media.view', 'media.edit',
  'analytics.view', 'analytics.export',
  'intelligence.view', 'intelligence.approve',
  'automations.view', 'automations.retry',
  'invoices.view', 'invoices.regenerate',
  'finance.refund',
  'staff.view', 'staff.manage',
  'audit.view',
  'settings.view', 'settings.edit',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL = [...PERMISSIONS] as Permission[];
const without = (...drop: Permission[]) => ALL.filter((p) => !drop.includes(p));

/** The matrix. Explicit lists, so a reviewer can read exactly what each role can do. */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: ALL,
  // Everything except staff roles and changing who can do what with money.
  ADMIN: without('staff.manage'),
  MANAGER: [
    'overview.view', 'orders.view', 'orders.update', 'orders.cancel', 'orders.export',
    'kitchen.view', 'kitchen.update', 'customCakes.view', 'customCakes.update', 'customCakes.notes',
    'products.view', 'products.edit', 'cakeBuilder.view', 'cakeBuilder.edit',
    'inventory.view', 'inventory.adjust', 'customers.view', 'customers.pii', 'customers.edit',
    'campaigns.view', 'campaigns.edit', 'content.view', 'content.edit', 'media.view', 'media.edit',
    'analytics.view', 'analytics.export', 'intelligence.view', 'intelligence.approve',
    'automations.view', 'automations.retry', 'invoices.view', 'audit.view', 'settings.view', 'staff.view',
  ],
  KITCHEN: ['overview.view', 'orders.view', 'orders.update', 'kitchen.view', 'kitchen.update', 'customCakes.view', 'customCakes.update', 'customCakes.notes', 'inventory.view'],
  BAKER: ['overview.view', 'kitchen.view', 'kitchen.update', 'customCakes.view', 'customCakes.update', 'customCakes.notes', 'inventory.view'],
  DELIVERY: ['overview.view', 'orders.view', 'orders.update', 'kitchen.view'],
  SUPPORT: ['overview.view', 'orders.view', 'customers.view', 'customers.pii', 'customers.edit', 'invoices.view', 'automations.view', 'automations.retry', 'customCakes.view'],
};

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: 'Owner', ADMIN: 'Admin', MANAGER: 'Manager', KITCHEN: 'Kitchen', BAKER: 'Baker', DELIVERY: 'Delivery', SUPPORT: 'Support',
};

export const ROLE_SUMMARY: Record<Role, string> = {
  OWNER: 'Everything, including staff, settings and money.',
  ADMIN: 'Everything except staff roles.',
  MANAGER: 'Runs the day: orders, kitchen, catalogue, stock, customers, campaigns, analytics.',
  KITCHEN: 'Orders, kitchen board and custom cake production.',
  BAKER: 'Kitchen board and custom cake production sheets.',
  DELIVERY: 'Orders ready to leave and their delivery status.',
  SUPPORT: 'Customers, their orders, invoices and message retries.',
};

/**
 * Staff accounts. The demo seeds one per role, labelled by role: there is no real
 * team roster yet, and none is invented.
 */
export type Staff = { id: string; name: string; role: Role; active: boolean; createdAt: string };

export function seedStaff(now = new Date()): Staff[] {
  return ROLES.map((role) => ({ id: `staff-${role.toLowerCase()}`, name: `${ROLE_LABEL[role]} (demo)`, role, active: true, createdAt: now.toISOString() }));
}

export function can(staff: Pick<Staff, 'role' | 'active'> | null | undefined, permission: Permission): boolean {
  return Boolean(staff && staff.active && ROLE_PERMISSIONS[staff.role]?.includes(permission));
}

export type Authorization = { ok: true } | { ok: false; reason: string };

/** The business-permission check every admin mutation goes through. */
export function authorize(staff: Pick<Staff, 'role' | 'active' | 'name'> | null | undefined, permission: Permission): Authorization {
  if (!staff) return { ok: false, reason: 'Sign in to make changes.' };
  if (!staff.active) return { ok: false, reason: `${staff.name} is deactivated.` };
  if (!can(staff, permission)) return { ok: false, reason: `${ROLE_LABEL[staff.role]} can’t do this (needs ${permission}).` };
  return { ok: true };
}

/**
 * Staff changes that would lock the bakery out are refused: the last active owner
 * can't be demoted or deactivated.
 */
export function validateStaffChange(all: Staff[], next: Staff): Authorization {
  const owners = all.filter((s) => s.role === 'OWNER' && s.active && s.id !== next.id);
  const wasOwner = all.find((s) => s.id === next.id)?.role === 'OWNER';
  if (wasOwner && (next.role !== 'OWNER' || !next.active) && owners.length === 0) return { ok: false, reason: 'Keep at least one active owner.' };
  if (!next.name.trim()) return { ok: false, reason: 'Give the account a name.' };
  return { ok: true };
}

/** Masks a phone number for staff without access to customer details. */
export const maskPhone = (phone: string) => (phone.length >= 4 ? `•••••• ${phone.slice(-4)}` : '••••');
export const maskEmail = (email: string) => {
  const [user, domain] = email.split('@');
  return domain ? `${user.slice(0, 1)}•••@${domain}` : email ? '•••' : '';
};
