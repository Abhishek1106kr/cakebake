'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { ArrowLeft, Plus, Minus, ShoppingBag } from 'lucide-react';
import { products } from '@/lib/products';
import { useStore } from '@/components/store';
import { AddButton, Reveal } from '@/components/motion';
import { MAX_QTY } from '@/lib/commerce';
import { EASE } from '@/lib/motion';
import { anatomy, storageFor, type Layer } from '@/lib/product-details';

/** REFERENCES.md §6 (from Belagio): show the inside. Hairlines draw to each layer as you scroll. */
function Inside({ layers }: { layers: Layer[] }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(reduce ? layers.length - 1 : -1);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 65%', 'end 75%'] });
  useMotionValueEvent(scrollYProgress, 'change', (v) => { if (!reduce) setActive(Math.min(layers.length - 1, Math.floor(v * (layers.length + 0.4)))); });
  const y = (i: number) => 26 + (i * 48) / Math.max(1, layers.length - 1);
  return (
    <section ref={ref} className="inside" aria-labelledby="inside-title">
      <div className="inside-stage"><div className="inside-media">
        <div className="editorial-image tone-warm" style={{ minHeight: '100%' }}><span className="editorial-label">Cross-section photograph</span></div>
        <svg className="inside-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {layers.map((layer, i) => (
            <g key={layer.label}>
              <motion.circle cx={50 - i * 1.5} cy={y(i)} r="0.9" initial={false} animate={{ opacity: i <= active ? 1 : 0 }} />
              <motion.path d={`M${50 - i * 1.5} ${y(i)} L100 ${y(i)}`} vectorEffect="non-scaling-stroke" initial={false} animate={{ pathLength: i <= active ? 1 : 0, opacity: i <= active ? 1 : 0 }} transition={{ duration: reduce ? 0 : 0.6, ease: EASE }} />
            </g>
          ))}
        </svg>
      </div></div>
      <div>
        <div className="eyebrow">INSIDE</div>
        <h2 id="inside-title" className="section-title font-display">What you’re tasting.</h2>
        <ol className="inside-list">
          {layers.map((layer, i) => (
            <li key={layer.label} className={i <= active ? 'is-active' : ''}><span className="inside-num">{String(i + 1).padStart(2, '0')}</span><div><strong className="font-display">{layer.label}</strong><span>{layer.detail}</span></div></li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** REFERENCES.md §6 (from Paris Baguette): disclosure with an interruptible height animation. */
function Disclosure({ title, children, open: initiallyOpen = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <div className="disclosure">
      <button type="button" className="disclosure-trigger" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span>{title}</span><motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }}><Plus size={16} /></motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && <motion.div className="disclosure-panel" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.26, ease: EASE }}><p>{children}</p></motion.div>}
      </AnimatePresence>
    </div>
  );
}

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const product = products.find(p => p.slug === slug);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const { addToCart } = useStore();
  if (!product) return notFound();
  const layers = anatomy[product.slug];
  const add = () => {
    const added = addToCart(product, quantity);
    setNote(added === 0 ? `We can pack up to ${MAX_QTY} of one item.` : added < quantity ? `Added ${added}: that’s the most we can pack.` : `${product.name} is in your bag.`);
    return added > 0;
  };
  return <main className="page section"><Link href="/menu" className="eyebrow" style={{ display:'inline-flex', gap:8, alignItems:'center' }}><ArrowLeft size={14}/> Back to menu</Link>
    <div className="product-detail">
      <motion.div className="editorial-image" style={{ minHeight:620 }} initial={{ clipPath: 'inset(100% 0% 0% 0%)', scale: 1.03 }} animate={{ clipPath: 'inset(0% 0% 0% 0%)', scale: 1 }} transition={{ duration: 1, ease: EASE }}><span className="editorial-label">Macro product photograph</span></motion.div>
      <motion.div className="product-info" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.7, ease: EASE }}>
        <div className="eyebrow" style={{ color:'white' }}>01 / SIGNATURE {product.categories[0].toUpperCase()}</div>
        <h1 className="font-display">{product.name}</h1>
        <p>{product.description}</p>
        <AnimatePresence mode="popLayout" initial={false}><motion.div key={quantity} className="product-price-lg" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>₹{product.price * quantity}</motion.div></AnimatePresence>
        <div className="meta-line"><span className="breathing-dot" aria-hidden="true" /> Today · freshly prepared</div>
        <div className="qty"><button aria-label="One fewer" onClick={() => setQuantity(q => Math.max(1,q-1))}><Minus size={16}/></button><span aria-live="polite">{quantity}</span><button aria-label="One more" disabled={quantity >= MAX_QTY} onClick={() => setQuantity(q => Math.min(MAX_QTY, q+1))}><Plus size={16}/></button></div>
        <AddButton onAdd={add} label={<><ShoppingBag size={15}/> ADD TO BAG · ₹{product.price * quantity}</>} addedLabel="ADDED TO YOUR BAG" />
        <AnimatePresence>{note && <motion.p className="add-note" key={note} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{note} <Link href="/cart">View bag →</Link></motion.p>}</AnimatePresence>
        <div style={{ marginTop: 36 }}><div className="meta-line">Delivery / Pickup</div><p style={{ marginTop: 8 }}>Bengaluru delivery available. Order for delivery or pick up from the bakery.</p></div>
      </motion.div>
    </div>
    {layers && <Inside layers={layers} />}
    <section className="details">
      <Disclosure title="INGREDIENTS" open>{product.description.replace(/ · /g, ', ')}. Made in a bakery that handles nuts, gluten, dairy and egg.</Disclosure>
      <Disclosure title="STORAGE">{storageFor(product.categories)}</Disclosure>
    </section>
    <section style={{ marginTop: 80 }}><Reveal><div className="eyebrow">YOU MAY ALSO LIKE</div></Reveal><div className="related-grid">{products.filter(p=>p.slug!==product.slug).slice(0,3).map((p, i) => <Reveal key={p.slug} delay={i * 0.06}><Link href={`/product/${p.slug}`} className="card-link"><div className="card-media"><div className="editorial-image" style={{ minHeight:150 }}><span className="editorial-label">Product image</span></div></div><div className="product-title">{p.name}</div><div className="product-price">₹{p.price}</div></Link></Reveal>)}</div></section>
  </main>;
}
