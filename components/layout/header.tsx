'use client';

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { Menu, ShoppingBag, UserRound, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CartCount } from '@/components/motion/cart-count';
import { useStore } from '@/components/providers/store-provider';
import { HERO } from '@/lib/motion/choreography';
import { EASE } from '@/lib/motion/transitions';
import { site } from '@/data/site';

const NAV = [
  { href: '/menu', label: 'Menu' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Visit' },
];

const DARK_ROUTES = ['/cart', '/order', '/account'];

export function Header() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const { totals, ready } = useStore();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dark = DARK_ROUTES.some((route) => pathname.startsWith(route));
  const count = ready ? totals.itemCount : 0;

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`) || (href === '/menu' && pathname.startsWith('/product'));

  return (
    <>
      <motion.header
        className={`site-header ${dark ? 'is-dark' : ''}`}
        initial={reduce ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: HERO.nav, duration: 0.5, ease: EASE }}
      >
        <div className="header-inner">
          <Link href="/" className="wordmark" aria-label="Tresor, home">TRESOR</Link>
          <LayoutGroup id="nav">
            <nav className="primary-nav" aria-label="Primary">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className={isActive(item.href) ? 'is-active' : ''} aria-current={isActive(item.href) ? 'page' : undefined}>
                  {item.label}
                  {isActive(item.href) && <motion.span className="nav-underline" layoutId="nav-underline" transition={{ duration: 0.3, ease: EASE }} />}
                </Link>
              ))}
            </nav>
          </LayoutGroup>
          <div className="header-actions">
            <Link href="/menu" className="btn btn-primary btn-sm header-order">Order</Link>
            <Link href="/account" className="icon-link" aria-label="Your account"><UserRound size={18} strokeWidth={1.5} /></Link>
            <Link href="/cart" className="bag-link" data-bag-target aria-label={`Your bag, ${count} ${count === 1 ? 'item' : 'items'}`}>
              <ShoppingBag size={18} strokeWidth={1.5} />
              <CartCount count={count} />
            </Link>
            <button className="icon-link menu-toggle" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}>
              <Menu size={20} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="mobile-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={reduce ? { opacity: 0 } : { clipPath: 'inset(0% 0% 100% 0%)' }}
            animate={reduce ? { opacity: 1 } : { clipPath: 'inset(0% 0% 0% 0%)' }}
            exit={reduce ? { opacity: 0 } : { clipPath: 'inset(0% 0% 100% 0%)' }}
            transition={{ duration: 0.36, ease: EASE }}
          >
            <div className="sheet-top">
              <span className="wordmark">TRESOR</span>
              <button ref={closeRef} className="icon-link" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} strokeWidth={1.5} /></button>
            </div>
            <nav className="sheet-nav" aria-label="Mobile">
              {[{ href: '/', label: 'Home' }, ...NAV, { href: '/account', label: 'Account' }].map((item, i) => (
                <motion.div key={item.href} initial={reduce ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 + i * 0.05, duration: 0.4, ease: EASE }}>
                  <Link href={item.href} className={isActive(item.href) ? 'is-active' : ''}>{item.label}</Link>
                </motion.div>
              ))}
            </nav>
            <div className="sheet-foot">
              <span className="eyebrow">{site.neighbourhood} · {site.city}</span>
              <span>{site.hours.open} — {site.hours.close}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
