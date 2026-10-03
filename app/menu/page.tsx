'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { Search, ArrowRight } from 'lucide-react';
import { semanticSearch, products } from '@/lib/products';
import { ProductCard } from '@/components/product-card';
import { LineReveal, Reveal } from '@/components/motion';
import { EASE } from '@/lib/motion';

const chips = ['warm + nutty', 'chocolatey', 'cold + bright', 'light brunch'];
const cats = ['all', 'coffee', 'pastry', 'dessert', 'brunch', 'drinks'];

/** Words from the query that this product actually matches (shown as "Picked for …"). */
function reasonFor(query: string, slug: string): string | undefined {
  const p = products.find((x) => x.slug === slug);
  if (!p || !query.trim()) return undefined;
  const text = [p.name, p.description, ...p.categories, ...p.mood].join(' ').toLowerCase();
  const words = query.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2 && !['something', 'and', 'not', 'too', 'the'].includes(w) && text.includes(w));
  return words.length ? [...new Set(words)].slice(0, 2).join(' · ') : undefined;
}

export default function MenuPage() {
  const reduce = useReducedMotion();
  const [query, setQuery] = useState('something warm, nutty and not too sweet');
  const [category, setCategory] = useState('all');
  const results = useMemo(() => {
    const ranked = semanticSearch(query);
    return category === 'all' ? ranked : ranked.filter(p => p.categories.includes(category));
  }, [query, category]);

  return <main className="page section">
    <Reveal><div className="eyebrow">MENU / 06 CATEGORIES</div></Reveal>
    <LineReveal as="h1" className="section-title font-display" lines={['What are you in the mood for?']} />
    <Reveal delay={0.1}><p className="lede">Type it naturally. Tresor will read the feeling, not just the keyword.</p></Reveal>
    <Reveal delay={0.15}><form className="search-band" onSubmit={e => e.preventDefault()}><input aria-label="What are you in the mood for?" value={query} onChange={e => setQuery(e.target.value)} placeholder="Try: something warm, nutty and not too sweet" /><button className="search-submit" aria-label="Search"><Search size={18} /></button></form></Reveal>
    <motion.div className="search-chips" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.05, delayChildren: 0.25 } } }}>
      {chips.map(chip => <motion.button variants={reduce ? undefined : { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } } }} className={`chip ${query === chip ? 'active' : ''}`} key={chip} onClick={() => setQuery(chip)}>{chip}</motion.button>)}
    </motion.div>
    <div className="filter-row"><span className="eyebrow" style={{ marginRight: 5 }}>FILTER</span>{cats.map(cat => <button key={cat} onClick={() => setCategory(cat)} className={`chip ${category === cat ? 'active' : ''}`} aria-pressed={category === cat}>{cat.toUpperCase()}</button>)}</div>
    <div className="result-row"><div><div className="eyebrow">CURATED FOR YOUR MOOD</div><AnimatePresence mode="wait" initial={false}><motion.p key={results.length + query + category} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} style={{ marginTop: 10, fontSize: 13, color: 'var(--muted)' }} aria-live="polite">{results.length} things you might like</motion.p></AnimatePresence></div><Link className="btn btn-secondary" href="/cart">VIEW BAG <ArrowRight size={14} /></Link></div>
    <LayoutGroup>
      <motion.div className="menu-grid" layout={!reduce}>
        <AnimatePresence mode="popLayout" initial={false}>
          {results.map((p, i) => (
            <motion.div key={p.slug} layout={!reduce} className={i === 0 ? 'big-product' : ''} initial={{ opacity: 0, y: reduce ? 0 : 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: reduce ? 1 : 0.96 }} transition={{ duration: 0.35, ease: EASE }}>
              <ProductCard product={p} reason={i < 3 ? reasonFor(query, p.slug) : undefined} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </LayoutGroup>
    {!results.length && <div className="empty-mood"><p className="font-display">Nothing quite fits that mood yet.</p><div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18 }}><button className="btn btn-primary" onClick={() => { setQuery(''); setCategory('all'); }}>BROWSE MENU</button><button className="btn btn-secondary" onClick={() => setQuery(chips[(chips.indexOf(query) + 1) % chips.length])}>TRY ANOTHER MOOD</button></div></div>}
  </main>;
}
