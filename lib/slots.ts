// Delivery slots in Bengaluru time (REFERENCES.md §6, from Amintiri: honest promises).
// A window closes when there's no longer time to bake, pack and ride before it starts.

const IST_MIN = 330;
const OPEN = 8;
const CLOSE = 23;
const LEAD_MIN = 45; // prep + packing + ride; confirm with the bakery
const WINDOWS = [9, 11, 13, 15, 17, 19, 21];
const pad = (n: number) => String(n).padStart(2, '0');

export type Slot = { id: string; label: string; day: 'Today' | 'Tomorrow' | 'Now'; available: boolean; reason?: string };

function istMinutes(now: number) {
  const d = new Date(now + IST_MIN * 60000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function getSlots(now: number): Slot[] {
  const minutes = istMinutes(now);
  const open = minutes >= OPEN * 60 && minutes + LEAD_MIN <= CLOSE * 60;
  const slots: Slot[] = [{ id: 'asap', label: `As soon as possible · about ${LEAD_MIN} min`, day: 'Now', available: open, reason: open ? undefined : `We open at ${pad(OPEN)}:00. Pick a time below.` }];
  for (const day of ['Today', 'Tomorrow'] as const) {
    for (const h of WINDOWS) {
      const orderBy = h * 60 - LEAD_MIN;
      const available = day === 'Tomorrow' || minutes < orderBy;
      if (day === 'Today' && minutes >= (h + 2) * 60) continue; // window already over
      slots.push({
        id: `${day}-${h}`,
        label: `${pad(h)}:00–${pad(h + 2)}:00`,
        day,
        available,
        reason: !available ? 'Too soon to bake' : day === 'Today' ? `Order by ${pad(Math.floor(orderBy / 60))}:${pad(orderBy % 60)}` : undefined,
      });
    }
  }
  return slots;
}

export function slotLabel(id: string, slots: Slot[]): string {
  const slot = slots.find((s) => s.id === id);
  return slot ? (slot.day === 'Now' ? slot.label : `${slot.day} · ${slot.label}`) : id;
}
