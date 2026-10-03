'use client';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Product } from '@/lib/products';
import { useStore } from './store';
import { motion } from 'framer-motion';

export function ProductCard({ product, className = '' }: { product: Product; className?: string }) {
  const { addToCart } = useStore();
  return (
    <motion.article className={`menu-card ${className}`} whileHover={{ y: -4 }} transition={{ duration: .2 }}>
      <Link href={`/product/${product.slug}`}>
        <div className={`editorial-image tone-${product.imageTone}`} style={{ minHeight: 320 }}>
          <span className="editorial-label">Editorial product image</span>
        </div>
        <h3 className="product-title">{product.name}</h3>
      </Link>
      <p className="product-price">{product.description}</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <strong style={{ fontSize: 13 }}>₹{product.price}</strong>
        <button className="btn btn-secondary" onClick={() => addToCart(product)} aria-label={`Add ${product.name} to cart`} style={{ minHeight: 38, padding: '0 12px' }}><Plus size={15} /> ADD</button>
      </div>
    </motion.article>
  );
}
