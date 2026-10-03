import { serviceablePins } from '@/data/site';

export type PinCheck =
  | { status: 'invalid'; message: string }
  | { status: 'outside'; message: string }
  | { status: 'ok'; area: string; message: string };

export function checkPin(raw: string): PinCheck {
  const pin = raw.replace(/\s/g, '');
  if (!/^\d{6}$/.test(pin)) return { status: 'invalid', message: 'Enter a 6-digit PIN code.' };
  const area = serviceablePins[pin];
  if (!area) {
    return {
      status: 'outside',
      message: pin.startsWith('560')
        ? "We don't deliver there yet. Pickup from Whitefield is always open to you."
        : 'We only deliver around Whitefield, Bengaluru for now.',
    };
  }
  return { status: 'ok', area, message: `We deliver to ${area}.` };
}
