'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BarChart3, Bell, Bot, Boxes, BrainCircuit, CakeSlice, ChefHat, ClipboardList, FileText, Image as ImageIcon, LayoutDashboard, LayoutTemplate,
  Megaphone, Menu, PackageSearch, ScrollText, Search, Settings, Shield, SlidersHorizontal, Store, Users, X, Check, CheckCheck,
} from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { AdminProvider, useAdmin } from './admin-provider';
import { ago } from './ui';
import { adminSearch, TYPE_LABEL, type SearchResult } from '@/lib/admin/search';
import { KIND_LABEL } from '@/lib/admin/attention';
import { ROLE_LABEL, type Permission } from '@/lib/admin/permissions';

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; permission: Permission };
const NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Today', items: [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard, permission: 'overview.view' },
    { href: '/admin/orders', label: 'Orders', icon: ClipboardList, permission: 'orders.view' },
    { href: '/admin/kitchen', label: 'Kitchen', icon: ChefHat, permission: 'kitchen.view' },
    { href: '/admin/custom-cakes', label: 'Custom Cakes', icon: CakeSlice, permission: 'customCakes.view' },
  ] },
  { group: 'Catalogue', items: [
    { href: '/admin/products', label: 'Products', icon: PackageSearch, permission: 'products.view' },
    { href: '/admin/cake-builder', label: 'Cake Builder', icon: SlidersHorizontal, permission: 'cakeBuilder.view' },
    { href: '/admin/inventory', label: 'Inventory', icon: Boxes, permission: 'inventory.view' },
  ] },
  { group: 'Customers & growth', items: [
    { href: '/admin/customers', label: 'Customers', icon: Users, permission: 'customers.view' },
    { href: '/admin/campaigns', label: 'Campaigns', icon: Megaphone, permission: 'campaigns.view' },
    { href: '/admin/content', label: 'Content', icon: LayoutTemplate, permission: 'content.view' },
    { href: '/admin/media', label: 'Media', icon: ImageIcon, permission: 'media.view' },
  ] },
  { group: 'Insight', items: [
    { href: '/admin/analytics', label: 'Analytics', icon: BarChart3, permission: 'analytics.view' },
    { href: '/admin/intelligence', label: 'Intelligence', icon: BrainCircuit, permission: 'intelligence.view' },
  ] },
  { group: 'System', items: [
    { href: '/admin/automations', label: 'Automations', icon: Bot, permission: 'automations.view' },
    { href: '/admin/invoices', label: 'Invoices', icon: FileText, permission: 'invoices.view' },
    { href: '/admin/staff', label: 'Staff', icon: Shield, permission: 'staff.view' },
    { href: '/admin/audit', label: 'Audit Log', icon: ScrollText, permission: 'audit.view' },
    { href: '/admin/settings', label: 'Settings', icon: Settings, permission: 'settings.view' },
  ] },
];
const ALL_ITEMS = NAV.flatMap((g) => g.items);

const isActive = (href: string, path: string) => (href === '/admin' ? path === '/admin' : path === href || path.startsWith(`${href}/`));

export function AdminShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <AdminProvider>
      <Shell className={className}>{children}</Shell>
    </AdminProvider>
  );
}

function Shell({ children, className }: { children: ReactNode; className?: string }) {
  const pathname = usePathname() ?? '/admin';
  const admin = useAdmin();
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  useEffect(() => { setNavOpen(false); setBellOpen(false); }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable]');
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    document.body.classList.toggle('ad-locked', navOpen);
    return () => document.body.classList.remove('ad-locked');
  }, [navOpen]);

  const current = ALL_ITEMS.find((i) => isActive(i.href, pathname));
  const sub = current && pathname !== current.href ? decodeURIComponent(pathname.slice(current.href.length + 1)) : null;

  return (
    <div className={`ad-shell ${className ?? ''}`}>
      <a href="#ad-main" className="ad-skip">Skip to content</a>
      <aside className={`ad-side ${navOpen ? 'is-open' : ''}`} aria-label="Admin navigation">
        <div className="ad-brand"><Link href="/admin">Tresor</Link><span>Command centre</span>
          <button type="button" className="ad-icon-btn ad-side-close" onClick={() => setNavOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <nav className="ad-nav">
          {NAV.map((g) => {
            const items = g.items.filter((i) => admin.can(i.permission));
            if (!items.length) return null;
            return (
              <div key={g.group} className="ad-nav-group">
                <div className="ad-nav-label">{g.group}</div>
                {items.map((n) => {
                  const I = n.icon;
                  const active = isActive(n.href, pathname);
                  const badge = n.href === '/admin/automations' ? admin.automation.jobs.filter((j) => j.status === 'failed').length : 0;
                  return (
                    <Link key={n.href} href={n.href as Route} className={active ? 'is-active' : ''} aria-current={active ? 'page' : undefined}>
                      <I size={16} aria-hidden /><span>{n.label}</span>{badge > 0 && <b className="ad-nav-badge" aria-label={`${badge} failed`}>{badge}</b>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="ad-side-foot">
          <Link href="/" className="ad-side-shop"><Store size={14} aria-hidden /> View the shop</Link>
          <p>Demo data lives in this browser. Orders placed in the shop appear here live.</p>
        </div>
      </aside>
      {navOpen && <div className="ad-side-backdrop" onClick={() => setNavOpen(false)} aria-hidden />}

      <div className="ad-body">
        <header className="ad-top">
          <button type="button" className="ad-icon-btn ad-menu-btn" onClick={() => setNavOpen(true)} aria-label="Open navigation" aria-expanded={navOpen}><Menu size={18} /></button>
          <nav className="ad-crumbs" aria-label="Breadcrumb">
            <Link href="/admin">Admin</Link>
            {current && current.href !== '/admin' && <><span aria-hidden>/</span>{sub ? <Link href={current.href as Route}>{current.label}</Link> : <span aria-current="page">{current.label}</span>}</>}
            {sub && <><span aria-hidden>/</span><span aria-current="page">{sub}</span></>}
          </nav>
          <button type="button" className="ad-searchbtn" onClick={() => setSearchOpen(true)} aria-label="Search orders, customers, products and more">
            <Search size={15} aria-hidden /><span>Search orders, customers, products…</span><kbd>⌘K</kbd>
          </button>
          <div className="ad-top-right">
            <Link href="/" className="ad-top-shop" aria-label="View the shop"><Store size={15} aria-hidden /><span>View shop</span></Link>
            <div className="ad-bell-wrap">
              <button type="button" className="ad-icon-btn ad-bell" onClick={() => setBellOpen((o) => !o)} aria-expanded={bellOpen} aria-label={`Notifications, ${admin.unread} unread`}>
                <Bell size={18} aria-hidden />{admin.unread > 0 && <b>{admin.unread > 99 ? '99+' : admin.unread}</b>}
              </button>
              {bellOpen && <NotificationPanel onClose={() => setBellOpen(false)} />}
            </div>
            <StaffSwitcher />
          </div>
        </header>
        <main id="ad-main" className="ad-main" tabIndex={-1}>{children}</main>
      </div>

      {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} />}
      <div className="ad-toasts" aria-live="polite">
        {admin.toasts.map((t) => (
          <div key={t.id} className={`ad-toast ad-toast-${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            <div><strong>{t.title}</strong>{t.detail && <p>{t.detail}</p>}</div>
            {t.action && <button type="button" className="ad-btn ad-btn-sm" onClick={() => { t.action!.run(); admin.dismissToast(t.id); }}>{t.action.label}</button>}
            <button type="button" className="ad-icon-btn" onClick={() => admin.dismissToast(t.id)} aria-label="Dismiss"><X size={14} /></button>
          </div>
        ))}
      </div>
      <div className="ad-sr" role="status" aria-live="assertive">{admin.liveMessage}</div>
    </div>
  );
}

function StaffSwitcher() {
  const { staff, staffList, switchStaff } = useAdmin();
  if (!staff) return null;
  return (
    <label className="ad-staff" title="Demo sign-in: switch to see what each role can do">
      <span className="ad-avatar" aria-hidden>{staff.role.slice(0, 1)}</span>
      <span className="ad-sr">Signed in as</span>
      <select value={staff.id} onChange={(e) => switchStaff(e.target.value)} aria-label="Signed in as (demo staff switcher)">
        {staffList.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name} · {ROLE_LABEL[s.role]}</option>)}
      </select>
    </label>
  );
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { attention, setAttentionState, markAllRead, now } = useAdmin();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest('.ad-bell')) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [onClose]);
  return (
    <div className="ad-popover" ref={ref} role="dialog" aria-label="Notifications">
      <div className="ad-popover-head"><strong>Needs attention</strong><button type="button" className="ad-link" onClick={markAllRead}><CheckCheck size={14} aria-hidden /> Mark all read</button></div>
      {attention.length === 0 ? <p className="ad-muted ad-pad">All clear. Nothing needs you right now.</p> : (
        <ul className="ad-notes">
          {attention.slice(0, 40).map((a) => (
            <li key={a.id} className={`ad-note ad-sev-${a.severity} ${a.state === 'UNREAD' ? 'is-unread' : ''}`}>
              <button type="button" className="ad-note-main" onClick={() => { setAttentionState([a.id], 'READ'); router.push(a.href as Route); onClose(); }}>
                <span className="ad-note-kind">{KIND_LABEL[a.kind]}{a.state === 'UNREAD' && <span className="ad-sr"> (unread)</span>}</span>
                <strong>{a.title}</strong>
                <span className="ad-note-detail">{a.detail}</span>
                <span className="ad-note-time">{ago(a.at, now)}</span>
              </button>
              <button type="button" className="ad-icon-btn" onClick={() => setAttentionState([a.id], 'RESOLVED')} aria-label={`Resolve: ${a.title}`} title="Resolve"><Check size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SearchPalette({ onClose }: { onClose: () => void }) {
  const admin = useAdmin();
  const { orders, inventory } = useStore();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const results = useMemo<SearchResult[]>(() => adminSearch(q, {
    orders, customers: admin.customers, catalog: admin.catalog, inventory, invoices: admin.automation.invoices, campaigns: admin.campaigns, audit: admin.audit, attention: admin.attention,
  }, admin.staff), [q, orders, inventory, admin.customers, admin.catalog, admin.automation.invoices, admin.campaigns, admin.audit, admin.attention, admin.staff]);
  useEffect(() => { setIndex(0); }, [q]);
  const go = (r: SearchResult) => { router.push(r.href as Route); onClose(); };
  const pages = ALL_ITEMS.filter((i) => admin.can(i.permission) && q.trim().length >= 1 && i.label.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="ad-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ad-palette" role="dialog" aria-modal="true" aria-label="Search">
        <div className="ad-palette-input">
          <Search size={16} aria-hidden />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="TRS-1048, a name, a phone, a product, an ingredient…" aria-label="Search" role="combobox" aria-expanded={results.length > 0} aria-controls="ad-palette-list" aria-activedescendant={results[index] ? `ad-r-${index}` : undefined}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(results.length - 1, i + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
              if (e.key === 'Enter') { if (results[index]) go(results[index]); else if (pages[0]) { router.push(pages[0].href as Route); onClose(); } }
            }} />
          <kbd>Esc</kbd>
        </div>
        {pages.length > 0 && <div className="ad-palette-pages">{pages.map((p) => <Link key={p.href} href={p.href as Route} onClick={onClose}>Go to {p.label}</Link>)}</div>}
        {q.trim().length >= 2 && results.length === 0 && <p className="ad-muted ad-pad">Nothing matches “{q}”.</p>}
        <ul id="ad-palette-list" role="listbox" className="ad-palette-list">
          {results.map((r, i) => (
            <li key={`${r.type}:${r.id}`} id={`ad-r-${i}`} role="option" aria-selected={i === index} className={i === index ? 'is-on' : ''} onMouseEnter={() => setIndex(i)} onClick={() => go(r)}>
              <span className="ad-palette-type">{TYPE_LABEL[r.type]}</span><strong>{r.title}</strong><span className="ad-palette-sub">{r.subtitle}</span>
            </li>
          ))}
        </ul>
        {q.trim().length < 2 && <p className="ad-muted ad-pad small">Search runs locally over this browser’s data. Customer phone and email match only for staff allowed to see them.</p>}
      </div>
    </div>
  );
}
