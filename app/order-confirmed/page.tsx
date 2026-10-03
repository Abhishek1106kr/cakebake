'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, Copy, MapPin, MessageCircle, Sparkles } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function OrderConfirmedPage() {
  const { latestOrder } = useStore();
  const search = useSearchParams();
  const [copied, setCopied] = useState(false);
  const orderId = latestOrder?.id ?? search.get('id') ?? 'TRS-1041';
  const copy = async () => { try { await navigator.clipboard.writeText(orderId); setCopied(true); setTimeout(()=>setCopied(false), 1200); } catch {} };
  return <main className="status-page success-page"><div className="container"><div className="success-orbit"><div className="success-check"><CheckCircle2 size={45}/></div></div><div className="order-card success-card"><div className="eyebrow">Order confirmed</div><h1 className="display h2">We’ve got it.</h1><p className="success-copy">Order <strong>{orderId}</strong> is confirmed. We’ll keep you posted as it moves from counter to door.</p><div className="order-id"><span>Order ID</span><strong>{orderId}</strong><button onClick={copy} aria-label="Copy order ID">{copied ? <CheckCircle2 size={16}/> : <Copy size={16}/>}</button></div><div className="success-actions"><Link className="btn btn-brand btn-lg" href="/track-order">Track my order <ArrowRight size={16}/></Link><Link className="btn btn-secondary btn-lg" href="/shop">Order something else</Link></div><div className="quick-status"><div><MapPin size={18}/><span>Delivery to<br/><strong>{latestOrder?.city || 'Bengaluru'}</strong></span></div><div><Sparkles size={18}/><span>Next update<br/><strong>Preparing</strong></span></div><div><MessageCircle size={18}/><span>Support<br/><strong>WhatsApp</strong></span></div></div></div></div></main>;
}
