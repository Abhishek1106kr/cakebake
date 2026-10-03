const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export function formatPrice(amount: number): string {
  return `₹${inr.format(amount)}`;
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** "18:40" in Bengaluru time, regardless of the visitor's timezone. */
export function formatTimeIST(iso: string | number): string {
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

export function formatDateIST(iso: string | number): string {
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }).format(new Date(iso));
}
