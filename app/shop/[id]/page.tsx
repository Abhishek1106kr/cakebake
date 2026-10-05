'use client';

import Link from 'next/link';
import { ArrowLeft, Check, Minus, Plus, ShieldCheck, Truck } from 'lucide-react';
import { products } from '@/lib/data';
import { useStore } from '@/components/store-provider';
import { ExternalOrderButtons } from '@/components/external-order-buttons';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { LARGE_SURCHARGE, Size, sizesFor, unitPrice } from '@/lib/orders';
import { motion } from 'framer-motion';
import { EASE } from '@/lib/motion';
import { CakeCampaign } from '@/components/cake';
import { PairsRow } from '@/components/recommendations';
import { track, useTrackOnce } from '@/components/intelligence';

export default function ProductPage() {
  const { id } = useParams<{id: string}>();
  const { addToCart, canAddMore, mounted, catalogRevision } = useStore();
  // The live menu: a product the bakery disabled or archived is no longer found here.
  const found = useMemo(() => products.find((p) => p.id === id), [id, catalogRevision]); // eslint-disable-line react-hooks/exhaustive-deps
  const product = found ?? products[0];
  const sizes = sizesFor(product);
  const [qty, setQty] = useState(1);
  const [size, setSize] = useState<Size>('Regular');
  const router = useRouter();
  const price = unitPrice(product, size);
  const available = mounted ? canAddMore(product, size) : 99;
  const soldOut = available === 0;
  const add = () => { if (addToCart(product, Math.min(qty, available), size) > 0) router.push('/cart'); };
  useTrackOnce(Boolean(found), product.id, () => track('product_view', { productId: product.id, category: product.category }));
  if (!found) return mounted
    ? <main className="page"><div className="container product-detail"><div className="product-detail-copy"><Link className="back-link" href="/shop"><ArrowLeft size={14}/> Back to menu</Link><h1 className="display h2">No longer on the menu</h1><p className="product-detail-description">This item isn’t available right now. Have a look at what’s on today.</p><Link className="btn btn-brand btn-lg" href="/shop">See the menu</Link></div></div></main>
    : <div className="page-loader" />;
  if (product.cake) return <><CakeCampaign product={product} /><PairsRow productId={product.id} /></>;
  return <main className="page"><div className="container product-detail"><motion.div key={product.id} className={`product-detail-art ${product.image} p-${product.id}`} initial={{ clipPath: 'inset(100% 0% 0% 0% round 30px)', scale: 1.06 }} animate={{ clipPath: 'inset(0% 0% 0% 0% round 30px)', scale: 1 }} transition={{ duration: 1.0, ease: EASE }}><span className="product-tag">{product.tag ?? 'Made fresh'}</span><div className="detail-art-caption"><span>{product.category}</span><strong>{product.name}</strong><small>Crafted in small batches at Tresor.</small></div></motion.div><motion.div className="product-detail-copy" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.07, delayChildren: 0.25 } } }}><Link className="back-link" href="/shop"><ArrowLeft size={14}/> Back to menu</Link><div className="eyebrow detail-eyebrow">{product.tag ?? 'Made fresh'}</div><motion.h1 className="display h2" variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } }}>{product.name}</motion.h1><motion.div key={price} className="price-lg" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>₹{price}</motion.div><p className="product-detail-description">{product.description} Expect crisp edges, a soft middle and a finish that feels intentional rather than overworked.</p>{sizes.length > 1 && <div className="option-group"><span className="option-label">Size</span><div className="option-row">{sizes.map((s) => <button key={s} className={`option ${size === s ? 'active' : ''}`} onClick={() => { setSize(s); setQty(1); }}>{s === 'Large' ? `Large + ₹${LARGE_SURCHARGE}` : s}</button>)}</div></div>}<div className="option-group"><span className="option-label">Quantity</span><div className="qty"><button aria-label="Decrease quantity" onClick={() => setQty(Math.max(1, qty-1))}><Minus size={14}/></button><span>{qty}</span><button aria-label="Increase quantity" disabled={qty >= available} onClick={() => setQty(Math.min(available, qty+1))}><Plus size={14}/></button></div>{mounted && !soldOut && available <= 5 && <span className="stock-note">Only {available} left today</span>}</div><motion.button whileHover={soldOut ? undefined : { scale: 1.02 }} whileTap={soldOut ? undefined : { scale: 0.97 }} className="btn btn-brand btn-lg full-btn" onClick={add} disabled={soldOut}>{soldOut ? 'Sold out for today' : `Add ${qty} to bag · ₹${price * qty}`}</motion.button><div className="info-strip"><div className="info-card"><Check size={14}/>Freshly prepared</div><div className="info-card"><Truck size={14}/>Delivery-ready</div><div className="info-card"><ShieldCheck size={14}/>Secure checkout</div></div><div className="divider"/><div className="alt-order"><div><span className="eyebrow">Prefer a marketplace?</span><p>Open Tresor on your usual delivery app.</p></div><ExternalOrderButtons compact/></div></motion.div></div><PairsRow productId={product.id} /></main>;
}
