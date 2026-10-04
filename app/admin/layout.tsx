'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { BarChart3, Boxes, ClipboardList, ChefHat, LayoutDashboard, PackageSearch, Settings, Users } from 'lucide-react';

const nav: { href: Route; label: string; icon: typeof LayoutDashboard }[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { href: '/admin/kitchen', label: 'Kitchen', icon: ChefHat },
  { href: '/admin/products', label: 'Products', icon: PackageSearch },
  { href: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
];

// Not built yet: shown so the roadmap is visible, but not clickable.
const later = [
  { label: 'Customers', icon: Users },
  { label: 'Settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div className="admin-brand">Tresor</div>
        <nav className="admin-nav" aria-label="Admin">
          {nav.map((n) => {
            const I = n.icon;
            const active = n.href === '/admin' ? pathname === '/admin' : pathname.startsWith(n.href);
            return <Link href={n.href} key={n.label} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}><I size={17} /><span>{n.label}</span></Link>;
          })}
          {later.map((n) => {
            const I = n.icon;
            return <span key={n.label} className="admin-nav-later" title="Coming later"><I size={17} /><span>{n.label}</span><em>soon</em></span>;
          })}
        </nav>
        <p className="admin-note">Demo data lives in this browser. Orders placed in the shop appear here.</p>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
