import { BOX_NOTE_LIMIT, type Fulfilment } from '@/lib/cart/pricing';
import { checkPin } from '@/lib/delivery/serviceability';
import type { PaymentMethod } from '@/lib/orders/payment';

export type CheckoutForm = {
  fulfilment: Fulfilment;
  name: string;
  phone: string;
  email: string;
  address: string;
  pin: string;
  instructions: string;
  boxNote: string;
  slotId: string;
  payment: PaymentMethod;
  upiId: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvc: string;
  remember: boolean;
};

export type CheckoutField = keyof CheckoutForm;
export type CheckoutErrors = Partial<Record<CheckoutField, string>>;

/** Keeps the 10-digit Indian mobile number, dropping +91 / 0 prefixes and spaces. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

function luhn(number: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = number.length - 1; i >= 0; i -= 1) {
    let digit = Number(number[i]);
    if (double) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

function expiryValid(raw: string, now: Date): boolean {
  const match = raw.replace(/\s/g, '').match(/^(\d{2})\/(\d{2})$/);
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;
  const endOfMonth = new Date(year, month, 1);
  return endOfMonth > now;
}

export function validateCheckout(form: CheckoutForm, now = new Date()): CheckoutErrors {
  const errors: CheckoutErrors = {};

  if (form.name.trim().length < 2) errors.name = 'Tell us who the order is for.';
  if (!/^[6-9]\d{9}$/.test(normalizePhone(form.phone))) errors.phone = 'Enter a 10-digit mobile number.';
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) errors.email = 'This email looks incomplete.';

  if (form.fulfilment === 'delivery') {
    if (form.address.trim().length < 10) errors.address = 'Add your flat, building and street.';
    const pin = checkPin(form.pin);
    if (pin.status !== 'ok') errors.pin = pin.message;
  }

  if (form.boxNote.length > BOX_NOTE_LIMIT) errors.boxNote = `Keep the note under ${BOX_NOTE_LIMIT} characters.`;
  if (!form.slotId) errors.slotId = 'Choose a time.';

  if (form.payment === 'UPI' && !/^[\w.-]{2,}@[a-z]{2,}$/i.test(form.upiId.trim())) errors.upiId = 'Enter a UPI ID like name@bank.';
  if (form.payment === 'CARD') {
    const digits = form.cardNumber.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19 || !luhn(digits)) errors.cardNumber = 'Check the card number.';
    if (!expiryValid(form.cardExpiry, now)) errors.cardExpiry = 'Use MM/YY, not in the past.';
    if (!/^\d{3,4}$/.test(form.cardCvc)) errors.cardCvc = '3 or 4 digits.';
  }
  return errors;
}
