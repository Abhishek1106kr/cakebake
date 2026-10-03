'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
export default function OrderPage() { const params = useParams<{ id: string }>(); return <main className="page"><div className="center-card"><div className="eyebrow">ORDER CONFIRMED</div><h1 className="font-display">You’re going to have<br/>a very good afternoon.</h1><div className="order-code">#{params.id}</div><div style={{ marginTop:34, color:'var(--muted)', fontSize:13 }}>Estimated delivery · 35–45 min</div><div style={{ marginTop:8, color:'var(--success)', fontSize:13 }}>Payment status · Successful (mock)</div><div className="order-actions"><Link href={`/track/${params.id}`} className="btn btn-primary">TRACK ORDER <ArrowRight size={14}/></Link><Link href="/menu" className="btn btn-secondary">BACK TO MENU</Link></div></div></main>; }
