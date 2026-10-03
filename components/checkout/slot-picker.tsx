'use client';

import type { Slot } from '@/lib/delivery/slots';

type SlotPickerProps = { slots: Slot[]; value: string; onChange: (id: string) => void; error?: string };

export function SlotPicker({ slots, value, onChange, error }: SlotPickerProps) {
  const groups = [
    { title: 'Now', items: slots.filter((s) => s.kind === 'asap') },
    { title: 'Today', items: slots.filter((s) => s.kind === 'window' && s.dayLabel === 'Today') },
    { title: 'Tomorrow', items: slots.filter((s) => s.kind === 'window' && s.dayLabel === 'Tomorrow') },
  ].filter((group) => group.items.length > 0);

  return (
    <fieldset className="slot-picker" aria-describedby={error ? 'slot-error' : undefined}>
      <legend className="sr-only">Choose a time</legend>
      {groups.map((group) => (
        <div key={group.title} className="slot-group">
          <div className="slot-group-title">{group.title}</div>
          <div className="slot-options">
            {group.items.map((slot) => (
              <label key={slot.id} className={`slot ${value === slot.id ? 'is-selected' : ''} ${slot.available ? '' : 'is-disabled'}`}>
                <input type="radio" name="slot" value={slot.id} checked={value === slot.id} disabled={!slot.available} onChange={() => onChange(slot.id)} />
                <span className="slot-label">{slot.kind === 'asap' ? slot.label : slot.label.split(' · ')[1]}</span>
                {slot.reason && <span className="slot-reason">{slot.reason}</span>}
              </label>
            ))}
          </div>
        </div>
      ))}
      {error && <p id="slot-error" className="field-error">{error}</p>}
    </fieldset>
  );
}
