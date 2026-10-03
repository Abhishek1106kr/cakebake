import Link from 'next/link';
import { OrderElsewhere } from '@/components/external/order-elsewhere';
import { site } from '@/data/site';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="wordmark">TRESOR</span>
          <p>{site.tagline}</p>
        </div>
        <nav className="footer-nav" aria-label="Footer">
          <Link href="/menu">Menu</Link>
          <Link href="/about">The house</Link>
          <Link href="/contact">Visit</Link>
          <Link href="/account">Account</Link>
        </nav>
        <div className="footer-visit">
          <span className="eyebrow">{site.neighbourhood} · {site.city}</span>
          <span>{site.hours.open} — {site.hours.close} · {site.hours.days}</span>
          <OrderElsewhere compact />
        </div>
      </div>
      <div className="footer-base">
        <span>© {new Date().getFullYear()} Tresor · {site.city}</span>
        <span>Prototype: payments on this site are simulated and no money is taken.</span>
      </div>
    </footer>
  );
}
