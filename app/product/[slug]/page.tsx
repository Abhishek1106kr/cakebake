'use client';
import { useState } from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { ArrowLeft, Plus, Minus, ShoppingBag } from 'lucide-react';
import { products } from '@/lib/products';
import { useStore } from '@/components/store';

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const product = products.find(p => p.slug === slug);
  const [quantity, setQuantity] = useState(1);
  const { addToCart } = useStore();
  if (!product) return notFound();
  return <main className="page section"><Link href="/menu" className="eyebrow" style={{ display:'inline-flex', gap:8, alignItems:'center' }}><ArrowLeft size={14}/> Back to menu</Link>
    <div className="product-detail"><div className="editorial-image" style={{ minHeight:620 }}><span className="editorial-label">Macro product photograph</span></div><div className="product-info"><div className="eyebrow" style={{ color:'white' }}>01 / SIGNATURE PASTRY</div><h1 className="font-display">{product.name}</h1><p>{product.description}</p><div className="product-price-lg">₹{product.price}</div><div className="meta-line">Today · freshly prepared</div><div className="qty"><button onClick={() => setQuantity(q => Math.max(1,q-1))}><Minus size={16}/></button><span>{quantity}</span><button onClick={() => setQuantity(q => q+1)}><Plus size={16}/></button></div><button className="btn btn-secondary" onClick={() => addToCart(product, quantity)}><ShoppingBag size={15}/> ADD TO CART</button><div style={{ marginTop: 36 }}><div className="meta-line">Delivery / Pickup</div><p style={{ marginTop: 8 }}>Bengaluru delivery available. Order for delivery or pick up from the bakery.</p></div></div></div>
    <section style={{ marginTop: 80 }}><div className="eyebrow">YOU MAY ALSO LIKE</div><div className="related-grid">{products.filter(p=>p.slug!==product.slug).slice(0,3).map(p => <Link key={p.slug} href={`/product/${p.slug}`}><div className="editorial-image" style={{ minHeight:150 }}><span className="editorial-label">Product image</span></div><div className="product-title">{p.name}</div><div className="product-price">₹{p.price}</div></Link>)}</div></section>
  </main>;
}
