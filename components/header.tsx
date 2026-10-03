'use client';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { LayoutGroup, motion } from 'framer-motion';
import { useStore } from './store';
import { CartCount } from './motion';
import { EASE } from '@/lib/motion';

const NAV = [
  { href: '/menu', label: 'MENU', match: ['/menu', '/product'] },
  { href: '/customize-cake', label: 'CUSTOMIZE CAKE', match: ['/customize-cake'] },
  { href: '/about', label: 'ABOUT', match: ['/about'] },
  { href: '/contact', label: 'CONTACT', match: ['/contact'] },
];

export function Header() {
  const pathname = usePathname();
  const { itemCount, ready } = useStore();
  const count = ready ? itemCount : 0;
  return (
    <motion.header className="site-header" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5, ease: EASE }}>
      <div className="header-inner">
        <Link href="/" className="wordmark" aria-label="Tresor home">TRESOR</Link>
        <div className="header-spacer" />
        <LayoutGroup id="nav">
          <nav className="nav" aria-label="Primary navigation">
            {NAV.map((item) => {
              const active = item.match.some((m) => pathname.startsWith(m));
              return (
                <Link key={item.href} className={active ? 'active' : ''} href={item.href} aria-current={active ? 'page' : undefined}>
                  {item.label}
                  {active && <motion.span className="nav-underline" layoutId="nav-underline" transition={{ duration: 0.3, ease: EASE }} />}
                </Link>
              );
            })}
          </nav>
        </LayoutGroup>
        <Link href="/menu" className="btn btn-primary">ORDER</Link>
        <Link href="/account" className="header-account">ACCOUNT</Link>
        <Link href="/cart" className="header-cart" aria-label={`Bag, ${count} ${count === 1 ? 'item' : 'items'}`}>
          <ShoppingBag size={17} strokeWidth={1.6} />
          <CartCount count={count} />
        </Link>
      </div>
    </motion.header>
  );
}
