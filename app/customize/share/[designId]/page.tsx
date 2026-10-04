'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { decodeDesign, designIdFor, price, productionHours, summary } from '@/lib/cake/engine';
import { CakePreview } from '@/components/cake-studio/preview';
import { track } from '@/engine/intelligence/events/track';

export default function SharedCakePage() {
  const { designId } = useParams<{ designId: string }>();
  const config = useMemo(() => decodeDesign(designId), [designId]);
  useEffect(() => { if (config) track('design_reopened', { designId: designIdFor(config), from: 'share' }); }, [config]);
  if (!config) {
    return <main className="page"><section className="section"><div className="container"><div className="eyebrow">Cake Playground</div><h1 className="display h2">This cake link isn’t valid.</h1><Link className="btn btn-brand" href="/customize" style={{ marginTop: 24 }}>Design your own</Link></div></section></main>;
  }
  const s = summary(config);
  return (
    <main className="page shared-cake">
      <div className="container shared-grid">
        <div className="shared-preview"><CakePreview config={config} /></div>
        <div className="shared-copy">
          <div className="eyebrow">A cake designed at Tresor</div>
          <h1 className="display shared-title">{s.title}</h1>
          <ul className="spec-list">{s.lines.map((l) => <li key={l}>{l}</li>)}</ul>
          <p className="shared-price">₹{price(config).total.toLocaleString('en-IN')} <span>· made to order in about {productionHours(config)} h</span></p>
          <Link className="btn btn-brand" href={`/customize?design=${designId}` as Route}>Customize this cake</Link>
          <p className="studio-note">Design {designIdFor(config)}. Photos are never part of a shared link.</p>
        </div>
      </div>
    </main>
  );
}
