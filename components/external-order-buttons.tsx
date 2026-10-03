'use client';

import { ExternalLink } from 'lucide-react';

const zomato = process.env.NEXT_PUBLIC_ZOMATO_URL || 'https://www.zomato.com/';
const swiggy = process.env.NEXT_PUBLIC_SWIGGY_URL || 'https://www.swiggy.com/';

export function ExternalOrderButtons({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`external-order ${compact ? 'compact' : ''}`}>
      <a href={zomato} target="_blank" rel="noreferrer" className="external-link zomato"><span>Order on Zomato</span><ExternalLink size={14}/></a>
      <a href={swiggy} target="_blank" rel="noreferrer" className="external-link swiggy"><span>Order on Swiggy</span><ExternalLink size={14}/></a>
    </div>
  );
}
