'use client';

import { ArrowUpRight } from 'lucide-react';
import { useExternalRedirect } from '@/components/external/order-elsewhere';
import { site } from '@/data/site';

/** Directions plus Zomato / Swiggy, each with the short redirect transition. */
export function VisitActions() {
  const { go, overlay } = useExternalRedirect();
  const destinations = [
    { name: 'Directions', label: 'Maps', url: site.links.maps },
    { name: 'Zomato', label: 'Zomato', url: site.links.zomato },
    { name: 'Swiggy', label: 'Swiggy', url: site.links.swiggy },
  ];
  return (
    <div className="visit-actions">
      {destinations.map((d) =>
        d.url ? (
          <a key={d.name} href={d.url} rel="noopener noreferrer" onClick={go({ name: d.label, url: d.url })} className={d.name === 'Directions' ? 'btn btn-primary' : 'btn btn-secondary'}>
            {d.name === 'Directions' ? 'Get directions' : `Order on ${d.name}`} <ArrowUpRight size={14} strokeWidth={1.5} />
          </a>
        ) : (
          <span key={d.name} className="btn btn-ghost is-unavailable" title="Link not configured yet">{d.name === 'Directions' ? 'Directions' : d.name} · soon</span>
        ),
      )}
      {overlay}
    </div>
  );
}
