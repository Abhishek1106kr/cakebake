'use client';

import Link from 'next/link';
import { Menu, Search, ShoppingBag, X, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { semanticSearch } from '@/lib/search';
import { products } from '@/lib/data';
import { useStore } from './store-provider';
import { semanticSuggestions } from '@/lib/data';

export function StoreHeader() {
  const { cartCount } = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const results = semanticSearch(products, query).slice(0, 6);

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
            <Link href="/#story">Our story</Link>
            <Link href="/track-order">Track order</Link>
            <Link href="/contact">Visit</Link>
          </nav>
          <div className="nav-actions">
            <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Search the menu"><Search size={18}/></button>
            <Link className="bag-button" href="/cart" aria-label="Cart"><ShoppingBag size={18}/><span>Bag</span>{cartCount > 0 && <b>{cartCount}</b>}</Link>
            <Link className="icon-btn menu-btn" href="/shop" aria-label="Open menu"><Menu size={18}/></Link>
          </div>
        </div>
      </header>

      <div className={`search-overlay ${open ? 'open' : ''}`} aria-hidden={!open}>
        <button className="search-backdrop" onClick={() => setOpen(false)} aria-label="Close search" />
        <section className="search-sheet" role="dialog" aria-modal="true" aria-label="Search Tresor menu">
          <div className="search-sheet-head"><div><span className="eyebrow">Find your ritual</span><h2 className="display h2">What are you craving?</h2></div><button className="icon-btn" onClick={() => setOpen(false)}><X size={18}/></button></div>
          <div className="search-input-wrap"><Sparkles size={18}/><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try “something chocolatey” or “a cold coffee”"/><kbd>ESC</kbd></div>
          {!query ? <div className="search-suggestions"><p className="small muted">Semantic suggestions</p><div className="suggestion-list">{semanticSuggestions.map((suggestion) => <button key={suggestion} onClick={() => setQuery(suggestion)}>“{suggestion}”</button>)}</div></div> : <div className="search-results"><div className="small muted" style={{marginBottom:12}}>{results.length ? `${results.length} menu matches` : 'No direct matches — try a simpler craving'}</div>{results.map((product) => <Link key={product.id} href={`/shop/${product.id}`} onClick={() => setOpen(false)} className="search-result"><div className={`search-result-art ${product.image}`} /><div><strong>{product.name}</strong><span>{product.category} · ₹{product.price}</span></div></Link>)}</div>}
          <div className="search-sheet-foot"><Link className="btn btn-brand" href="/shop" onClick={() => setOpen(false)}>Browse full menu</Link></div>
        </section>
      </div>
    </>
  );
}
