'use client';

import { useEffect, useState } from 'react';

/** Comma-separated list ↔ string[]; keeps what the person is typing until blur. */
export function ListInput({ value, onChange, placeholder, id }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; id?: string }) {
  const [text, setText] = useState(value.join(', '));
  useEffect(() => { setText(value.join(', ')); }, [value]);
  const commit = () => onChange(text.split(',').map((s) => s.trim()).filter(Boolean));
  return <input id={id} value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />;
}

/** Number field that allows an empty value while typing; reports null when empty. */
export function NumberInput({ value, onChange, step = 1, min, max, invalid, id }: { value: number | null; onChange: (v: number | null) => void; step?: number; min?: number; max?: number; invalid?: boolean; id?: string }) {
  const [text, setText] = useState(value === null || value === undefined ? '' : String(value));
  useEffect(() => { setText(value === null || value === undefined ? '' : String(value)); }, [value]);
  return (
    <input id={id} inputMode={step < 1 ? 'decimal' : 'numeric'} value={text} aria-invalid={invalid || undefined} min={min} max={max}
      onChange={(e) => { setText(e.target.value); const n = e.target.value.trim() === '' ? null : Number(e.target.value); onChange(n === null || Number.isFinite(n) ? n : null); }} />
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <label className="ad-toggle"><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /> {label}</label>;
}

/** Keeps a local draft of a record; reports whether it differs from the saved one. */
export function useDraft<T>(saved: T | null) {
  const [draft, setDraft] = useState<T | null>(saved);
  useEffect(() => { setDraft(saved); }, [saved]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const patch = (p: Partial<T>) => setDraft((d) => (d ? { ...d, ...p } : d));
  return { draft, setDraft, patch, dirty };
}
