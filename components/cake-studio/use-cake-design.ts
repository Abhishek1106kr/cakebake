'use client';

// Studio state: the configuration with undo / redo / reset, local autosave, saved
// designs, and playground analytics. Only configuration lives here; the preview
// and pricing derive from it.

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { defaultConfig, designIdFor, encodeDesign, price, sanitize } from '@/lib/cake/engine';
import type { CakeConfiguration } from '@/lib/cake/types';
import { track } from '@/engine/intelligence/events/track';

type History = { past: CakeConfiguration[]; present: CakeConfiguration; future: CakeConfiguration[] };
type Action =
  | { type: 'set'; config: CakeConfiguration; coalesce?: string }
  | { type: 'undo' } | { type: 'redo' } | { type: 'reset' } | { type: 'load'; config: CakeConfiguration };

const LIMIT = 60;
let lastCoalesce: { key: string; at: number } | null = null;

function reducer(h: History, a: Action): History {
  switch (a.type) {
    case 'set': {
      if (JSON.stringify(a.config) === JSON.stringify(h.present)) return h;
      // Rapid edits to the same control (typing, sliders) collapse into one undo step.
      const now = Date.now();
      if (a.coalesce && lastCoalesce?.key === a.coalesce && now - lastCoalesce.at < 800 && h.past.length) {
        lastCoalesce = { key: a.coalesce, at: now };
        return { ...h, present: a.config, future: [] };
      }
      lastCoalesce = a.coalesce ? { key: a.coalesce, at: now } : null;
      return { past: [...h.past, h.present].slice(-LIMIT), present: a.config, future: [] };
    }
    case 'undo': return h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h;
    case 'redo': return h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h;
    case 'reset': return { past: [...h.past, h.present].slice(-LIMIT), present: defaultConfig(), future: [] };
    case 'load': return { past: [], present: a.config, future: [] };
  }
}

const DRAFT_KEY = 'tresor-cake-draft';
const DESIGNS_KEY = 'tresor-cake-designs';

export type SavedDesign = { designId: string; config: CakeConfiguration; total: number; savedAt: string };

const read = <T,>(key: string): T | null => { try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : null; } catch { return null; } };
const write = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage full or blocked */ } };

export function useCakeDesign(initial?: CakeConfiguration | null) {
  const [h, dispatch] = useReducer(reducer, { past: [], present: initial ?? defaultConfig(), future: [] });
  const [draft, setDraft] = useState<CakeConfiguration | null>(null);
  const [saved, setSaved] = useState<SavedDesign[]>([]);
  const started = useRef(false);
  const messageTracked = useRef(false);
  const added = useRef(false);
  const lastGroup = useRef<string>('size');
  const ready = useRef(false);

  // Restore: an explicit design (share link, edit from bag) wins; otherwise offer the draft.
  useEffect(() => {
    setSaved(read<SavedDesign[]>(DESIGNS_KEY) ?? []);
    const d = read<{ config: unknown }>(DRAFT_KEY);
    if (!initial && d?.config) {
      const restored = sanitize(d.config);
      if (JSON.stringify(restored) !== JSON.stringify(defaultConfig())) setDraft(restored);
    }
    track('customizer_opened', { source: initial ? 'link' : d ? 'draft-available' : 'fresh' });
    ready.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave (debounced) once the customer has started.
  useEffect(() => {
    if (!ready.current || draft) return;
    const t = setTimeout(() => write(DRAFT_KEY, { config: h.present, savedAt: new Date().toISOString() }), 400);
    return () => clearTimeout(t);
  }, [h.present, draft]);

  // Abandonment: left with a started cake that never reached the bag.
  useEffect(() => {
    const onLeave = () => {
      if (started.current && !added.current) track('custom_cake_abandoned', { lastGroup: lastGroup.current, total: price(h.present).total });
    };
    window.addEventListener('pagehide', onLeave);
    return () => { window.removeEventListener('pagehide', onLeave); onLeave(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = useCallback((config: CakeConfiguration, meta?: { group?: string; optionId?: string; coalesce?: string }) => {
    if (!started.current) { started.current = true; track('cake_started', { group: meta?.group ?? 'unknown' }); }
    if (meta?.group === 'message' && config.message.text.trim() && !messageTracked.current) {
      messageTracked.current = true;
      // Length only: the words may contain a name.
      track('message_added', { length: config.message.text.trim().length, font: config.message.font });
    }
    if (meta?.group) {
      lastGroup.current = meta.group;
      if (meta.optionId) track('option_selected', { group: meta.group, optionId: meta.optionId });
    }
    dispatch({ type: 'set', config, coalesce: meta?.coalesce });
  }, []);

  const continueDraft = () => { if (draft) { dispatch({ type: 'load', config: draft }); track('design_reopened', { designId: designIdFor(draft), from: 'draft' }); } setDraft(null); };
  const discardDraft = () => { setDraft(null); write(DRAFT_KEY, { config: defaultConfig(), savedAt: new Date().toISOString() }); };

  const saveDesign = (): SavedDesign => {
    const entry: SavedDesign = { designId: designIdFor(h.present), config: h.present, total: price(h.present).total, savedAt: new Date().toISOString() };
    const next = [entry, ...saved.filter((s) => s.designId !== entry.designId)].slice(0, 12);
    setSaved(next);
    write(DESIGNS_KEY, next);
    track('design_saved', { designId: entry.designId, total: entry.total });
    return entry;
  };
  const removeDesign = (id: string) => { const next = saved.filter((s) => s.designId !== id); setSaved(next); write(DESIGNS_KEY, next); };
  const openDesign = (s: SavedDesign) => { dispatch({ type: 'load', config: sanitize(s.config) }); track('design_reopened', { designId: s.designId, from: 'saved' }); };

  const shareUrl = () => {
    const code = encodeDesign(h.present);
    track('design_shared', { designId: designIdFor(h.present) });
    return `${window.location.origin}/customize/share/${code}`;
  };

  const markAdded = () => { added.current = true; track('cake_completed', { designId: designIdFor(h.present) }); };

  return {
    config: h.present, set,
    undo: () => dispatch({ type: 'undo' }), redo: () => dispatch({ type: 'redo' }), reset: () => dispatch({ type: 'reset' }),
    canUndo: h.past.length > 0, canRedo: h.future.length > 0,
    draft, continueDraft, discardDraft,
    saved, saveDesign, removeDesign, openDesign, shareUrl, markAdded,
  };
}
