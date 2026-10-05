// File storage behind an interface: local disk today (outside public/, served only through
// authorized routes), S3/R2 later with the same calls.

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../env';

export interface FileStorage {
  put(key: string, data: Uint8Array, contentType: string): Promise<{ key: string; sha256: string; bytes: number }>;
  get(key: string): Promise<Uint8Array | null>;
  exists(key: string): Promise<boolean>;
}

/** Keys are made of safe segments only, so a key can never escape the storage directory. */
export function safeKey(key: string) {
  if (!/^[a-z0-9][a-z0-9/_.-]{0,200}$/i.test(key) || key.includes('..') || key.startsWith('/')) throw new Error(`Unsafe storage key: ${key}`);
  return key;
}

export class LocalFileStorage implements FileStorage {
  constructor(private root = path.resolve(env().STORAGE_DIR)) {}
  private file(key: string) { return path.join(this.root, safeKey(key)); }
  async put(key: string, data: Uint8Array) {
    const f = this.file(key);
    await mkdir(path.dirname(f), { recursive: true });
    await writeFile(f, data);
    return { key, sha256: createHash('sha256').update(data).digest('hex'), bytes: data.byteLength };
  }
  async get(key: string) { try { return new Uint8Array(await readFile(this.file(key))); } catch { return null; } }
  async exists(key: string) { try { await stat(this.file(key)); return true; } catch { return false; } }
}

let instance: FileStorage | null = null;
export const storage = (): FileStorage => (instance ??= new LocalFileStorage());
