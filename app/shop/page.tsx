'use client';

import { Suspense, useMemo, useState } from 'react';
import { Search, Sparkles, SlidersHorizontal } from 'lucide-react';
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
    <section className="shop-hero"><div className="container"><div className="eyebrow">The menu · live mock catalogue</div><h1 className="display h1 shop-title">Pick your <em>ritual.</em></h1><p>Search by craving, category or occasion. The semantic search is mocked locally so the UX can be tested before the real product search API is connected.</p><div className="semantic-search-bar"><Sparkles size={18}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try “something chocolatey” / “light and refreshing”"/><kbd>⌘ K</kbd></div><div className="search-suggestion-row">{semanticSuggestions.slice(0,4).map((s) => <button key={s} onClick={() => setQuery(s)}>“{s}”</button>)}</div></div></section>
    <section className="section shop-content"><div className="container"><div className="toolbar shop-toolbar"><div className="filters">{categories.map((c) => <button key={c} className={`chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>{c}</button>)}</div><div className="sort-wrap"><SlidersHorizontal size={15}/><select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort products"><option value="popular">Popular</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></div></div><div className="results-note"><span>{filtered.length} items</span>{query && <span>for “{query}”</span>}</div><div className="product-grid shop-grid">{filtered.map((p) => <ProductCard key={p.id} product={p}/>)}</div>{filtered.length === 0 && <div className="empty-state"><Search size={24}/><h3>Nothing exact came back.</h3><p>Try “coffee”, “chocolate”, “brunch”, or a simpler craving.</p></div>}</div></section>
  </main>;
}

// useSearchParams needs a Suspense boundary for the page to prerender.
export default function ShopPage() {
  return <Suspense fallback={<main className="page"><div className="container page-loader" /></main>}><Shop /></Suspense>;
}
