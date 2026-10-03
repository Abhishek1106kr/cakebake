'use client';

import { Suspense, useMemo, useState } from 'react';
import { Search, Sparkles, SlidersHorizontal } from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { EASE } from '@/lib/motion';
import { ProductCard } from '@/components/product-card';
import { categories, products, semanticSuggestions } from '@/lib/data';
import { semanticSearch } from '@/lib/search';
import { useSearchParams } from 'next/navigation';

function Shop() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('popular');
  const filtered = useMemo(() => {
    const base = query ? semanticSearch(products, query) : products;
    const cat = category === 'All' ? base : base.filter((p) => p.category === category);
    return [...cat].sort((a, b) => sort === 'price-low' ? a.price - b.price : sort === 'price-high' ? b.price - a.price : Number(b.featured) - Number(a.featured));
  }, [query, category, sort]);

  return <main className="page shop-page">
    <section className="shop-hero"><div className="container"><div className="eyebrow">The menu · live mock catalogue</div><motion.h1 className="display h1 shop-title" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE }}>Pick your <em>ritual.</em></motion.h1><p>Search by craving, category or occasion. The semantic search is mocked locally so the UX can be tested before the real product search API is connected.</p><div className="semantic-search-bar"><Sparkles size={18}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try “something chocolatey” / “light and refreshing”"/><kbd>⌘ K</kbd></div><motion.div className="search-suggestion-row" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.06, delayChildren: 0.3 } } }}>{semanticSuggestions.slice(0,4).map((s) => <motion.button key={s} variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }} whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }} onClick={() => setQuery(s)}>“{s}”</motion.button>)}</motion.div></div></section>
    <section className="section shop-content"><div className="container"><div className="toolbar shop-toolbar"><div className="filters">{categories.map((c) => <button key={c} className={`chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>{c}</button>)}</div><div className="sort-wrap"><SlidersHorizontal size={15}/><select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort products"><option value="popular">Popular</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></div></div><div className="results-note"><AnimatePresence mode="wait" initial={false}><motion.span key={filtered.length} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>{filtered.length} items</motion.span></AnimatePresence>{query && <span>for “{query}”</span>}</div><LayoutGroup><motion.div layout className="product-grid shop-grid"><AnimatePresence mode="popLayout" initial={false}>{filtered.map((p, i) => <motion.div key={p.id} layout initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.4, ease: EASE, delay: Math.min(i, 8) * 0.03 }}><ProductCard product={p}/></motion.div>)}</AnimatePresence></motion.div></LayoutGroup>{filtered.length === 0 && <div className="empty-state"><Search size={24}/><h3>Nothing exact came back.</h3><p>Try “coffee”, “chocolate”, “brunch”, or a simpler craving.</p></div>}</div></section>
  </main>;
}

// useSearchParams needs a Suspense boundary for the page to prerender.
export default function ShopPage() {
  return <Suspense fallback={<main className="page"><div className="container page-loader" /></main>}><Shop /></Suspense>;
}
