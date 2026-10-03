// Browser storage helpers. Storage can be unavailable (private mode, blocked
// site data), so every read and write fails soft.

export const STORAGE_KEYS = {
  cart: 'tresor:cart',
  orders: 'tresor:orders',
  profile: 'tresor:profile',
  addresses: 'tresor:addresses',
  recent: 'tresor:recent',
} as const;

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the session still works, it just won't persist.
  }
}

export function removeKeys(keys: string[]): void {
  try {
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {}
}
