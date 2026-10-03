'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock3, MapPin, MessageCircle } from 'lucide-react';
import { useStore } from '@/components/store-provider';

const steps = [
  ['NEW', 'Order received'], ['CONFIRMED', 'Confirmed'], ['PREPARING', 'Preparing'], ['READY', 'Ready'], ['OUT_FOR_DELIVERY', 'Out for delivery'], ['DELIVERED', 'Delivered'],
];

export default function TrackOrderPage() {
  const { latestOrder, mounted } = useStore();
  if (!mounted) return <main className="page"><div className="container page-loader"/></main>;
  if (!latestOrder) return <main className="status-page"><div className="container"><div className="order-card empty-state"><Clock3 size={28}/><div className="eyebrow">Track order</div><h1 className="display h3">No live order yet.</h1><p className="muted">Place a mock order first and the timeline will light up here.</p><Link className="btn btn-brand" href="/shop">Browse menu</Link></div></div></main>;
  const currentIndex = Math.max(0, steps.findIndex(([key]) => key === latestOrder.status));
  return <main className="status-page track-page"><div className="container"><Link className="back-link" href="/"> <ArrowLeft size={14}/> Back home</Link><div className="order-card"><div className="track-head"><div><div className="eyebrow">Live order</div><h1 className="display h3">#{latestOrder.id}</h1><p className="muted">{latestOrder.slot} · {latestOrder.address}</p></div><span className="status-live">Kitchen live</span></div><div className="timeline">{steps.map(([key, label], index) => <div className={`timeline-step ${index < currentIndex ? 'done' : ''} ${index === currentIndex ? 'active' : ''}`} key={key}><div className="timeline-dot">{index < currentIndex ? <CheckCircle2 size={14}/> : index === currentIndex ? <Clock3 size={14}/> : null}</div><div><strong>{label}</strong><small>{index <= currentIndex ? (index === currentIndex ? 'Right now' : 'Done') : 'Queued'}</small></div></div>)}</div><div className="track-panels"><div className="track-info"><MapPin size={18}/><div><span>Delivering to</span><strong>{latestOrder.city} · {latestOrder.pin}</strong></div></div><div className="track-info"><MessageCircle size={18}/><div><span>Need help?</span><strong>Chat with Tresor</strong></div></div></div></div></div></main>;
}
