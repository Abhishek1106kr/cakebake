import Link from 'next/link';

export const metadata = { title: 'Customize a cake · Tresor' };

// Placeholder page: the cake customiser is planned but not built yet.
export default function CustomizeCakePage() {
  return (
    <main className="page">
      <section className="section">
        <div className="container">
          <div className="eyebrow">Customize cake</div>
          <h1 className="display h2">Your cake, your way.</h1>
          <p className="muted" style={{ maxWidth: 520, marginTop: 14 }}>Custom cakes are coming soon. Until then, explore today’s bakes.</p>
          <Link className="btn btn-brand" href="/shop" style={{ marginTop: 24 }}>Browse menu</Link>
        </div>
      </section>
    </main>
  );
}
