'use client';

import Link from 'next/link';
import { ArrowLeft, Check, Minus, Plus, ShieldCheck, Truck } from 'lucide-react';
import { products } from '@/lib/data';
import { useStore } from '@/components/store-provider';
import { ExternalOrderButtons } from '@/components/external-order-buttons';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

export default function ProductPage() {
  const { id } = useParams<{id: string}>();
  const product = useMemo(() => products.find((p) => p.id === id) ?? products[0], [id]);
  const [qty, setQty] = useState(1);
  const [size, setSize] = useState('Regular');
  const { addToCart } = useStore();
  const router = useRouter();
  const price = product.price + (size === 'Large' ? 40 : 0);
  const add = () => { addToCart(product, qty); router.push('/cart'); };
  return <main className="page"><div className="container product-detail"><div className={`product-detail-art ${product.image}`}><span className="product-tag">{product.tag ?? 'Made fresh'}</span><div className="detail-art-caption"><span>{product.category}</span><strong>{product.name}</strong><small>Crafted in small batches at Tresor.</small></div></div><div className="product-detail-copy"><Link className="back-link" href="/shop"><ArrowLeft size={14}/> Back to menu</Link><div className="eyebrow detail-eyebrow">{product.tag ?? 'Made fresh'}</div><h1 className="display h2">{product.name}</h1><div className="price-lg">₹{price}</div><p className="product-detail-description">{product.description} Expect crisp edges, a soft middle and a finish that feels intentional rather than overworked.</p><div className="option-group"><span className="option-label">Size</span><div className="option-row"><button className={`option ${size === 'Regular' ? 'active' : ''}`} onClick={() => setSize('Regular')}>Regular</button><button className={`option ${size === 'Large' ? 'active' : ''}`} onClick={() => setSize('Large')}>Large + ₹40</button></div></div><div className="option-group"><span className="option-label">Quantity</span><div className="qty"><button aria-label="Decrease quantity" onClick={() => setQty(Math.max(1, qty-1))}><Minus size={14}/></button><span>{qty}</span><button aria-label="Increase quantity" onClick={() => setQty(qty+1)}><Plus size={14}/></button></div></div><button className="btn btn-brand btn-lg full-btn" onClick={add}>Add {qty} to bag · ₹{price * qty}</button><div className="info-strip"><div className="info-card"><Check size={14}/>Freshly prepared</div><div className="info-card"><Truck size={14}/>Delivery-ready</div><div className="info-card"><ShieldCheck size={14}/>Secure checkout</div></div><div className="divider"/><div className="alt-order"><div><span className="eyebrow">Prefer a marketplace?</span><p>Open this cafe on your usual delivery app.</p></div><ExternalOrderButtons compact/></div></div></div></main>;
}
