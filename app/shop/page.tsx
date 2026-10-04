'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { EASE, T } from '@/lib/motion';
import { ProductCard } from '@/components/product-card';
import { SplitText } from '@/components/cinematic';
import { categories, products, semanticSuggestions } from '@/lib/data';
import { track, useSearch, useTrackSearch } from '@/components/intelligence';
import { useStore } from '@/components/store-provider';
import { ForYouRow } from '@/components/recommendations';
import { useSearchParams } from 'next/navigation';

const SORTS = [
  { id: 'popular', label: 'Popular' },
  { id: 'price-low', label: 'Price: low to high' },
  { id: 'price-high', label: 'Price: high to low' },
] as const;

function Shop() {
  const reduce = useReducedMotion();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState(searchParams.get('q') || '');
  const [query, setQuery] = useState(draft);
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState<(typeof SORTS)[number]['id']>('popular');

  // Re-rank shortly after typing stops, so the grid moves once rather than on every key.
  useEffect(() => { const t = setTimeout(() => setQuery(draft), 250); return () => clearTimeout(t); }, [draft]);

  const searched = useSearch(query);
  useTrackSearch(query, searched, 'menu');
  const { hits, interpretation, corrections, relaxed } = searched.result;
  const noMatch = relaxed.includes('everything');
  const reasons = useMemo(() => new Map(hits.map((h) => [h.product.id, h.reason])), [hits]);
  const { catalogRevision } = useStore();
  // The live menu (admin changes applied); catalogRevision re-reads it when the bakery edits the catalogue.
  const base = useMemo(() => (query.trim() ? hits.map((h) => h.product) : products), [query, hits, catalogRevision]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => Object.fromEntries(categories.map((c) => [c, c === 'All' ? base.length : base.filter((p) => p.category === c).length])), [base]);
  const filtered = useMemo(() => {
    const cat = category === 'All' ? base : base.filter((p) => p.category === category);
    if (sort === 'popular' && query) return cat; // keep relevance order while searching
    return [...cat].sort((a, b) => sort === 'price-low' ? a.price - b.price : sort === 'price-high' ? b.price - a.price : Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  }, [base, category, sort, query]);

  const choose = (s: string) => { setDraft(s); setQuery(s); };
  const pickCategory = (c: string) => { setCategory(c); if (c !== 'All') track('category_view', { category: c }); };

  return <main className="page menu-page-v2">
    <section className="menu-hero">
      <div className="container">
        <div className="eyebrow">The menu</div>
        <SplitText as="h1" text="What are you in the mood for?" trigger="mount" delay={0.1} className="menu-title" />
        <form className="menu-search" onSubmit={(e) => { e.preventDefault(); setQuery(draft); }} role="search">
          <Search size={20} strokeWidth={1.4} aria-hidden="true" />
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="something warm, nutty and not too sweet" aria-label="What are you in the mood for?" />
          {draft && <button type="button" className="menu-search-clear" onClick={() => choose('')} aria-label="Clear search"><X size={16} /></button>}
        </form>
        <AnimatePresence mode="wait" initial={false}>
          {query.trim() && (
            <motion.p key={`${interpretation}|${relaxed.join()}|${corrections.length}`} className="menu-understood" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }} aria-live="polite">
              {noMatch
                ? <>Nothing on the menu matches that yet. Here’s what people love instead.</>
                : <>
                    {interpretation ?? `Looking for “${query.trim()}”`}
                    {corrections.length > 0 && !corrections.every((c) => interpretation?.includes(c.to)) && <span className="menu-understood-aside"> · read as “{corrections.map((c) => c.to).join(' ')}”</span>}
                    {relaxed.length > 0 && <span className="menu-understood-aside"> · nothing {relaxed.join(', ')}, so here’s the closest</span>}
                  </>}
            </motion.p>
          )}
        </AnimatePresence>
        <motion.div className="menu-suggestions" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.05, delayChildren: 0.4 } } }}>
          <span>Try</span>
          {semanticSuggestions.slice(0, 5).map((s) => (
            <motion.button key={s} className={query === s ? 'is-active' : ''} variants={reduce ? undefined : { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: T.ui } }} onClick={() => choose(s)}>{s}</motion.button>
          ))}
        </motion.div>
      </div>
    </section>

    {!query.trim() && category === 'All' && <ForYouRow />}

    <div className="menu-bar">
      <div className="container menu-bar-inner">
        <LayoutGroup id="menu-tabs">
          <nav className="menu-tabs" aria-label="Categories">
            {categories.map((c) => (
              <button key={c} className={category === c ? 'is-active' : ''} aria-pressed={category === c} onClick={() => pickCategory(c)} disabled={counts[c] === 0 && category !== c}>
                {c}<sup>{counts[c]}</sup>
                {category === c && <motion.span className="menu-tab-line" layoutId="menu-tab-line" transition={T.ui} />}
              </button>
            ))}
          </nav>
        </LayoutGroup>
        <div className="menu-bar-right">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={filtered.length + query} className="menu-count" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} aria-live="polite">
              {filtered.length} {filtered.length === 1 ? 'thing' : 'things'}{query ? ' for the mood' : ''}
            </motion.span>
          </AnimatePresence>
          <label className="menu-sort">
            <span className="sr-only">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </label>
        </div>
      </div>
    </div>

    <section className="section shop-content"><div className="container">
      <LayoutGroup><motion.div layout className="product-grid shop-grid"><AnimatePresence mode="popLayout" initial={false}>
        {filtered.map((p, i) => <motion.div key={p.id} layout initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.4, ease: EASE, delay: Math.min(i, 8) * 0.03 }}><ProductCard product={p} note={query.trim() && !noMatch ? reasons.get(p.id) : null}/></motion.div>)}
      </AnimatePresence></motion.div></LayoutGroup>
      {filtered.length === 0 && (
        <div className="menu-empty">
          <p className="display">Nothing quite fits that mood yet.</p>
          <div><button className="btn btn-brand" onClick={() => { choose(''); pickCategory('All'); }}>Browse the menu</button><button className="btn btn-secondary" onClick={() => choose(semanticSuggestions[(semanticSuggestions.indexOf(query) + 1) % semanticSuggestions.length])}>Try another mood</button></div>
        </div>
      )}
    </div></section>
  </main>;
}

// useSearchParams needs a Suspense boundary for the page to prerender.
export default function ShopPage() {
  return <Suspense fallback={<main className="page"><div className="container page-loader" /></main>}><Shop /></Suspense>;
}
