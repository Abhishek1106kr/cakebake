'use client';

import Link from 'next/link';
import { useEffect } from 'react';

// Next 16.3: error boundaries receive `retry` (stable since 16.3.0).
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="status-page wrap">
      <div className="eyebrow">A small hiccup</div>
      <h1 className="page-title display">Something went off-script.</h1>
      <p className="lede">Your bag and orders are still safe. Please try again.</p>
      <div className="empty-actions">
        <button type="button" className="btn btn-primary" onClick={() => retry()}>Try again</button>
        <Link href="/" className="btn btn-secondary">Back home</Link>
      </div>
    </main>
  );
}
