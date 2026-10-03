'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { ProductCard } from '@/components/product-card';
import { products } from '@/lib/products';
import { Reveal } from '@/components/animations';

export default function HomePage() {
  const featured = [products[0], products[1], products[2]];
  return <main className="page-shell">
    <section className="home-hero page">
      <aside className="hero-side" aria-label="Tresor information">
        <div className="display-side">TRESOR</div>
        <div className="hero-side-bottom"><div><div className="eyebrow" style={{ color: 'white' }}>BENGALURU</div><div style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,.74)' }}>Whitefield · 08:00 — 23:00</div></div><div><div className="eyebrow" style={{ color: 'white' }}>THE HOUSE OF</div><div className="font-display" style={{ fontSize: 32, marginTop: 7 }}>good coffee</div></div></div>
      </aside>
      <div className="hero-main">
        <motion.div initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.1 }} className="editorial-image hero-photo"><span className="editorial-label">Cinematic interior / coffee still</span></motion.div>
        <div className="hero-stamp">NEW<br />TODAY</div>
        <motion.div className="hero-copy" initial={{ opacity: 0, y: 35 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .15, duration: .75, ease: [0.22,1,.36,1] }}>
          <div className="eyebrow">01 / THE HOUSE OF TRESOR</div>
          <h1 className="font-display"><span>GOOD COFFEE.</span><span>SLOW MOMENTS.</span></h1>
          <p className="lede" style={{ maxWidth: 520, marginTop: 22 }}>A contemporary bakery for mornings that become afternoons.</p>
          <div className="hero-actions"><Link className="btn btn-primary" href="/menu">EXPLORE MENU</Link><Link className="btn btn-secondary" href="/about">OUR STORY</Link></div>
        </motion.div>
      </div>
    </section>

    <Reveal className="page signature">
      <div className="signature-header"><div><div className="eyebrow">SIGNATURE</div><h2 className="font-display">Made for the first sip.</h2></div><Link href="/menu" className="btn btn-secondary">VIEW THE MENU <ArrowRight size={14} /></Link></div>
      <div className="signature-grid">
        {featured.map((p, i) => <ProductCard key={p.slug} product={p} className={`signature-card s${i}`} />)}
      </div>
      <div className="order-ribbon"><span>Order delivery</span><div className="order-links"><a className="btn btn-secondary" href={process.env.NEXT_PUBLIC_ZOMATO_URL || 'https://www.zomato.com/'} target="_blank" rel="noreferrer">ZOMATO ↗</a><a className="btn btn-secondary" href={process.env.NEXT_PUBLIC_SWIGGY_URL || 'https://www.swiggy.com/'} target="_blank" rel="noreferrer">SWIGGY ↗</a></div></div>
    </Reveal>

    <Reveal className="page section" delay={.1}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 50, alignItems: 'center' }}>
        <div><div className="eyebrow">THE HOUSE</div><h2 className="section-title font-display">Coffee, pastry,<br />conversation.</h2><p className="lede">Tresor is built around the simple idea that a bakery should make time feel a little slower — considered without excess.</p><Link className="btn btn-secondary" href="/about" style={{ marginTop: 24 }}>READ OUR STORY</Link></div>
        <div className="editorial-image" style={{ minHeight: 450 }}><span className="editorial-label">Editorial bakery interior</span></div>
      </div>
    </Reveal>

    <Reveal className="page section" delay={.1}>
      <div className="eyebrow">VISIT TRESOR</div><div style={{ display: 'grid', gridTemplateColumns: '1fr .8fr', gap: 40, marginTop: 18 }}><div className="font-display" style={{ fontSize: 52, lineHeight: .95 }}>Whitefield,<br />Bengaluru.</div><div><p className="lede" style={{ margin: 0 }}>08:00 — 23:00 · Monday to Sunday</p><Link className="btn btn-primary" href="/contact" style={{ marginTop: 22 }}>GET DIRECTIONS <ArrowRight size={14} /></Link></div></div>
    </Reveal>

    <Reveal className="page section" delay={.1}><div style={{ display:'flex', justifyContent:'space-between', alignItems:'end', gap:20 }}><div><div className="eyebrow">FOLLOW THE DAY</div><h2 className="section-title font-display">See you at Tresor.</h2></div><ArrowDown size={20} color="var(--sage)" /></div></Reveal>
  </main>;
}
