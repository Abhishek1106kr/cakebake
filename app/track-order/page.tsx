'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Clock3 } from 'lucide-react';
import { useStore } from '@/components/store-provider';

// Old address. With an order, go to the live tracking page; without one, offer a lookup.
function TrackOrder() {
  const { latestOrder, mounted } = useStore();
  const search = useSearchParams();
  const router = useRouter();
  const [lookup, setLookup] = useState('');
  const requested = search.get('id');
  const target = requested ? requested.toUpperCase() : latestOrder?.id;

  useEffect(() => {
    if (mounted && target) router.replace(`/track/${encodeURIComponent(target)}` as Route);
  }, [mounted, target, router]);

  if (!mounted || target) return <main className="page"><div className="container page-loader" /></main>;
  return (
    <main className="status-page"><div className="container"><div className="order-card empty-state">
      <Clock3 size={28} />
      <div className="eyebrow">Track order</div>
      <h1 className="display h3">No live order yet.</h1>
      <p className="muted">Place an order and you can follow it here. Have an order number? Enter it below.</p>
      <form className="track-lookup" onSubmit={(e) => { e.preventDefault(); if (lookup.trim()) router.push(`/track/${encodeURIComponent(lookup.trim().toUpperCase())}` as Route); }}>
        <label htmlFor="track-id" className="sr-only">Order ID</label>
        <input id="track-id" placeholder="e.g. TRS-1042" value={lookup} onChange={(e) => setLookup(e.target.value)} />
        <button className="btn btn-secondary" type="submit">Track</button>
      </form>
      <Link className="btn btn-brand" href="/shop">Browse menu</Link>
    </div></div></main>
  );
}

export default function TrackOrderPage() {
  return <Suspense fallback={<main className="page"><div className="container page-loader" /></main>}><TrackOrder /></Suspense>;
}
