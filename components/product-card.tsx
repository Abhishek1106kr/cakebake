'use client';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Product } from '@/lib/products';
import { useStore } from './store';
import { AddButton } from './motion';

export function ProductCard({ product, className = '', reason }: { product: Product; className?: string; reason?: string }) {
  const { addToCart } = useStore();
  return (
    <article className={`menu-card ${className}`}>
      <Link href={`/product/${product.slug}`} className="card-link">
        <div className="card-media"><div className={`editorial-image tone-${product.imageTone}`} style={{ minHeight: 320 }}>
          <span className="editorial-label">Editorial product image</span>
        </div></div>
        <h3 className="product-title">{product.name}</h3>
      </Link>
      <p className="product-price">{product.description}</p>
      {reason && <p className="card-reason">Picked for {reason}</p>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <strong className="card-amount" style={{ fontSize: 13 }}>₹{product.price}</strong>
        <AddButton onAdd={() => addToCart(product) > 0} label={<><Plus size={15} /> ADD</>} className="btn btn-secondary btn-compact" />
      </div>
    </article>
  );
}
