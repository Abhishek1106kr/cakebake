'use client';

import { useEffect, useState } from 'react';
import { find, printableArea, sizeOf } from '@/lib/cake/engine';
import { fonts, messageColors } from '@/lib/cake/config';
import { assetUrl } from '@/lib/cake/assets';
import type { CartLine } from '@/lib/orders';

/** A browser-stored image (the customer's photo or the print artwork) as an object URL. */
export function useAsset(id: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let made: string | null = null;
    setUrl(null);
    if (id) assetUrl(id).then((u) => { made = u; setUrl(u); });
    return () => { if (made) URL.revokeObjectURL(made); };
  }, [id]);
  return url;
}

export type SpecRow = { label: string; value: string };

/**
 * The production specification of a custom cake line. Option names come from the
 * order's snapshot (what the customer saw when ordering); geometry (cm, layers) is
 * read from the configuration itself.
 */
export function specRows(line: CartLine, opts: { compact?: boolean } = {}): SpecRow[] {
  const spec = line.custom!;
  const c = spec.config;
  const snap = spec.snapshot?.options ?? {};
  const name = (key: string, live: string | undefined) => snap[key] ?? live ?? '—';
  const size = sizeOf(c);
  const area = size ? printableArea(c) : null;
  const rows: (SpecRow | null)[] = [
    { label: 'Size', value: `${name('size', size?.name)}${size ? ` (${size.diameterCm} cm) · serves ${size.servings} · ${size.layers} layers` : ''}` },
    { label: 'Shape', value: name('shape', find('shape', c.shape)?.name) },
    { label: 'Sponge', value: name('sponge', find('sponge', c.sponge)?.name) },
    { label: 'Filling', value: name('filling', find('filling', c.filling)?.name) },
    { label: 'Frosting', value: name('frosting', find('frosting', c.frosting)?.name) },
    { label: 'Finish', value: name('finish', find('finish', c.finish)?.name) },
    { label: 'Colour', value: name('color', find('color', c.color)?.name) },
    c.toppings.length ? { label: 'Toppings', value: snap.toppings ?? c.toppings.map((t) => `${find('toppings', t.id)?.name ?? t.id} ×${t.qty}`).join(', ') } : opts.compact ? null : { label: 'Toppings', value: 'None' },
    c.decorations.length ? { label: 'Decorations', value: snap.decorations ?? c.decorations.map((d) => find('decorations', d)?.name ?? d).join(', ') } : opts.compact ? null : { label: 'Decorations', value: 'None' },
    c.topper.id !== 'none' ? { label: 'Topper', value: snap.topper ?? `${find('topper', c.topper.id)?.name}${c.topper.text ? ` “${c.topper.text}”` : ''}` } : opts.compact ? null : { label: 'Topper', value: 'None' },
    c.candles.id !== 'none' ? { label: 'Candles', value: snap.candles ?? `${find('candles', c.candles.id)?.name}${c.candles.text ? ` ${c.candles.text}` : ''}` } : opts.compact ? null : { label: 'Candles', value: 'None' },
    { label: 'Packaging', value: name('packaging', find('packaging', c.packaging)?.name) },
    c.message.text ? { label: 'Message', value: `“${c.message.text.replace(/\n/g, ' / ')}”` } : { label: 'Message', value: 'None' },
    c.message.text ? { label: 'Font', value: `${snap.messageFont ?? fonts.find((f) => f.id === c.message.font)?.name ?? c.message.font}${area ? ` · ${Math.round(c.message.size * area.widthCm * 10) / 10} cm letters` : ''}` } : null,
    c.message.text ? { label: 'Message colour', value: snap.messageColor ?? messageColors.find((m) => m.hex === c.message.color)?.name ?? c.message.color } : null,
    { label: 'Photo print', value: c.print.enabled && area ? `Yes · ${Math.round(c.print.scale * area.widthCm * 10) / 10} cm wide on a ${area.widthCm} × ${area.heightCm} cm area · rotated ${c.print.rotation}°` : 'No' },
    c.notes ? { label: 'Customer notes', value: c.notes } : null,
    { label: 'Production time', value: `${spec.productionHours} h` },
  ];
  return rows.filter((r): r is SpecRow => r !== null);
}
