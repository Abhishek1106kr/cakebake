import Link from 'next/link';

export const metadata = { title: 'Customize a cake · Tresor' };

// Placeholder page: the cake customiser is planned but not built yet.
export default function CustomizeCakePage() {
  return (
    <main className="page section coming-soon">
      <div className="eyebrow">CUSTOMIZE CAKE</div>
      <h1 className="section-title font-display">Your cake, your way.</h1>
      <p className="lede">Custom cakes are coming soon. Until then, explore today’s bakes.</p>
      <Link href="/menu" className="btn btn-primary">EXPLORE MENU</Link>
    </main>
  );
}
