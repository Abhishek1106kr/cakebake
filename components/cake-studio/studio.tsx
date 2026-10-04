'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronUp, Link2, Redo2, RotateCcw, Save, Shuffle, Sparkles, Undo2, X } from 'lucide-react';
import * as C from '@/lib/cake/config';
import { decodeDesign, designIdFor, encodeDesign, find, hasErrors, price, productionHours, sanitize, sizeOf, slotsAfter, summary, validate, type CakeContext } from '@/lib/cake/engine';
import { assetUrl, renderArtwork } from '@/lib/cake/assets';
import type { CakeConfiguration, Issue } from '@/lib/cake/types';
import { applyPatches, applyStyle, STYLES, suggest, surprise, type StyleId } from '@/engine/intelligence/cake/designer';
import { useStore } from '@/components/store-provider';
import { AnimatedNumber } from '@/components/motion';
import { EASE } from '@/lib/motion';
import { CakePreview, InsidePreview, type PreviewView } from './preview';
import { ColorSwatches, DecorationsPicker, MessageEditor, OptionTiles, PrintEditor, Section, TextField, ToppingsPicker } from './controls';
import { useCakeDesign } from './use-cake-design';

const STEPS = [
  { id: 'build', label: 'Build', sections: ['size', 'shape', 'sponge', 'filling'] },
  { id: 'decorate', label: 'Decorate', sections: ['frosting', 'finish', 'color', 'toppings', 'decorations'] },
  { id: 'personalise', label: 'Personalise', sections: ['message', 'print', 'topper', 'candles'] },
  { id: 'review', label: 'Review', sections: ['packaging', 'notes', 'summary'] },
] as const;
type StepId = (typeof STEPS)[number]['id'];

const FIELD_STEP: Record<string, StepId> = { size: 'build', shape: 'build', sponge: 'build', filling: 'build', frosting: 'decorate', finish: 'decorate', color: 'decorate', toppings: 'decorate', decorations: 'decorate', message: 'personalise', print: 'personalise', topper: 'personalise', candles: 'personalise', packaging: 'review', notes: 'review' };

export function CakeStudio({ initialCode, editLineId }: { initialCode?: string | null; editLineId?: string | null }) {
  const { inventory, orders, cart, addCustomCake } = useStore();
  const editLine = editLineId ? cart.find((l) => l.lineId === editLineId && l.custom) : undefined;
  const initial = useMemo(() => (editLine?.custom ? sanitize(editLine.custom.config) : initialCode ? decodeDesign(initialCode) : null), []); // eslint-disable-line react-hooks/exhaustive-deps
  const d = useCakeDesign(initial);
  const { config, set } = d;
  const ctx: CakeContext = useMemo(() => ({ inventory, month: new Date().getMonth() + 1 }), [inventory]);

  const [step, setStep] = useState<StepId>('build');
  const [view, setView] = useState<PreviewView>('front');
  const [editing, setEditing] = useState<'message' | 'print' | null>(null);
  const [printUrl, setPrintUrl] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<{ title: string; total: number } | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [breakdown, setBreakdown] = useState(false);
  const [surpriseState, setSurpriseState] = useState<{ open: boolean; text: string; seed: number; note: string | null }>({ open: false, text: '', seed: 1, note: null });
  const stageRef = useRef<HTMLDivElement>(null);

  // Load the customer's photo for the preview from browser storage.
  useEffect(() => {
    let url: string | null = null;
    let live = true;
    if (config.print.enabled && config.print.assetId && !printUrl) assetUrl(config.print.assetId).then((u) => { if (live) { url = u; setPrintUrl(u); } });
    return () => { live = false; if (url && !printUrl) URL.revokeObjectURL(url); };
  }, [config.print.assetId, config.print.enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = price(config);
  const hours = productionHours(config);
  const firstSlot = useMemo(() => slotsAfter(new Date(), hours, 1)[0], [hours]);
  const live = useMemo(() => validate(config, ctx), [config, ctx]);
  const suggestions = useMemo(() => suggest(config, { ctx, orders, dismissed }).result, [config, ctx, orders, dismissed]);
  const s = summary(config);

  // Switch to the top view while placing words or a photo.
  const focusEditor = (which: 'message' | 'print') => { setEditing(which); setView('top'); };
  const goStep = (id: StepId) => { setStep(id); if (id !== 'personalise') { setEditing(null); } };

  const runSurprise = (seed: number) => {
    const r = surprise(config, { text: surpriseState.text, seed }, ctx);
    if (r.result) { set(r.result.config, { group: 'surprise', optionId: r.result.style }); setSurpriseState((x) => ({ ...x, seed, note: `${STYLES.find((st) => st.id === r.result!.style)?.name} · ₹${r.result!.total.toLocaleString('en-IN')}` })); }
    else setSurpriseState((x) => ({ ...x, note: r.warnings[0] ?? 'Nothing fits that yet.' }));
  };

  const addToBag = async () => {
    const found = validate(config, ctx);
    setIssues(found);
    if (hasErrors(found)) {
      const first = found.find((i) => i.level === 'error')!;
      setStep(FIELD_STEP[first.field] ?? 'review');
      setTimeout(() => document.getElementById(`opt-${first.field}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
      return;
    }
    setBusy(true);
    const artworkAssetId = config.print.enabled ? await renderArtwork(config, designIdFor(config)) : null;
    const r = addCustomCake(config, { artworkAssetId, replaceLineId: editLine?.lineId });
    setBusy(false);
    if (!r.ok) { setIssues(r.errors.map((message) => ({ field: 'notes', level: 'error', message }))); return; }
    d.markAdded();
    setAdded({ title: r.line.custom!.title, total: r.line.unitPrice });
  };

  const share = async () => {
    const url = d.shareUrl();
    setShareLink(url);
    try { await navigator.clipboard.writeText(url); } catch { /* the link is shown to copy by hand */ }
  };

  const save = () => { d.saveDesign(); setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1600); };

  const renderSection = (id: string) => {
    switch (id) {
      case 'size': return <Section key={id} id="size" title="Size" hint={`Serves ${sizeOf(config)?.servings}`}><OptionTiles group="size" items={C.sizes} config={config} ctx={ctx} set={set} columns={5} meta={(o) => `₹${o.price.toLocaleString('en-IN')} · ${o.servings}`} /></Section>;
      case 'shape': return <Section key={id} id="shape" title="Shape"><OptionTiles group="shape" items={C.shapes} config={config} ctx={ctx} set={set} columns={4} render={(o) => <span className={`shape-glyph shape-${o.kind}`} aria-hidden="true" />} /></Section>;
      case 'sponge': return <Section key={id} id="sponge" title="Sponge" hint={find('sponge', config.sponge)?.crumb}><OptionTiles group="sponge" items={C.sponges} config={config} ctx={ctx} set={set} render={(o) => <span className="crumb-dot" style={{ background: o.color }} aria-hidden="true" />} /></Section>;
      case 'filling': return <Section key={id} id="filling" title="Filling"><OptionTiles group="filling" items={C.fillings} config={config} ctx={ctx} set={set} render={(o) => <span className="crumb-dot" style={{ background: o.color }} aria-hidden="true" />} /></Section>;
      case 'frosting': return <Section key={id} id="frosting" title="Frosting"><OptionTiles group="frosting" items={C.frostings} config={config} ctx={ctx} set={set} columns={2} /></Section>;
      case 'finish': return <Section key={id} id="finish" title="Finish"><OptionTiles group="finish" items={C.finishes} config={config} ctx={ctx} set={set} columns={4} render={(o) => <span className={`finish-glyph finish-${o.kind}`} aria-hidden="true" />} /></Section>;
      case 'color': return <Section key={id} id="color" title="Colour" hint="Natural colourings only"><ColorSwatches config={config} ctx={ctx} set={set} /></Section>;
      case 'toppings': return <Section key={id} id="toppings" title="Toppings" hint="Tap + to add portions"><ToppingsPicker config={config} ctx={ctx} set={set} /></Section>;
      case 'decorations': return <Section key={id} id="decorations" title="Decorations"><DecorationsPicker config={config} ctx={ctx} set={set} /></Section>;
      case 'message': return <Section key={id} id="message" title="Message"><MessageEditor config={config} set={set} onFocus={() => focusEditor('message')} /></Section>;
      case 'print': return (
        <Section key={id} id="print" title="Edible photo print" hint={`₹${C.printRules.price} · adds ${C.printRules.productionHours} h`}>
          <PrintEditor config={config} set={set} onFocus={() => focusEditor('print')} printUrl={printUrl} setPrintUrl={setPrintUrl} />
        </Section>
      );
      case 'topper': return (
        <Section key={id} id="topper" title="Topper">
          <OptionTiles group="topper" items={C.toppers} config={config} ctx={ctx} set={set} columns={2} />
          {find('topper', config.topper.id) && (C.toppers.find((t) => t.id === config.topper.id)?.needsText) && <TextField label={config.topper.id === 'number' ? 'Number' : 'Name'} value={config.topper.text} max={C.toppers.find((t) => t.id === config.topper.id)?.maxChars ?? 10} inputMode={config.topper.id === 'number' ? 'numeric' : 'text'} onChange={(v) => set({ ...config, topper: { ...config.topper, text: v } }, { group: 'topper', coalesce: 'topper-text' })} />}
        </Section>
      );
      case 'candles': return (
        <Section key={id} id="candles" title="Candles">
          <OptionTiles group="candles" items={C.candles} config={config} ctx={ctx} set={set} columns={2} />
          {config.candles.id === 'number' && <TextField label="Number" value={config.candles.text} max={3} inputMode="numeric" placeholder="30" onChange={(v) => set({ ...config, candles: { ...config.candles, text: v } }, { group: 'candles', coalesce: 'candles-text' })} />}
        </Section>
      );
      case 'packaging': return <Section key={id} id="packaging" title="Packaging"><OptionTiles group="packaging" items={C.packaging} config={config} ctx={ctx} set={set} /></Section>;
      case 'notes': return (
        <Section key={id} id="notes" title="Notes for the baker" hint={`${config.notes.length}/300`}>
          <textarea className="notes-field" rows={3} maxLength={300} value={config.notes} placeholder="Allergies, colours to match, anything we should know." onChange={(e) => set({ ...config, notes: e.target.value }, { group: 'notes', coalesce: 'notes' })} aria-label="Notes for the baker" />
        </Section>
      );
      case 'summary': return (
        <Section key={id} id="summary" title="Your cake">
          <ul className="spec-list">{s.lines.map((l) => <li key={l}>{l}</li>)}</ul>
          <p className="studio-note">Made to order: ready from {firstSlot?.label ?? 'the next available slot'} ({hours} h to bake and finish).</p>
          {live.length > 0 && <ul className="issue-list">{live.map((i) => <li key={i.message} className={`is-${i.level}`}>{i.message}</li>)}</ul>}
        </Section>
      );
      default: return null;
    }
  };

  const current = STEPS.find((x) => x.id === step)!;

  return (
    <div className="studio">
      <header className="studio-top container">
        <div>
          <div className="eyebrow">Tresor</div>
          <h1 className="studio-title">Cake Playground</h1>
          <p className="studio-sub">Create something personal.</p>
        </div>
        <div className="studio-actions">
          <button type="button" className="icon-btn" onClick={d.undo} disabled={!d.canUndo} aria-label="Undo"><Undo2 size={16} /></button>
          <button type="button" className="icon-btn" onClick={d.redo} disabled={!d.canRedo} aria-label="Redo"><Redo2 size={16} /></button>
          <button type="button" className="icon-btn" onClick={() => { d.reset(); setPrintUrl(null); }} aria-label="Start again"><RotateCcw size={16} /></button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={save}>{savedFlash ? <><Check size={15} /> Saved</> : <><Save size={15} /> Save design</>}</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={share}><Link2 size={15} /> Share</button>
        </div>
      </header>

      <AnimatePresence>
        {d.draft && (
          <motion.div className="container studio-banner" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <span>Continue your cake? You were designing a {summary(d.draft).lines[0].split(' · ')[0].toLowerCase()} cake.</span>
            <div><button type="button" className="btn btn-brand btn-sm" onClick={d.continueDraft}>Continue</button><button type="button" className="btn btn-ghost btn-sm" onClick={d.discardDraft}>Start fresh</button></div>
          </motion.div>
        )}
        {shareLink && (
          <motion.div className="container studio-banner" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <span>Link copied. Anyone with it can see this cake and make it their own. Your photo is never included.</span>
            <div><input readOnly value={shareLink} onFocus={(e) => e.target.select()} aria-label="Share link" /><button type="button" className="icon-btn" onClick={() => setShareLink(null)} aria-label="Close"><X size={15} /></button></div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="studio-body container">
        <div className="studio-stage" ref={stageRef}>
          <div className="stage-view" role="radiogroup" aria-label="Preview angle">
            {(['front', 'top'] as const).map((v) => <button key={v} type="button" role="radio" aria-checked={view === v} className={view === v ? 'is-active' : ''} onClick={() => setView(v)}>{v === 'front' ? 'Side view' : 'Top view'}</button>)}
          </div>
          <motion.div className="stage-cake" animate={added ? { scale: 0.86, y: 20, opacity: 0.6 } : { scale: 1, y: 0, opacity: 1 }} transition={{ duration: 0.6, ease: EASE }}>
            <CakePreview config={config} view={view} editing={step === 'personalise' ? editing : null} printUrl={printUrl} onPrintMove={(x, y) => set({ ...config, print: { ...config.print, x, y } }, { group: 'print', coalesce: 'print-drag' })} />
          </motion.div>
          <div className="stage-inside"><InsidePreview config={config} /><span>Inside</span></div>
          <div className="stage-facts"><span>Serves {sizeOf(config)?.servings}</span><span>Ready from {firstSlot?.label.split(' · ')[0] ?? '—'}</span></div>
          <AnimatePresence>
            {suggestions.length > 0 && (
              <motion.div className="designer-notes" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {suggestions.map((sg) => (
                  <motion.div key={sg.id} layout className="designer-note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <Sparkles size={14} aria-hidden="true" />
                    <p>{sg.line}</p>
                    <button type="button" onClick={() => set(applyPatches(config, sg.patches), { group: 'suggestion', optionId: sg.id })}>{sg.action}</button>
                    <button type="button" className="note-x" onClick={() => setDismissed((x) => [...x, sg.id])} aria-label="Dismiss suggestion"><X size={13} /></button>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <aside className="studio-panel" aria-label="Design your cake">
          <div className="style-row">
            <span className="field-label">Start from a style</span>
            <div className="style-chips">
              {STYLES.map((st) => <button key={st.id} type="button" title={st.line} onClick={() => set(applyStyle(config, st.id as StyleId, ctx).config, { group: 'style', optionId: st.id })}>{st.name}</button>)}
              <button type="button" className="surprise-btn" onClick={() => setSurpriseState((x) => ({ ...x, open: !x.open }))}><Shuffle size={14} /> Surprise me</button>
            </div>
            <AnimatePresence>
              {surpriseState.open && (
                <motion.div className="surprise-panel" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <input value={surpriseState.text} onChange={(e) => setSurpriseState((x) => ({ ...x, text: e.target.value }))} placeholder="something elegant under ₹3000, no nuts" aria-label="Describe the cake you’d like" />
                  <div className="surprise-actions">
                    <button type="button" className="btn btn-brand btn-sm" onClick={() => runSurprise(surpriseState.seed + 1)}>{surpriseState.note ? 'Another one' : 'Surprise me'}</button>
                    {surpriseState.note && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSurpriseState((x) => ({ ...x, open: false, note: null }))}>Keep it</button>}
                    {surpriseState.note && <button type="button" className="btn btn-ghost btn-sm" onClick={d.undo}>Undo</button>}
                  </div>
                  {surpriseState.note && <p className="studio-note">{surpriseState.note}. Change anything you like.</p>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <nav className="step-tabs" aria-label="Steps">
            {STEPS.map((x, i) => (
              <button key={x.id} type="button" className={step === x.id ? 'is-active' : ''} aria-current={step === x.id ? 'step' : undefined} onClick={() => goStep(x.id)}>
                <span>{String(i + 1).padStart(2, '0')}</span>{x.label}
                {step === x.id && <motion.i layoutId="step-line" className="step-line" />}
              </button>
            ))}
          </nav>

          <AnimatePresence mode="wait">
            <motion.div key={step} className="step-body" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.3, ease: EASE }}>
              {current.sections.map((id) => renderSection(id))}
              {issues.filter((i) => FIELD_STEP[i.field] === step && i.level === 'error').length > 0 && (
                <ul className="issue-list">{issues.filter((i) => FIELD_STEP[i.field] === step).map((i) => <li key={i.message} className={`is-${i.level}`}>{i.message}</li>)}</ul>
              )}
              <div className="step-nav">
                {STEPS.findIndex((x) => x.id === step) > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => goStep(STEPS[STEPS.findIndex((x) => x.id === step) - 1].id)}>Back</button>}
                {step !== 'review' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => goStep(STEPS[STEPS.findIndex((x) => x.id === step) + 1].id)}>Next: {STEPS[STEPS.findIndex((x) => x.id === step) + 1].label}</button>}
              </div>
            </motion.div>
          </AnimatePresence>

          {d.saved.length > 0 && (
            <details className="saved-designs">
              <summary>Your saved designs ({d.saved.length})</summary>
              <ul>{d.saved.map((sv) => (
                <li key={sv.designId}>
                  <button type="button" onClick={() => d.openDesign(sv)}><CakePreview config={sv.config} className="saved-thumb" /><span>{summary(sv.config).title}<small>₹{sv.total.toLocaleString('en-IN')} · {new Date(sv.savedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</small></span></button>
                  <button type="button" className="note-x" onClick={() => d.removeDesign(sv.designId)} aria-label="Delete saved design"><X size={13} /></button>
                </li>
              ))}</ul>
            </details>
          )}
        </aside>
      </div>

      <div className="studio-bar">
        <div className="container studio-bar-inner">
          <button type="button" className="price-toggle" onClick={() => setBreakdown((b) => !b)} aria-expanded={breakdown}>
            <span className="price-label">Your cake</span>
            <strong><AnimatedNumber value={total.total} /></strong>
            <ChevronUp size={15} style={{ transform: breakdown ? 'none' : 'rotate(180deg)', transition: 'transform .2s' }} />
          </button>
          <span className="bar-ready">Ready from {firstSlot?.label ?? '—'}</span>
          <button type="button" className="btn btn-brand" onClick={addToBag} disabled={busy}>{busy ? 'Preparing…' : editLine ? 'Update cake in bag' : 'Add custom cake'}</button>
        </div>
        <AnimatePresence>
          {breakdown && (
            <motion.div className="container price-breakdown" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <ul>{total.lines.map((l) => <li key={l.label}><span>{l.label}</span><span>₹{l.amount.toLocaleString('en-IN')}</span></li>)}</ul>
              <p className="studio-note">Sample prices for the prototype. Delivery is added at checkout.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {added && (
          <motion.div className="added-sheet" role="dialog" aria-modal="true" aria-label="Added to your bag" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="added-card" initial={{ y: 40, scale: 0.96 }} animate={{ y: 0, scale: 1 }} transition={{ duration: 0.45, ease: EASE }}>
              <CakePreview config={config} className="added-thumb" />
              <div className="eyebrow">In your bag</div>
              <h2>{added.title}</h2>
              <p className="muted">₹{added.total.toLocaleString('en-IN')} · ready from {firstSlot?.label}</p>
              <div className="added-actions">
                <Link className="btn btn-brand" href="/cart">View bag</Link>
                <button type="button" className="btn btn-ghost" onClick={() => setAdded(null)}>Keep designing</button>
              </div>
              <p className="studio-note">Design {designIdFor(config)} · share it any time: /customize/share/{encodeDesign(config).slice(0, 10)}…</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
