'use client';

import Link from 'next/link';
import { Check, Plus } from 'lucide-react';
import { Product } from '@/lib/data';
import { useStore } from './store-provider';
import { useState } from 'react';

export function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const { addToCart } = useStore();
  const [added, setAdded] = useState(false);
  const handleAdd = () => {
    addToCart(product);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1100);
  };
  return (
    <article className={`product-card ${compact ? 'product-card-compact' : ''}`}>
      <Link href={`/shop/${product.id}`} className={`product-art ${product.image}`}>
        {product.tag && <span className="product-tag">{product.tag}</span>}
        <div className="product-visual-text"><span>{product.category}</span><strong>{product.name}</strong></div>
      </Link>
      <div className="product-copy">
        <div className="product-topline"><Link href={`/shop/${product.id}`} className="product-name">{product.name}</Link><span className="prep">{product.prepMinutes} min</span></div>
        {!compact && <div className="small muted" style={{marginTop:5}}>{product.description}</div>}
        <div className="price-row"><span className="price">₹{product.price}</span><button className={`add-button ${added ? 'added' : ''}`} onClick={handleAdd}>{added ? <><Check size={16}/> Added</> : <><Plus size={16}/> Add</>}</button></div>
      </div>
    </article>
  );
}
