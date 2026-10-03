'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, ArrowRight } from 'lucide-react';
import { semanticSearch, products } from '@/lib/products';
import { ProductCard } from '@/components/product-card';
import { Reveal } from '@/components/animations';

const chips = ['warm + nutty','chocolatey','cold + bright','light brunch'];
const cats = ['all','coffee','pastry','dessert','brunch','drinks'];

export default function MenuPage() {
  const [query, setQuery] = useState('something warm, nutty and not too sweet');
  const [category, setCategory] = useState('all');
  const results = useMemo(() => {
    const ranked = semanticSearch(query);
    return category === 'all' ? ranked : ranked.filter(p => p.categories.includes(category));
  }, [query, category]);
  return <main className="page section"><Reveal><div className="eyebrow">MENU / 06 CATEGORIES</div><h1 className="section-title font-display">What are you in the mood for?</h1><p className="lede">Type it naturally. Tresor will read the feeling, not just the keyword.</p></Reveal>
    <Reveal delay={.05}><form className="search-band" onSubmit={e => e.preventDefault()}><input aria-label="Semantic product search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Try: something warm, nutty and not too sweet" /><button className="search-submit" aria-label="Search"><Search size={18} /></button></form><div className="search-chips">{chips.map(chip => <button className={`chip ${query === chip ? 'active' : ''}`} key={chip} onClick={() => setQuery(chip)}>{chip}</button>)}</div></Reveal>
    <div style={{ display: 'flex', gap: 20, flexWrap:'wrap', marginTop: 42, alignItems:'center' }}><span className="eyebrow" style={{ marginRight: 5 }}>FILTER</span>{cats.map(cat => <button key={cat} onClick={() => setCategory(cat)} className={`chip ${category === cat ? 'active' : ''}`}>{cat.toUpperCase()}</button>)}</div>
    <Reveal delay={.08}><div style={{ display:'flex', justifyContent:'space-between', alignItems:'end', marginTop:44 }}><div><div className="eyebrow">CURATED FOR YOUR MOOD</div><p style={{ marginTop:10, fontSize:13, color:'var(--muted)' }}>{results.length} things you might like</p></div><Link className="btn btn-secondary" href="/cart">VIEW BAG <ArrowRight size={14}/></Link></div></Reveal>
    <div className="menu-grid">{results.map((p,i) => <Reveal key={p.slug} delay={i*.04} className={i===0 ? 'big-product' : ''}><ProductCard product={p} /></Reveal>)}</div>
    {!results.length && <div style={{ padding:'80px 0', textAlign:'center', color:'var(--muted)' }}>Nothing matched that mood yet. Try “cold + bright” or “warm + nutty”.</div>}
  </main>;
}
