// Delivery and pickup slots, computed in the browser from the current time in
// Bengaluru. A slot closes when there is no longer time to prepare (and, for
// delivery, ride) the order before the window starts.

import type { Fulfilment } from '@/lib/cart/pricing';
import { pad2 } from '@/lib/format';

export const OPEN_HOUR = 8;
export const CLOSE_HOUR = 23;
export const KITCHEN_BUFFER_MIN = 15;
export const RIDE_MIN = 30;
const WINDOW_STARTS = [9, 11, 13, 15, 17, 19, 21]; // two-hour windows
const IST_OFFSET_MIN = 330;

export type Slot = {
  id: string; // "asap" or "YYYY-MM-DD|HH"
  kind: 'asap' | 'window';
  label: string; // "Today · 18:00–20:00"
  dayLabel: 'Today' | 'Tomorrow';
  available: boolean;
  reason?: string; // why it is unavailable, or when to order by
  startsAt: number; // epoch ms
};

type ISTParts = { dateKey: string; minutes: number };

function istParts(epochMs: number): ISTParts {
  const shifted = new Date(epochMs + IST_OFFSET_MIN * 60_000);
  const dateKey = `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
  return { dateKey, minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes() };
}

/** Epoch ms for HH:00 IST on the IST date `dayOffset` days from `now`. */
function istEpoch(now: number, dayOffset: number, hour: number): number {
  const shifted = new Date(now + IST_OFFSET_MIN * 60_000);
  const utcMidnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + dayOffset);
  return utcMidnight + hour * 3_600_000 - IST_OFFSET_MIN * 60_000;
}

export function leadMinutes(prepMinutes: number, fulfilment: Fulfilment): number {
  return prepMinutes + KITCHEN_BUFFER_MIN + (fulfilment === 'delivery' ? RIDE_MIN : 0);
}

function clock(minutesOfDay: number): string {
  const m = ((minutesOfDay % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

export function getSlots(now: number, prepMinutes: number, fulfilment: Fulfilment): Slot[] {
  const lead = leadMinutes(prepMinutes, fulfilment);
  const { minutes } = istParts(now);
  const open = minutes >= OPEN_HOUR * 60 && minutes + lead <= CLOSE_HOUR * 60;

  const slots: Slot[] = [{
    id: 'asap',
    kind: 'asap',
    label: fulfilment === 'delivery' ? `As soon as possible · about ${lead} min` : `Ready in about ${lead} min`,
    dayLabel: 'Today',
    available: open,
    reason: open ? undefined : `We open at ${pad2(OPEN_HOUR)}:00. Choose a time below.`,
    startsAt: now + lead * 60_000,
  }];

  for (const dayOffset of [0, 1]) {
    for (const hour of WINDOW_STARTS) {
      const startsAt = istEpoch(now, dayOffset, hour);
      const orderBy = startsAt - lead * 60_000;
      const available = orderBy > now;
      const dayLabel = dayOffset === 0 ? 'Today' : 'Tomorrow';
      if (dayOffset === 0 && !available && startsAt + 2 * 3_600_000 < now) continue; // window fully over
      const orderByMin = Math.floor((hour * 60 - lead));
      slots.push({
        id: `${istParts(startsAt).dateKey}|${pad2(hour)}`,
        kind: 'window',
        label: `${dayLabel} · ${pad2(hour)}:00–${pad2(hour + 2)}:00`,
        dayLabel,
        available,
        reason: available ? (dayOffset === 0 ? `Order by ${clock(orderByMin)}` : undefined) : 'Too soon to prepare',
        startsAt,
      });
    }
  }
  return slots;
}

/** Re-checks a chosen slot at submit time (the clock may have moved on). */
export function isSlotStillAvailable(slotId: string, now: number, prepMinutes: number, fulfilment: Fulfilment): boolean {
  return getSlots(now, prepMinutes, fulfilment).some((slot) => slot.id === slotId && slot.available);
}

export function findSlot(slotId: string, now: number, prepMinutes: number, fulfilment: Fulfilment): Slot | undefined {
  return getSlots(now, prepMinutes, fulfilment).find((slot) => slot.id === slotId);
}
