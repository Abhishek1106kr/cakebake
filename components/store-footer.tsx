import Link from 'next/link';
import { ArrowUpRight, Instagram, MapPin } from 'lucide-react';
import { ExternalOrderButtons } from './external-order-buttons';

export function StoreFooter() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand"><div className="logo">Tresor<span>•</span></div><p>Laminated by hand, baked every morning, and cakes made to order in Indiranagar.</p><div className="footer-socials"><a href="#" aria-label="Instagram"><Instagram size={16}/></a><a href="#" aria-label="Location"><MapPin size={16}/></a></div></div>
          <div className="footer-links-col"><div className="eyebrow">Explore</div><Link href="/shop">Menu</Link><Link href="/#story">Our story</Link><Link href="/track-order">Track order</Link><Link href="/contact">Contact</Link></div>
          <div className="footer-links-col"><div className="eyebrow">Order elsewhere</div><ExternalOrderButtons compact/><span className="small muted">For delivery options not routed through Tresor checkout.</span></div>
          <div className="footer-links-col"><div className="eyebrow">Visit</div><span>Indiranagar, Bengaluru</span><span>Mon–Sun · 8:00–22:00</span><a href="mailto:hello@tresor.cafe">hello@tresor.cafe <ArrowUpRight size={13}/></a></div>
        </div>
        <div className="footer-bottom"><span>© 2026 Tresor Bakery</span><span>Built for fast ordering without the rushed feeling.</span><Link href="/admin" className="footer-staff">Staff admin <ArrowUpRight size={12}/></Link></div>
      </div>
    </footer>
  );
}
