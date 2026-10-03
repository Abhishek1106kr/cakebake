'use client';

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ProductCard } from '@/components/product/product-card';
import { categories, products, type CategoryId } from '@/data/products';
import { moodSearch, moodSuggestions } from '@/lib/search/semantic';
import { EASE } from '@/lib/motion/transitions';

type MenuViewProps = { initialQuery: string; initialCategory: CategoryId | 'all' };

export function MenuView({ initialQuery, initialCategory }: MenuViewProps) {
  const reduce = useReducedMotion();
  const [draft, setDraft] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<CategoryId | 'all'>(initialCategory);
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-rank shortly after typing stops, so results move once rather than on every key.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(draft), 260);
    return () => clearTimeout(timer);
  }, [draft]);

  // Keep the URL shareable without triggering a navigation.
  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (category !== 'all') params.set('category', category);
    const next = `/menu${params.toString() ? `?${params}` : ''}`;
    window.history.replaceState(window.history.state, '', next);
  }, [query, category]);

  const results = useMemo(() => {
    const pool = category === 'all' ? products : products.filter((product) => product.category === category);
    return moodSearch(query, pool);
  }, [query, category]);

  const searching = query.trim().length > 0;
  const choose = (suggestion: string) => { setDraft(suggestion); setQuery(suggestion); };
  const clear = () => { setDraft(''); setQuery(''); inputRef.current?.focus(); };

  return (
    <main className="menu-page wrap">
      <header className="menu-head">
        <div className="eyebrow">Menu / {String(categories.length).padStart(2, '0')} categories</div>
        <h1 className="page-title display">What are you in the mood for?</h1>
        <p className="lede">Say it the way you&rsquo;d say it at the counter.</p>
      </header>

      <form className="mood-search" role="search" onSubmit={(event) => { event.preventDefault(); setQuery(draft); }}>
        <Search size={18} strokeWidth={1.4} aria-hidden="true" />
        <label htmlFor="mood" className="sr-only">What are you in the mood for?</label>
        <input id="mood" ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="something warm, nutty and not too sweet" autoComplete="off" enterKeyHint="search" />
        {draft && <button type="button" className="icon-link" onClick={clear} aria-label="Clear search"><X size={16} strokeWidth={1.5} /></button>}
      </form>

      <motion.div className="mood-chips" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.05, delayChildren: 0.15 } } }}>
        {moodSuggestions.map((suggestion) => (
          <motion.button
            key={suggestion}
            type="button"
            className={`chip ${query === suggestion ? 'is-active' : ''}`}
            onClick={() => choose(suggestion)}
            aria-pressed={query === suggestion}
            variants={reduce ? undefined : { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } } }}
          >
            {suggestion}
          </motion.button>
        ))}
      </motion.div>

      <div className="category-bar" role="group" aria-label="Filter by category">
        <span className="eyebrow">Filter</span>
        {[{ id: 'all' as const, label: 'All' }, ...categories].map((item) => (
          <button key={item.id} type="button" className={`filter ${category === item.id ? 'is-active' : ''}`} onClick={() => setCategory(item.id)} aria-pressed={category === item.id}>
            {item.label}
            {category === item.id && <motion.span className="filter-underline" layoutId="filter-underline" transition={{ duration: 0.25, ease: EASE }} />}
          </button>
        ))}
      </div>

      <div className="result-bar" aria-live="polite">
        <div className="eyebrow">{searching ? 'Picked for the mood' : 'The full menu'}</div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={results.length + query} className="result-count" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            {results.length} {results.length === 1 ? 'thing' : 'things'} {searching ? 'you might like' : 'on the menu'}
          </motion.span>
        </AnimatePresence>
      </div>

      {results.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 120 80" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M20 60h80M34 60c0-14 12-26 26-26s26 12 26 26" /><path d="M54 30c-4-6 4-10 0-16M66 30c-4-6 4-10 0-16" /></svg>
          <h2 className="display">Nothing quite fits that mood yet.</h2>
          <div className="empty-actions">
            <button type="button" className="btn btn-primary" onClick={() => { clear(); setCategory('all'); }}>Browse menu</button>
            <button type="button" className="btn btn-secondary" onClick={() => choose(moodSuggestions[(moodSuggestions.indexOf(query) + 1) % moodSuggestions.length])}>Try another mood</button>
          </div>
        </div>
      ) : (
        <LayoutGroup>
          <motion.ul className="menu-grid" layout={!reduce}>
            <AnimatePresence mode="popLayout" initial={false}>
              {results.map((result, i) => (
                <motion.li
                  key={result.product.slug}
                  layout={!reduce}
                  initial={{ opacity: 0, y: reduce ? 0 : 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
                  transition={{ duration: 0.34, ease: EASE }}
                  className={searching && i === 0 ? 'is-top' : ''}
                >
                  <ProductCard product={result.product} reasons={searching ? result.reasons : undefined} highlight={searching && i < 3} size={searching && i === 0 ? 'large' : 'default'} />
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        </LayoutGroup>
      )}
    </main>
  );
}
