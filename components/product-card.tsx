'use client';

import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Plus } from 'lucide-react';
import { Product } from '@/lib/data';
import { useStore } from './store-provider';
import { useState } from 'react';
import { EASE } from '@/lib/motion';

export function ProductCard({ product, compact = false, note }: { product: Product; compact?: boolean; /** Why it's here, e.g. "Nutty · served warm". */ note?: string | null }) {
  const reduce = useReducedMotion();
  const { addToCart, canAddMore, mounted } = useStore();
  const [added, setAdded] = useState(false);
  const [burst, setBurst] = useState(0);
  const soldOut = mounted && canAddMore(product) === 0;
  const handleAdd = () => {
    if (addToCart(product) === 0) return;
    setAdded(true);
    setBurst((b) => b + 1);
    window.setTimeout(() => setAdded(false), 1200);
  };
  return (
    <motion.article
      className={`product-card ${compact ? 'product-card-compact' : ''} ${soldOut ? 'is-sold-out' : ''}`}
      whileHover={reduce ? undefined : { y: -6 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
    >
      <Link href={`/shop/${product.id}`} className="product-art-frame">
        <motion.div className={`product-art ${product.image}`} whileHover={reduce ? undefined : { scale: 1.04 }} transition={{ duration: 0.5, ease: EASE }}>
          {product.tag && <span className="product-tag">{product.tag}</span>}
          <div className="product-visual-text"><span>{product.category}</span><strong>{product.name}</strong></div>
        </motion.div>
        <AnimatePresence>
          {burst > 0 && added && !reduce && (
            <motion.span key={burst} className="add-burst" initial={{ scale: 0.4, opacity: 0.7 }} animate={{ scale: 2.4, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.7, ease: EASE }} />
          )}
        </AnimatePresence>
      </Link>
      <div className="product-copy">
        <div className="product-topline"><Link href={`/shop/${product.id}`} className="product-name">{product.name}</Link><span className="prep">{product.prepMinutes} min</span></div>
        {note ? <div className="product-note">{note}</div> : !compact && <div className="small muted" style={{marginTop:5}}>{product.description}</div>}
        <div className="price-row">
          <span className="price">₹{product.price}</span>
          <motion.button
            layout
            className={`add-button ${added ? 'added' : ''}`}
            onClick={handleAdd}
            disabled={soldOut}
            whileTap={reduce ? undefined : { scale: 0.92 }}
            transition={{ duration: 0.2, ease: EASE }}
            aria-label={soldOut ? `${product.name} is sold out` : `Add ${product.name} to bag`}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={soldOut ? 'sold' : added ? 'added' : 'add'} className="add-btn-content" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
                {soldOut ? 'Sold out' : added ? <><Check size={16}/> Added</> : <><Plus size={16}/> Add</>}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}
