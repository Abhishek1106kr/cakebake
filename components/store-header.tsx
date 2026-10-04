'use client';

import Link from 'next/link';
import { Menu, Search, ShoppingBag, X, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSearch, useTrackSearch } from './intelligence';
import { useStore } from './store-provider';
import { semanticSuggestions } from '@/lib/data';

export function StoreHeader() {
  const { cartCount } = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searched = useSearch(query);
  useTrackSearch(query, searched, 'header');
  const noMatch = searched.result.relaxed.includes('everything');
  const results = noMatch ? [] : searched.result.hits.slice(0, 6);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      <header className="header">
        <div className="container nav">
          <Link href="/" className="logo">Tresor<span>•</span></Link>
          <nav className="nav-links" aria-label="Primary navigation">
            <Link href="/shop">Menu</Link>
            <Link href="/customize-cake">Customize cake</Link>
            <Link href="/#story">Our story</Link>
            <Link href="/track-order">Track order</Link>
            <Link href="/contact">Visit</Link>
          </nav>
          <div className="nav-actions">
            <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Search the menu"><Search size={18}/></button>
            <Link className="bag-button" href="/cart" aria-label="Cart" data-bag-target><ShoppingBag size={18}/><span>Bag</span><AnimatePresence mode="popLayout" initial={false}>{cartCount > 0 && <motion.b key={cartCount} initial={{ scale: 0.4, y: 6, opacity: 0 }} animate={{ scale: [1.35, 1], y: 0, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>{cartCount}</motion.b>}</AnimatePresence></Link>
            <Link className="icon-btn menu-btn" href="/shop" aria-label="Open menu"><Menu size={18}/></Link>
          </div>
        </div>
      </header>

      <div className={`search-overlay ${open ? 'open' : ''}`} aria-hidden={!open}>
        <button className="search-backdrop" onClick={() => setOpen(false)} aria-label="Close search" />
        <section className="search-sheet" role="dialog" aria-modal="true" aria-label="Search Tresor menu">
          <div className="search-sheet-head"><div><span className="eyebrow">Find your ritual</span><h2 className="display h2">What are you craving?</h2></div><button className="icon-btn" onClick={() => setOpen(false)}><X size={18}/></button></div>
          <div className="search-input-wrap"><Sparkles size={18}/><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try “something chocolatey” or “a cold coffee”"/><kbd>ESC</kbd></div>
          {!query ? <div className="search-suggestions"><p className="small muted">Try a mood</p><div className="suggestion-list">{semanticSuggestions.map((suggestion) => <button key={suggestion} onClick={() => setQuery(suggestion)}>“{suggestion}”</button>)}</div></div> : <div className="search-results">{searched.result.interpretation && !noMatch && <p className="search-understood">{searched.result.interpretation}</p>}<div className="small muted" style={{marginBottom:12}}>{results.length ? `${searched.result.hits.length} on the menu${searched.result.relaxed.length ? `, closest to what you asked` : ''}` : 'Nothing on the menu matches that yet. Try a flavour or a mood.'}</div>{results.map(({ product, reason }) => <Link key={product.id} href={`/shop/${product.id}`} onClick={() => setOpen(false)} className="search-result"><div className={`search-result-art ${product.image}`} /><div><strong>{product.name}</strong><span>{product.category} · ₹{product.price}</span>{reason && <span className="search-result-why">{reason}</span>}</div></Link>)}</div>}
          <div className="search-sheet-foot"><Link className="btn btn-brand" href="/shop" onClick={() => setOpen(false)}>Browse full menu</Link></div>
        </section>
      </div>
    </>
  );
}
