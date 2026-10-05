'use client';

// Admin UI kit: dense, quiet, fast. Status is always icon + text + colour (never
// colour alone). Motion is functional only (drawer slide, 150–250 ms), and off for
// reduced motion via CSS.

import Link from 'next/link';
import type { Route } from 'next';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  AlertOctagon, AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ChevronLeft, ChevronRight, Circle, CircleDashed, Clock, Lock,
  PackageCheck, PauseCircle, RotateCw, Truck, X, XCircle,
} from 'lucide-react';
import { STATUS_LABEL, type OrderStatus, type PaymentStatus } from '@/lib/orders';
import type { StockLevel } from '@/lib/inventory';
import type { DueState, Priority } from '@/lib/admin/order-ops';
import type { Permission } from '@/lib/admin/permissions';
import { useAdmin } from './admin-provider';
import { useMediaVariant } from '@/lib/media-variants';

export const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
export const clock = (iso: string | Date) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
export const dateTime = (iso: string | Date) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const dayLabel = (d: Date, now: Date) => {
  const a = new Date(d); a.setHours(0, 0, 0, 0);
  const b = new Date(now); b.setHours(0, 0, 0, 0);
  const diff = Math.round((a.getTime() - b.getTime()) / 86400000);
  return diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};
export const ago = (iso: string, now: Date) => {
  const m = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : `${Math.floor(m / 1440)} d ago`;
};

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="ad-page-head">
      <div>
        {eyebrow && <div className="ad-eyebrow">{eyebrow}</div>}
        <h1 className="ad-title">{title}</h1>
        {description && <p className="ad-desc">{description}</p>}
      </div>
      {actions && <div className="ad-page-actions">{actions}</div>}
    </header>
  );
}

type Tone = 'neutral' | 'info' | 'ok' | 'warn' | 'bad' | 'muted';
export function Badge({ tone = 'neutral', icon, children, title }: { tone?: Tone; icon?: ReactNode; children: ReactNode; title?: string }) {
  return <span className={`ad-badge ad-tone-${tone}`} title={title}>{icon}{children}</span>;
}

const STATUS_META: Record<OrderStatus, { tone: Tone; icon: ReactNode }> = {
  NEW: { tone: 'info', icon: <CircleDashed size={12} aria-hidden /> },
  CONFIRMED: { tone: 'info', icon: <Circle size={12} aria-hidden /> },
  PREPARING: { tone: 'warn', icon: <Clock size={12} aria-hidden /> },
  READY: { tone: 'ok', icon: <PackageCheck size={12} aria-hidden /> },
  OUT_FOR_DELIVERY: { tone: 'neutral', icon: <Truck size={12} aria-hidden /> },
  DELIVERED: { tone: 'muted', icon: <CheckCircle2 size={12} aria-hidden /> },
  CANCELLED: { tone: 'bad', icon: <XCircle size={12} aria-hidden /> },
};
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const m = STATUS_META[status];
  return <Badge tone={m.tone} icon={m.icon}>{STATUS_LABEL[status]}</Badge>;
}

const PAY_META: Record<PaymentStatus, { tone: Tone; label: string }> = {
  PAID: { tone: 'ok', label: 'Paid' }, DUE: { tone: 'warn', label: 'Due (COD)' }, REFUND_PENDING: { tone: 'bad', label: 'Refund pending' },
  REFUNDED: { tone: 'muted', label: 'Refunded' }, VOID: { tone: 'muted', label: 'Void' }, FAILED: { tone: 'bad', label: 'Failed' },
};
export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const m = PAY_META[status];
  return <Badge tone={m.tone} icon={m.tone === 'bad' ? <AlertTriangle size={12} aria-hidden /> : m.tone === 'ok' ? <CheckCircle2 size={12} aria-hidden /> : <Circle size={12} aria-hidden />}>{m.label}</Badge>;
}

export function StockBadge({ level }: { level: StockLevel }) {
  const m: Record<StockLevel, [Tone, ReactNode, string]> = {
    HEALTHY: ['ok', <CheckCircle2 key="i" size={12} aria-hidden />, 'Healthy'],
    LOW: ['warn', <AlertTriangle key="i" size={12} aria-hidden />, 'Low'],
    CRITICAL: ['bad', <AlertOctagon key="i" size={12} aria-hidden />, 'Critical'],
    OUT: ['bad', <XCircle key="i" size={12} aria-hidden />, 'Out'],
  };
  const [tone, icon, label] = m[level];
  return <Badge tone={tone} icon={icon}>{label}</Badge>;
}

export function PriorityBadge({ priority, due }: { priority: Priority; due?: DueState }) {
  if (priority === 'URGENT') return <Badge tone="bad" icon={<AlertOctagon size={12} aria-hidden />}>{due === 'late' ? 'Late' : 'Urgent'}</Badge>;
  if (priority === 'HIGH') return <Badge tone="warn" icon={<ArrowUp size={12} aria-hidden />}>High</Badge>;
  return <Badge tone="muted">Normal</Badge>;
}

export function JobBadge({ status }: { status: 'requested' | 'retrying' | 'succeeded' | 'failed' }) {
  if (status === 'succeeded') return <Badge tone="ok" icon={<CheckCircle2 size={12} aria-hidden />}>Success</Badge>;
  if (status === 'failed') return <Badge tone="bad" icon={<XCircle size={12} aria-hidden />}>Failed</Badge>;
  if (status === 'retrying') return <Badge tone="warn" icon={<RotateCw size={12} aria-hidden />}>Retrying</Badge>;
  return <Badge tone="info" icon={<Clock size={12} aria-hidden />}>Running</Badge>;
}

export function PausedBadge() { return <Badge tone="warn" icon={<PauseCircle size={12} aria-hidden />}>Paused</Badge>; }

export function Panel({ title, actions, children, className = '', id }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`ad-panel ${className}`} id={id} aria-labelledby={title && id ? `${id}-title` : undefined}>
      {(title || actions) && <div className="ad-panel-head">{title && <h2 id={id ? `${id}-title` : undefined}>{title}</h2>}{actions && <div className="ad-panel-actions">{actions}</div>}</div>}
      {children}
    </section>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="ad-empty"><p>{children}</p>{action}</div>;
}

export function Kpi({ label, value, meta, tone, href }: { label: string; value: ReactNode; meta?: ReactNode; tone?: 'bad' | 'warn' | 'ok'; href?: string }) {
  const body = <><div className="ad-kpi-label">{label}</div><div className="ad-kpi-value">{value}</div>{meta && <div className="ad-kpi-meta">{meta}</div>}</>;
  return href ? <Link href={href as Route} className={`ad-kpi ${tone ? `ad-kpi-${tone}` : ''}`}>{body}</Link> : <div className={`ad-kpi ${tone ? `ad-kpi-${tone}` : ''}`}>{body}</div>;
}

export function Chips<T extends string>({ items, value, onChange, counts, label }: { items: { id: T; label: string }[]; value: T; onChange: (v: T) => void; counts?: Partial<Record<T, number>>; label: string }) {
  return (
    <div className="ad-chips" role="group" aria-label={label}>
      {items.map((i) => (
        <button key={i.id} type="button" className={`ad-chip ${value === i.id ? 'is-on' : ''}`} aria-pressed={value === i.id} onClick={() => onChange(i.id)}>
          {i.label}{counts && counts[i.id] !== undefined && <span className="ad-chip-count">{counts[i.id]}</span>}
        </button>
      ))}
    </div>
  );
}

export function SearchField({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <div className="ad-search">
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} />
      {value && <button type="button" onClick={() => onChange('')} aria-label="Clear search"><X size={14} /></button>}
    </div>
  );
}

export function SortHeader<T extends string>({ id, label, sort, onSort, className }: { id: T; label: string; sort: { key: T; dir: 'asc' | 'desc' }; onSort: (key: T) => void; className?: string }) {
  const active = sort.key === id;
  return (
    <th className={className} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="ad-sort" onClick={() => onSort(id)}>
        {label}{active ? (sort.dir === 'asc' ? <ArrowUp size={11} aria-hidden /> : <ArrowDown size={11} aria-hidden />) : null}
      </button>
    </th>
  );
}

export function Pager({ page, pages, total, onPage, label = 'results' }: { page: number; pages: number; total: number; onPage: (p: number) => void; label?: string }) {
  if (pages <= 1) return <div className="ad-pager"><span>{total} {label}</span></div>;
  return (
    <nav className="ad-pager" aria-label="Pages">
      <span>{total} {label} · page {page} of {pages}</span>
      <button type="button" className="ad-btn ad-btn-sm" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft size={14} /></button>
      <button type="button" className="ad-btn ad-btn-sm" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page"><ChevronRight size={14} /></button>
    </nav>
  );
}

/** Side panel on desktop, bottom sheet on phones. Esc closes; focus returns to what opened it. */
export function Drawer({ open, onClose, title, subtitle, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.ad-modal')) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="ad-drawer-layer">
      <div className="ad-drawer-backdrop" onClick={onClose} aria-hidden />
      <div className={`ad-drawer ${wide ? 'is-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} ref={ref} tabIndex={-1}>
        <div className="ad-drawer-head">
          <div><h2 id={id}>{title}</h2>{subtitle && <div className="ad-drawer-sub">{subtitle}</div>}</div>
          <button type="button" className="ad-icon-btn" onClick={onClose} aria-label="Close panel"><X size={18} /></button>
        </div>
        <div className="ad-drawer-body">{children}</div>
        {footer && <div className="ad-drawer-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, error, hint, children, wide }: { label: string; error?: string; hint?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`ad-field ${wide ? 'is-wide' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && !error && <small>{hint}</small>}
      {error && <em className="ad-error" role="alert">{error}</em>}
    </label>
  );
}

export function Tabs<T extends string>({ items, value, onChange, label }: { items: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="ad-tabs" role="tablist" aria-label={label}>
      {items.map((i) => (
        <button key={i.id} type="button" role="tab" aria-selected={value === i.id} className={value === i.id ? 'is-on' : ''} onClick={() => onChange(i.id)}>
          {i.label}{i.count !== undefined && <span className="ad-chip-count">{i.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Renders children only for staff with the permission; otherwise says why. The action layer re-checks anyway. */
export function Guard({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can, ready, staff } = useAdmin();
  if (!ready) return <div className="ad-loading" aria-busy="true">Loading…</div>;
  if (!can(permission)) {
    return (
      <div className="ad-noaccess">
        <Lock size={22} aria-hidden />
        <h1>No access</h1>
        <p>{staff ? `${staff.name} doesn’t have “${permission}”.` : 'Sign in to continue.'} Switch staff from the top bar, or ask an owner to change your role.</p>
      </div>
    );
  }
  return <>{children}</>;
}

/** Tiny inline bar chart (SVG, no library). */
export function Spark({ values, label, height = 36 }: { values: number[]; label: string; height?: number }) {
  const max = Math.max(1, ...values);
  const w = 100 / Math.max(1, values.length);
  return (
    <svg className="ad-spark" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" role="img" aria-label={label}>
      {values.map((v, i) => <rect key={i} x={i * w + w * 0.15} width={w * 0.7} y={height - (v / max) * (height - 2)} height={(v / max) * (height - 2)} rx="1" />)}
    </svg>
  );
}

export function Meter({ value, max, tone }: { value: number; max: number; tone?: Tone }) {
  return <span className={`ad-meter ad-tone-${tone ?? 'neutral'}`} role="presentation"><span style={{ width: `${Math.max(2, Math.min(100, (value / Math.max(max, 1e-9)) * 100))}%` }} /></span>;
}

/**
 * One URL query parameter as state (deep links like ?filter=READY or ?o=TRS-1048).
 * Read after mount and written with replaceState, so it needs no Suspense boundary.
 */
export function useUrlParam(name: string, fallback = ''): [string, (v: string) => void] {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    const read = () => setValue(new URLSearchParams(window.location.search).get(name) ?? fallback);
    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, [name, fallback]);
  const set = useCallback((v: string) => {
    setValue(v);
    const url = new URL(window.location.href);
    if (v && v !== fallback) url.searchParams.set(name, v); else url.searchParams.delete(name);
    window.history.replaceState(window.history.state, '', url.toString());
  }, [name, fallback]);
  return [value, set];
}

/** A small product or media thumbnail for tables: the 160 px variant when it exists, else the tone swatch. */
export function Thumb({ src, tone, alt, size = 40 }: { src?: string; tone: [string, string]; alt: string; size?: number }) {
  const variant = useMediaVariant(src);
  const [failed, setFailed] = useState(false);
  return (
    <span className="ad-thumb-sm" style={{ width: size, height: size, background: `linear-gradient(145deg, ${tone[0]}, ${tone[1]})` }} aria-hidden={variant ? undefined : true}>
      {variant && !failed && <img src={variant.thumb} alt={alt} width={size} height={size} loading="lazy" decoding="async" onError={() => setFailed(true)} />}
    </span>
  );
}
