'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { StatusBadge, clock, rupees } from '@/components/admin/admin-utils';
import { CakePreview } from '@/components/cake-studio/preview';
import { find, printableArea, sizeOf } from '@/lib/cake/engine';
import { fonts, messageColors } from '@/lib/cake/config';
import { assetUrl } from '@/lib/cake/assets';
import type { CartLine, Order } from '@/lib/orders';

type Job = { order: Order; line: CartLine };

function useAsset(id: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let made: string | null = null;
    setUrl(null);
    if (id) assetUrl(id).then((u) => { made = u; setUrl(u); });
    return () => { if (made) URL.revokeObjectURL(made); };
  }, [id]);
  return url;
}

/** The bakery's production sheet for one custom cake. */
function Spec({ job }: { job: Job }) {
  const c = job.line.custom!.config;
  const artwork = useAsset(job.line.custom!.artworkAssetId);
  const photo = useAsset(job.line.custom!.printAssetId);
  const area = printableArea(c);
  const row = (label: string, value: string | number | null | undefined) => value ? <div key={label} className="spec-row"><dt>{label}</dt><dd>{value}</dd></div> : null;
  return (
    <div className="cc-spec">
      <div className="cc-previews">
        <div><CakePreview config={c} view="front" /><span>Side</span></div>
        <div><CakePreview config={c} view="top" printUrl={photo} /><span>Top</span></div>
      </div>
      <dl className="cc-table">
        {row('Design', job.line.custom!.designId)}
        {row('Order', `${job.order.id} · ${job.order.slot}`)}
        {row('Quantity', job.line.qty)}
        {row('Size', `${sizeOf(c).name} (${sizeOf(c).diameterCm} cm) · serves ${sizeOf(c).servings} · ${sizeOf(c).layers} layers`)}
        {row('Shape', find('shape', c.shape)?.name)}
        {row('Sponge', find('sponge', c.sponge)?.name)}
        {row('Filling', find('filling', c.filling)?.name)}
        {row('Frosting', `${find('frosting', c.frosting)?.name} · ${find('finish', c.finish)?.name} · ${find('color', c.color)?.name}`)}
        {row('Toppings', c.toppings.map((t) => `${find('toppings', t.id)?.name} ×${t.qty}`).join(', '))}
        {row('Decorations', c.decorations.map((d) => find('decorations', d)?.name).join(', '))}
        {row('Topper', c.topper.id !== 'none' ? `${find('topper', c.topper.id)?.name}${c.topper.text ? ` “${c.topper.text}”` : ''}` : null)}
        {row('Candles', c.candles.id !== 'none' ? `${find('candles', c.candles.id)?.name}${c.candles.text ? ` ${c.candles.text}` : ''}` : null)}
        {row('Packaging', find('packaging', c.packaging)?.name)}
        {row('Message', c.message.text ? `“${c.message.text.replace(/\n/g, ' / ')}” · ${fonts.find((f) => f.id === c.message.font)?.name} · ${messageColors.find((m) => m.hex === c.message.color)?.name ?? c.message.color} · ${Math.round(c.message.size * area.widthCm * 10) / 10} cm letters` : null)}
        {row('Photo print', c.print.enabled ? `${Math.round(c.print.scale * area.widthCm * 10) / 10} cm wide on a ${area.widthCm} × ${area.heightCm} cm area · rotated ${c.print.rotation}°` : null)}
        {row('Notes from customer', c.notes)}
        {row('Production time', `${job.line.custom!.productionHours} h`)}
        {row('Price', `${rupees(job.line.unitPrice)} (${job.line.custom!.priceVersion})`)}
      </dl>
      {c.print.enabled && (
        <div className="cc-artwork">
          {artwork ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={artwork} alt="Print artwork for this cake" />
              <a className="btn btn-primary btn-sm" href={artwork} download={`${job.line.custom!.designId}-print.png`}><Download size={14} /> Print artwork (PNG, 300 dpi)</a>
            </>
          ) : <p className="muted small">Print artwork is stored in the browser where the order was placed. Open this order there to download it.</p>}
        </div>
      )}
    </div>
  );
}

export default function CustomCakesPage() {
  const { orders, mounted } = useStore();
  const jobs = useMemo<Job[]>(() => orders.flatMap((order) => order.items.filter((l) => l.custom).map((line) => ({ order, line }))).sort((a, b) => b.order.createdAt.localeCompare(a.order.createdAt)), [orders]);
  const [selected, setSelected] = useState<string | null>(null);
  const current = jobs.find((j) => `${j.order.id}:${j.line.lineId}` === selected) ?? jobs[0];
  if (!mounted) return <div className="page-loader" />;
  return (
    <div>
      <div className="admin-top">
        <div>
          <div className="eyebrow">Production</div>
          <h1 className="display admin-title">Custom cakes.</h1>
          <div className="muted">Every custom order with its full specification, message and print artwork.</div>
        </div>
      </div>
      {jobs.length === 0 ? (
        <section className="panel"><p className="muted">No custom cake orders yet. They appear here as soon as one is placed from the Cake Playground.</p></section>
      ) : (
        <div className="cc-grid">
          <section className="panel cc-list">
            {jobs.map((j) => {
              const key = `${j.order.id}:${j.line.lineId}`;
              return (
                <button key={key} type="button" className={`cc-item ${current === j ? 'is-active' : ''}`} onClick={() => setSelected(key)}>
                  <CakePreview config={j.line.custom!.config} className="cc-thumb" />
                  <span><strong>{j.line.custom!.title}</strong><small>{j.order.id} · {clock(j.order.createdAt)} · {j.order.slot}</small></span>
                  <StatusBadge status={j.order.status} />
                </button>
              );
            })}
          </section>
          <section className="panel">{current && <Spec job={current} />}</section>
        </div>
      )}
    </div>
  );
}
