import Link from 'next/link';

export function OrderMissing({ id }: { id: string }) {
  return (
    <main className="order-missing wrap">
      <div className="eyebrow">Order #{id}</div>
      <h1 className="page-title display">We couldn&rsquo;t find that order on this device.</h1>
      <p className="lede">Orders are kept in the browser they were placed from. If you ordered on another phone or browser, open the link there.</p>
      <div className="empty-actions">
        <Link href="/account" className="btn btn-primary">Your orders</Link>
        <Link href="/menu" className="btn btn-secondary">Back to menu</Link>
      </div>
    </main>
  );
}
