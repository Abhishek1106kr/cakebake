'use client';

import { useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Crosshair, ImagePlus, Maximize2, Minimize2, Minus, Plus, RotateCcw, RotateCw, Trash2 } from 'lucide-react';
import * as C from '@/lib/cake/config';
import { find, fitPlacement, messageColorOptions, options, messageFit, messageFonts, optionState, printCheck, printableArea, sizeOf, type CakeContext } from '@/lib/cake/engine';
import type { CakeConfiguration, OptionBase, OptionGroupId } from '@/lib/cake/types';
import { processUpload } from '@/lib/cake/assets';
import { track } from '@/engine/intelligence/events/track';

type SetFn = (c: CakeConfiguration, meta?: { group?: string; optionId?: string; coalesce?: string }) => void;
const rupee = (n: number) => (n ? `+₹${n.toLocaleString('en-IN')}` : 'Included');

export function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="studio-section" id={`opt-${id}`} aria-labelledby={`opt-${id}-title`}>
      <div className="studio-section-head"><h3 id={`opt-${id}-title`}>{title}</h3>{hint && <span>{hint}</span>}</div>
      {children}
    </section>
  );
}

/** Single-choice tiles. Disabled tiles stay visible with the reason. */
export function OptionTiles<T extends OptionBase>({ group, items, config, ctx, set, render, meta, columns = 3 }: {
  group: Exclude<OptionGroupId, 'toppings' | 'decorations' | 'print'>; items: T[]; config: CakeConfiguration; ctx: CakeContext; set: SetFn;
  render?: (o: T) => ReactNode; meta?: (o: T) => string; columns?: number;
}) {
  const value = group === 'topper' ? config.topper.id : group === 'candles' ? config.candles.id : (config[group as keyof CakeConfiguration] as string);
  const choose = (o: T) => {
    const next = group === 'topper' ? { ...config, topper: { ...config.topper, id: o.id } } : group === 'candles' ? { ...config, candles: { ...config.candles, id: o.id } } : { ...config, [group]: o.id };
    set(next, { group, optionId: o.id });
  };
  return (
    <div className="option-tiles" role="radiogroup" aria-label={group} style={{ ['--cols' as string]: columns }}>
      {items.filter((o) => o.status !== 'ARCHIVED').map((o) => {
        const state = optionState(config, group, o.id, ctx);
        const active = value === o.id;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={active} disabled={state.disabled && !active} className={`option-tile ${active ? 'is-active' : ''} ${state.disabled ? 'is-disabled' : ''}`} onClick={() => choose(o)} title={state.reason ?? undefined}>
            {render?.(o)}
            <span className="option-name">{o.name}</span>
            <span className="option-meta">{state.disabled ? state.reason : meta ? meta(o) : rupee(o.price)}</span>
            {active && <motion.span layoutId={`tile-${group}`} className="option-ring" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
          </button>
        );
      })}
    </div>
  );
}

export function ColorSwatches({ config, ctx, set }: { config: CakeConfiguration; ctx: CakeContext; set: SetFn }) {
  return (
    <div className="swatches" role="radiogroup" aria-label="Frosting colour">
      {options('color').map((c) => {
        const state = optionState(config, 'color', c.id, ctx);
        const active = config.color === c.id;
        return (
          <button key={c.id} type="button" role="radio" aria-checked={active} aria-label={`${c.name}${c.price ? `, plus ₹${c.price}` : ''}`} disabled={state.disabled} className={`swatch ${active ? 'is-active' : ''}`} onClick={() => set({ ...config, color: c.id }, { group: 'color', optionId: c.id })}>
            <span style={{ background: `linear-gradient(135deg, ${c.hex} 55%, ${c.shade})` }} />
            <em>{c.name}</em>
          </button>
        );
      })}
    </div>
  );
}

export function ToppingsPicker({ config, ctx, set }: { config: CakeConfiguration; ctx: CakeContext; set: SetFn }) {
  const qty = (id: string) => config.toppings.find((t) => t.id === id)?.qty ?? 0;
  const change = (id: string, q: number) => {
    const max = find('toppings', id)?.maxQuantity ?? 1;
    const n = Math.max(0, Math.min(max, q));
    const toppings = n === 0 ? config.toppings.filter((t) => t.id !== id) : config.toppings.some((t) => t.id === id) ? config.toppings.map((t) => (t.id === id ? { ...t, qty: n } : t)) : [...config.toppings, { id, qty: n }];
    set({ ...config, toppings }, { group: 'toppings', optionId: id });
  };
  return (
    <div className="option-tiles topping-tiles" style={{ ['--cols' as string]: 3 }}>
      {options('toppings').map((t) => {
        const q = qty(t.id);
        const state = q ? { disabled: false, reason: null } : optionState(config, 'toppings', t.id, ctx);
        return (
          <div key={t.id} className={`option-tile topping-tile ${q ? 'is-active' : ''} ${state.disabled ? 'is-disabled' : ''}`}>
            <span className="topping-dot" style={{ background: t.color }} aria-hidden="true" />
            <span className="option-name">{t.name}</span>
            <span className="option-meta">{state.disabled ? state.reason : `₹${t.perUnit} a portion${t.allergens?.includes('nuts') ? ' · nuts' : ''}`}</span>
            <div className="stepper" aria-label={`${t.name} portions`}>
              <button type="button" onClick={() => change(t.id, q - 1)} disabled={q === 0} aria-label={`Fewer ${t.name}`}><Minus size={13} /></button>
              <output aria-live="polite">{q}</output>
              <button type="button" onClick={() => change(t.id, q + 1)} disabled={state.disabled || q >= t.maxQuantity} aria-label={`More ${t.name}`}><Plus size={13} /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DecorationsPicker({ config, ctx, set }: { config: CakeConfiguration; ctx: CakeContext; set: SetFn }) {
  return (
    <div className="option-tiles" style={{ ['--cols' as string]: 3 }}>
      {options('decorations').map((d) => {
        const on = config.decorations.includes(d.id);
        const state = on ? { disabled: false, reason: null } : optionState(config, 'decorations', d.id, ctx);
        return (
          <button key={d.id} type="button" role="checkbox" aria-checked={on} disabled={state.disabled} className={`option-tile ${on ? 'is-active' : ''} ${state.disabled ? 'is-disabled' : ''}`}
            onClick={() => set({ ...config, decorations: on ? config.decorations.filter((x) => x !== d.id) : [...config.decorations, d.id] }, { group: 'decorations', optionId: d.id })}>
            <span className="option-name">{d.name}</span>
            <span className="option-meta">{state.disabled ? state.reason : rupee(d.price)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function MessageEditor({ config, set, onFocus }: { config: CakeConfiguration; set: SetFn; onFocus: () => void }) {
  const m = config.message;
  const fit = messageFit(config);
  const upd = (patch: Partial<CakeConfiguration['message']>, key: string) => set({ ...config, message: { ...m, ...patch } }, { group: 'message', coalesce: `message-${key}` });
  const warn = fit.overLength ? `Your message is too long for ${/^8/.test(sizeOf(config).name) ? 'an' : 'a'} ${sizeOf(config).name} cake. Try shortening it to ${fit.maxChars} characters.`
    : fit.overLines ? `${/^8/.test(sizeOf(config).name) ? 'An' : 'A'} ${sizeOf(config).name} cake fits ${fit.maxLines} line${fit.maxLines === 1 ? '' : 's'}.`
      : fit.overflow ? `It runs past the printable edge. Try a smaller size or about ${fit.fitChars} characters.` : null;
  return (
    <div className="message-editor" onFocus={onFocus}>
      <label className="field-label" htmlFor="cake-message">Message on the cake</label>
      <textarea id="cake-message" rows={2} value={m.text} maxLength={80} placeholder="Happy Birthday Aanya" onChange={(e) => upd({ text: e.target.value }, 'text')} aria-describedby="cake-message-help" />
      <div className="message-meta" id="cake-message-help">
        <span className={fit.overLength ? 'is-over' : ''}>{fit.chars}/{fit.maxChars} characters</span>
        <span>{fit.lines}/{fit.maxLines} line{fit.maxLines === 1 ? '' : 's'} · Enter for a new line</span>
      </div>
      {warn && <p className="studio-warning" role="status">{warn}</p>}
      <div className="field-label">Lettering</div>
      <div className="font-chips" role="radiogroup" aria-label="Lettering style">
        {messageFonts().map((f) => <button key={f.id} type="button" role="radio" aria-checked={m.font === f.id} className={m.font === f.id ? 'is-active' : ''} style={{ fontFamily: f.family }} onClick={() => upd({ font: f.id }, 'font')}>{f.name}<small>{f.note}</small></button>)}
      </div>
      <div className="field-label">Colour</div>
      <div className="ink-dots" role="radiogroup" aria-label="Lettering colour">
        {messageColorOptions().map((c) => <button key={c.id} type="button" role="radio" aria-checked={m.color === c.hex} aria-label={c.name} className={m.color === c.hex ? 'is-active' : ''} style={{ background: c.hex }} onClick={() => upd({ color: c.hex }, 'color')} />)}
      </div>
      <div className="editor-row">
        <label className="slider"><span>Size</span><input type="range" min={0.06} max={0.16} step={0.005} value={m.size} onChange={(e) => upd({ size: Number(e.target.value) }, 'size')} /></label>
        <label className="slider"><span>Position</span><input type="range" min={0.15} max={0.85} step={0.01} value={m.y} onChange={(e) => upd({ y: Number(e.target.value) }, 'y')} aria-label="Vertical position" /></label>
        <label className="slider"><span>Tilt</span><input type="range" min={-15} max={15} step={1} value={m.rotation} onChange={(e) => upd({ rotation: Number(e.target.value) }, 'rotation')} /></label>
      </div>
      <div className="align-buttons" role="radiogroup" aria-label="Alignment">
        {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([a, I]) => <button key={a} type="button" role="radio" aria-checked={m.align === a} aria-label={`Align ${a}`} className={m.align === a ? 'is-active' : ''} onClick={() => upd({ align: a }, 'align')}><I size={15} /></button>)}
      </div>
    </div>
  );
}

export function PrintEditor({ config, set, onFocus, printUrl, setPrintUrl }: { config: CakeConfiguration; set: SetFn; onFocus: () => void; printUrl: string | null; setPrintUrl: (u: string | null) => void }) {
  const p = config.print;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const block = optionState({ ...config, print: { ...p, enabled: false } }, 'print', 'print');
  const upd = (patch: Partial<CakeConfiguration['print']>, key: string) => set({ ...config, print: { ...p, ...patch } }, { group: 'print', coalesce: `print-${key}` });
  const area = printableArea(config);
  const check = p.enabled && p.assetId ? printCheck(config) : null;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError(null); onFocus();
    const r = await processUpload(file);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setPrintUrl(r.url);
    set({ ...config, print: { enabled: true, assetId: r.assetId, sourceWidth: r.width, sourceHeight: r.height, ...fitPlacement(config, r.width, r.height), rotation: 0 } }, { group: 'print', optionId: 'upload' });
    track('image_uploaded', { width: r.width, height: r.height, type: file.type, kb: Math.round(file.size / 1024) });
  };
  const fit = () => upd({ ...fitPlacement(config), rotation: 0 }, 'fit');
  const fill = () => upd({ scale: Math.max(1, (p.sourceWidth / p.sourceHeight) * (area.heightCm / area.widthCm)), x: 0.5, y: 0.5 }, 'fill');
  const nudge = (dx: number, dy: number) => upd({ x: Math.min(1, Math.max(0, p.x + dx)), y: Math.min(1, Math.max(0, p.y + dy)) }, 'nudge');

  if (block.disabled) return <p className="studio-note">{block.reason}</p>;

  return (
    <div className="print-editor" onFocus={onFocus}>
      <p className="studio-note">Printable area: {area.widthCm} × {area.heightCm} cm. The dashed line on the preview is exactly what prints.</p>
      {!p.assetId || !printUrl ? (
        <button type="button" className="dropzone" onClick={() => input.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }} disabled={busy}>
          <ImagePlus size={22} />
          <strong>{busy ? 'Preparing your photo…' : 'Add a photo'}</strong>
          <span>JPG, PNG or WebP, up to {C.printRules.maxUploadBytes / 1024 / 1024} MB. Your photo stays on this device and is only used to make your cake.</span>
        </button>
      ) : (
        <>
          <div className="editor-row">
            <label className="slider"><span>Zoom</span><input type="range" min={0.2} max={1.6} step={0.01} value={p.scale} onChange={(e) => upd({ scale: Number(e.target.value) }, 'scale')} /></label>
            <label className="slider"><span>Rotate</span><input type="range" min={-180} max={180} step={1} value={p.rotation} onChange={(e) => upd({ rotation: Number(e.target.value) }, 'rotation')} /></label>
          </div>
          <div className="print-tools">
            <button type="button" onClick={() => upd({ rotation: ((p.rotation - 90 + 540) % 360) - 180 }, 'rot')} aria-label="Rotate left"><RotateCcw size={15} /></button>
            <button type="button" onClick={() => upd({ rotation: ((p.rotation + 90 + 540) % 360) - 180 }, 'rot')} aria-label="Rotate right"><RotateCw size={15} /></button>
            <button type="button" onClick={fit} aria-label="Fit inside the area"><Minimize2 size={15} /> Fit</button>
            <button type="button" onClick={fill} aria-label="Fill the area"><Maximize2 size={15} /> Fill</button>
            <button type="button" onClick={() => upd({ x: 0.5, y: 0.5 }, 'center')} aria-label="Centre"><Crosshair size={15} /></button>
            <span className="print-nudge" aria-label="Move photo">
              <button type="button" onClick={() => nudge(0, -0.03)} aria-label="Move up"><ArrowUp size={14} /></button>
              <button type="button" onClick={() => nudge(-0.03, 0)} aria-label="Move left"><ArrowLeft size={14} /></button>
              <button type="button" onClick={() => nudge(0.03, 0)} aria-label="Move right"><ArrowRight size={14} /></button>
              <button type="button" onClick={() => nudge(0, 0.03)} aria-label="Move down"><ArrowDown size={14} /></button>
            </span>
            <button type="button" onClick={() => input.current?.click()}>Replace</button>
            <button type="button" className="danger" onClick={() => { setPrintUrl(null); set({ ...config, print: { ...p, enabled: false, assetId: null } }, { group: 'print', optionId: 'remove' }); }} aria-label="Remove photo"><Trash2 size={15} /></button>
          </div>
          <p className="studio-note">Drag the photo on the top view to place it.</p>
          {check && !check.inside && <p className="studio-warning" role="status">Part of your photo falls outside the printable area and won’t print. Try zooming out or moving it in.</p>}
          {check?.dotsPerCm !== null && check && check.dotsPerCm! < C.printRules.minDotsPerCm && <p className="studio-warning" role="status">Your photo may print soft at this size. Try a smaller placement or a sharper photo.</p>}
        </>
      )}
      {error && <p className="studio-warning" role="alert">{error}</p>}
      <input ref={input} type="file" accept={C.printRules.acceptedTypes.join(',')} hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}

export function TextField({ label, value, onChange, max, placeholder, inputMode }: { label: string; value: string; onChange: (v: string) => void; max: number; placeholder?: string; inputMode?: 'numeric' | 'text' }) {
  return (
    <label className="text-field"><span className="field-label">{label}</span><input value={value} maxLength={max} placeholder={placeholder} inputMode={inputMode} onChange={(e) => onChange(inputMode === 'numeric' ? e.target.value.replace(/\D/g, '') : e.target.value)} /></label>
  );
}
