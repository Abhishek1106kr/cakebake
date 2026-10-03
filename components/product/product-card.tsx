'use client';

import { motion } from 'framer-motion';
import { Check, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { ProductArt } from '@/components/media/product-art';
import { useFeedback } from '@/components/providers/feedback-provider';
import { useStore } from '@/components/providers/store-provider';
import type { Product } from '@/data/products';
import { formatPrice } from '@/lib/format';
import { EASE } from '@/lib/motion/transitions';

type ProductCardProps = {
  product: Product;
  index?: number;
  reasons?: string[];
  highlight?: boolean;
  size?: 'default' | 'large';
};

export function ProductCard({ product, index, reasons, highlight = false, size = 'default' }: ProductCardProps) {
  const { addToCart } = useStore();
  const { flyToBag, toast } = useFeedback();
  const artRef = useRef<HTMLAnchorElement>(null);
  const [added, setAdded] = useState(false);

  const add = () => {
    const count = addToCart(product.slug, 'regular', 1);
    if (count === 0) { toast('That is the most we can pack of one item.'); return; }
    flyToBag(artRef.current, product);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  };

  return (
    <article className={`product-card ${size === 'large' ? 'is-large' : ''} ${highlight ? 'is-match' : ''}`}>
      <Link href={`/product/${product.slug}`} className="card-media" ref={artRef} aria-label={product.name}>
        <ProductArt product={product} sizes={size === 'large' ? '(max-width: 760px) 100vw, 50vw' : '(max-width: 760px) 50vw, 25vw'} />
        {index !== undefined && <span className="card-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>}
        {product.eggless && <span className="card-tag">Eggless</span>}
      </Link>
      <div className="card-caption">
        <div className="card-title-row">
          <Link href={`/product/${product.slug}`} className="card-title display">{product.name}</Link>
          <span className="card-price">{formatPrice(product.price)}</span>
        </div>
        <p className="card-short">{product.short}</p>
        {reasons && reasons.length > 0 && <p className="card-reason">Picked for {reasons.join(' · ')}</p>}
        <motion.button
          type="button"
          className={`add-btn ${added ? 'is-added' : ''}`}
          onClick={add}
          layout
          transition={{ duration: 0.22, ease: EASE }}
          aria-label={added ? `${product.name} added to bag` : `Add ${product.name} to bag`}
        >
          {added ? (
            <>
              <Check size={14} strokeWidth={2} className="check-draw" /> Added
            </>
          ) : (
            <>
              <Plus size={14} strokeWidth={1.6} /> Add
            </>
          )}
        </motion.button>
      </div>
    </article>
  );
}
