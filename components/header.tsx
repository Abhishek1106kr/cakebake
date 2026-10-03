'use client';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useStore } from './store';

export function Header() {
  const pathname = usePathname();
  const { cart } = useStore();
  const active = pathname.startsWith('/menu') || pathname.startsWith('/product');
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="wordmark" aria-label="Tresor home">TRESOR</Link>
        <div className="header-spacer" />
        <nav className="nav" aria-label="Primary navigation">
          <Link className={active ? 'active' : ''} href="/menu">MENU</Link>
          <Link className={pathname.startsWith('/about') ? 'active' : ''} href="/about">ABOUT</Link>
          <Link className={pathname.startsWith('/contact') ? 'active' : ''} href="/contact">CONTACT</Link>
        </nav>
        <Link href="/menu" className="btn btn-primary">ORDER</Link>
        <Link href="/cart" className="header-cart" aria-label={`Cart with ${cart.length} product types`}>
          <ShoppingBag size={17} strokeWidth={1.6} />
          <span>{cart.length.toString().padStart(2, '0')}</span>
        </Link>
      </div>
    </header>
  );
}
