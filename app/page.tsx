'use client';

import Link from 'next/link';
import { ArrowDownRight, ArrowRight, Clock3, Leaf, MapPin, Sparkles, Star } from 'lucide-react';
import { ProductCard } from '@/components/product-card';
import { ExternalOrderButtons } from '@/components/external-order-buttons';
import { products } from '@/lib/data';

export default function HomePage() {
  const featured = products.filter((p) => p.featured).slice(0, 6);
  return (
    <main className="page home-page">
      <div className="announcement"><span>Fresh counter drops every morning</span><span>•</span><span>Order before 11:30 for same-day delivery</span></div>
      <section className="hero hero-premium">
        <div className="hero-orbit orbit-1"/><div className="hero-orbit orbit-2"/><div className="hero-orbit orbit-3"/>
        <div className="container hero-grid">
          <div className="hero-copy reveal-up">
            <div className="eyebrow">Bakery · Coffee · Dessert · Bengaluru</div>
            <h1 className="display hero-title">A little more <em>ritual</em> in your everyday.</h1>
            <p className="hero-subtitle">Warm pastry, expressive coffee and thoughtful dessert — made fresh, packed carefully, delivered without turning the moment into a transaction.</p>
            <div className="hero-actions"><Link className="btn btn-brand btn-lg" href="/shop">Explore the menu <ArrowRight size={17}/></Link><Link className="text-link" href="#story">Why Tresor <ArrowDownRight size={16}/></Link></div>
            <div className="hero-trust"><span><Clock3 size={14}/>8–22 daily</span><span><Leaf size={14}/>Small-batch</span><span><Star size={14}/>4.9 ritual rating</span></div>
          </div>
          <div className="hero-stage reveal-scale">
            <div className="floating-sticker top"><span>Today’s favourite</span><strong>Basque<br/>Cheesecake</strong></div>
            <div className="hero-plate"><div className="hero-plate-ring"/><div className="hero-dessert"><div className="dessert-glow"/><div className="dessert-slice"/></div><span className="hero-caption">Caramelised top · sea salt · soft centre</span></div>
            <div className="floating-sticker bottom"><span>Delivery</span><strong>Fast enough.<br/>Calm enough.</strong></div>
          </div>
        </div>
      </section>

      <div className="ticker"><div className="ticker-track"><span>ALMOND CROISSANT</span><i>✦</i><span>DOUBLE ESPRESSO</span><i>✦</i><span>BASQUE CHEESECAKE</span><i>✦</i><span>MUSHROOM SOURDOUGH</span><i>✦</i><span>MATCHA CLOUD</span><i>✦</i><span>ALMOND CROISSANT</span><i>✦</i><span>DOUBLE ESPRESSO</span><i>✦</i></div></div>

      <section className="section menu-preview" id="menu">
        <div className="container">
          <div className="section-head reveal-up"><div><div className="eyebrow">The counter today</div><h2 className="display h2">Choose your mood.</h2></div><div className="section-head-copy"><p>Search the menu like a human, not a spreadsheet. Try “something chocolatey”, “a cold coffee”, or simply browse.</p><Link className="text-link" href="/shop">See everything <ArrowRight size={15}/></Link></div></div>
          <div className="mood-grid">
            <Link href="/shop?q=something%20chocolatey" className="mood-card mood-chocolate"><span>Craving rich</span><strong>Chocolate, cocoa &amp; caramel.</strong><small>5 menu matches</small></Link>
            <Link href="/shop?q=a%20cold%20coffee" className="mood-card mood-cold"><span>Need a reset</span><strong>Iced, crisp, caffeinated.</strong><small>3 menu matches</small></Link>
            <Link href="/shop?q=something%20for%20brunch" className="mood-card mood-brunch"><span>Making a morning</span><strong>Savoury plates &amp; buttery pastry.</strong><small>4 menu matches</small></Link>
          </div>
          <div className="product-grid featured-grid">{featured.map((product) => <ProductCard key={product.id} product={product}/>)}</div>
        </div>
      </section>

      <section className="section story-section" id="story">
        <div className="container story-grid">
          <div className="story-visual reveal-scale"><div className="story-orbit"/><div className="story-card-main"><span>EST. 2026</span><strong>stay<br/>a little<br/><em>longer.</em></strong></div><div className="story-mini">No rush.<br/>No noise.<br/>Just good things.</div></div>
          <div className="story-panel reveal-up"><div className="eyebrow">The Tresor philosophy</div><h2 className="display h2">Good food should slow the room down.</h2><p>We design the menu around contrast: crisp and soft, bitter and bright, rich and restrained. The technology should do the same — disappear into the experience.</p><div className="story-list"><div><Sparkles size={18}/><span><strong>Small-batch pastry</strong><br/>Baked in waves throughout the day.</span></div><div><Leaf size={18}/><span><strong>Seasonal ingredients</strong><br/>Simple finishes, thoughtful sourcing.</span></div><div><Clock3 size={18}/><span><strong>Fast ordering</strong><br/>Checkout in under a minute when you know what you want.</span></div></div><Link className="btn btn-light" href="/about">Meet Tresor <ArrowRight size={16}/></Link></div>
        </div>
      </section>

      <section className="section order-anywhere">
        <div className="container split-banner"><div><div className="eyebrow">Already on your favourite app?</div><h2 className="display h2">Find Tresor where you already order.</h2><p className="muted">The direct checkout is ours. The discovery layer can still live where Bengaluru already looks for food.</p></div><ExternalOrderButtons/></div>
      </section>

      <section className="section visit-section">
        <div className="container visit-grid"><div className="visit-card"><div className="eyebrow">Come by</div><h2 className="display h2">Indiranagar.<br/><em>Your corner table.</em></h2><p>Mon–Sun · 8:00–22:00<br/>Dine-in, takeaway, delivery.</p><div className="visit-actions"><Link className="btn btn-primary" href="/contact">Get directions <MapPin size={15}/></Link><a className="text-link" href="tel:+919999999999">Call the bakery</a></div></div><div className="map-card"><div className="map-grid"/><div className="map-pin"><MapPin size={22}/><span>Tresor<br/><small>Indiranagar, Bengaluru</small></span></div><div className="map-note">Walk in. Stay longer.</div></div></div>
      </section>
    </main>
  );
}
