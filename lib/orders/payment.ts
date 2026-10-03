// PAYMENT SERVICE BOUNDARY: SIMULATED.
//
// No money moves. This module stands in for a real gateway (e.g. Razorpay):
// replace `processPayment` with a call that creates a payment intent on a server
// and confirms it through a signed webhook. The UI only depends on the types below.
//
// Card details are validated in the browser and then discarded. They are never
// stored or persisted anywhere.
//
// Test triggers for the failure path:
//   UPI ID containing "fail"    e.g. fail@upi
//   Card number ending in 0002  e.g. 4000 0000 0000 0002

export type PaymentMethod = 'UPI' | 'CARD' | 'COD';

export type PaymentRequest = {
  method: PaymentMethod;
  amount: number;
  upiId?: string;
  cardNumber?: string;
};

export type PaymentResult =
  | { ok: true; status: 'PAID' | 'DUE'; reference: string; simulated: true }
  | { ok: false; reason: string; simulated: true };

const SIMULATED_LATENCY_MS = 1100;

function reference(): string {
  return `SIM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function processPayment(request: PaymentRequest): Promise<PaymentResult> {
  await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));

  if (request.method === 'COD') return { ok: true, status: 'DUE', reference: reference(), simulated: true };

  if (request.method === 'UPI' && request.upiId?.toLowerCase().includes('fail')) {
    return { ok: false, reason: 'Your UPI app declined the request.', simulated: true };
  }
  if (request.method === 'CARD' && request.cardNumber?.replace(/\D/g, '').endsWith('0002')) {
    return { ok: false, reason: 'Your bank declined the card.', simulated: true };
  }
  return { ok: true, status: 'PAID', reference: reference(), simulated: true };
}

export const paymentLabels: Record<PaymentMethod, string> = {
  UPI: 'UPI',
  CARD: 'Card',
  COD: 'Pay at the door',
};
