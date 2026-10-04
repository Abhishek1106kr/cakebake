// Customer uploads and print artwork, kept in this browser's IndexedDB. Nothing
// is uploaded anywhere: the configuration stores only an asset id. Uploaded
// photos belong to the customer and are used only to make their cake.
//
// Boundary: CUSTOMER PREVIEW (SVG, live) → PRINT SPECIFICATION (numbers in the
// configuration) → PRODUCTION ASSET (renderArtwork: a print-resolution PNG).

import { fonts, printRules } from './config';
import { printableArea, shapeOf, messageLines } from './engine';
import type { CakeConfiguration } from './types';

const DB = 'tresor-cake-assets';
const STORE = 'assets';

export type StoredAsset = { id: string; kind: 'upload' | 'artwork'; blob: Blob; width: number; height: number; createdAt: string; designId?: string };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = run(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export const putAsset = (a: StoredAsset) => tx('readwrite', (s) => s.put(a));
export const getAsset = (id: string) => tx<StoredAsset | undefined>('readonly', (s) => s.get(id));
export const deleteAsset = (id: string) => tx('readwrite', (s) => s.delete(id));

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export type UploadResult = { ok: true; assetId: string; width: number; height: number; url: string } | { ok: false; error: string };

/**
 * Validates and stores an upload: type, size and minimum resolution are checked; EXIF
 * orientation is applied; very large photos are downscaled to keep storage light.
 */
export async function processUpload(file: File): Promise<UploadResult> {
  if (!printRules.acceptedTypes.includes(file.type)) return { ok: false, error: 'Please upload a JPG, PNG or WebP photo.' };
  if (file.size > printRules.maxUploadBytes) return { ok: false, error: `That photo is over ${printRules.maxUploadBytes / 1024 / 1024} MB. Please choose a smaller one.` };
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return { ok: false, error: 'We couldn’t read that photo. Try another file.' };
  }
  if (Math.min(bitmap.width, bitmap.height) < printRules.minSourcePx) {
    bitmap.close();
    return { ok: false, error: `That photo is quite small (${bitmap.width}×${bitmap.height}). Please use one at least ${printRules.minSourcePx} pixels on its shorter side so it prints sharply.` };
  }
  const max = 2400;
  const k = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * k);
  const h = Math.round(bitmap.height * k);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, type, 0.9));
  if (!blob) return { ok: false, error: 'We couldn’t process that photo. Try another file.' };
  const id = newId('upload');
  await putAsset({ id, kind: 'upload', blob, width: w, height: h, createdAt: new Date().toISOString() });
  return { ok: true, assetId: id, width: w, height: h, url: URL.createObjectURL(blob) };
}

/** Object URL for a stored asset (caller revokes when done). */
export async function assetUrl(id: string): Promise<string | null> {
  try {
    const a = await getAsset(id);
    return a ? URL.createObjectURL(a.blob) : null;
  } catch {
    return null;
  }
}

function clipShape(ctx: CanvasRenderingContext2D, kind: string, w: number, h: number) {
  ctx.beginPath();
  if (kind === 'round') ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (kind === 'heart') {
    ctx.moveTo(w / 2, h * 0.98);
    ctx.bezierCurveTo(w * 0.02, h * 0.62, w * -0.02, h * 0.14, w * 0.27, h * 0.08);
    ctx.bezierCurveTo(w * 0.42, h * 0.05, w * 0.5, h * 0.2, w / 2, h * 0.24);
    ctx.bezierCurveTo(w * 0.5, h * 0.2, w * 0.58, h * 0.05, w * 0.73, h * 0.08);
    ctx.bezierCurveTo(w * 1.02, h * 0.14, w * 0.98, h * 0.62, w / 2, h * 0.98);
  } else ctx.rect(0, 0, w, h);
  ctx.closePath();
}

/**
 * Renders the production artwork for the edible print at print resolution (300 dpi,
 * capped): the photo placed exactly as specified, clipped to the printable outline,
 * with the message if there is one. Stored as a PNG asset for the bakery.
 */
export async function renderArtwork(c: CakeConfiguration, designId: string): Promise<string | null> {
  if (!c.print.enabled || !c.print.assetId) return null;
  const source = await getAsset(c.print.assetId);
  if (!source) return null;
  const area = printableArea(c);
  const dpcm = 300 / 2.54;
  const scaleCap = Math.min(1, 3000 / Math.max(area.widthCm * dpcm, area.heightCm * dpcm));
  const W = Math.round(area.widthCm * dpcm * scaleCap);
  const H = Math.round(area.heightCm * dpcm * scaleCap);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  clipShape(ctx, shapeOf(c).kind, W, H);
  ctx.clip();
  const img = await createImageBitmap(source.blob);
  const iw = c.print.scale * W;
  const ih = iw * (img.height / img.width);
  ctx.save();
  ctx.translate(c.print.x * W, c.print.y * H);
  ctx.rotate((c.print.rotation * Math.PI) / 180);
  ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
  ctx.restore();
  img.close();
  if (c.message.text.trim()) {
    if (typeof document !== 'undefined' && 'fonts' in document) await document.fonts.ready;
    const font = fonts.find((f) => f.id === c.message.font) ?? fonts[0];
    const family = getComputedStyle(document.documentElement).getPropertyValue('--font-cake-script').trim() || 'cursive';
    const px = c.message.size * W;
    ctx.fillStyle = c.message.color;
    ctx.textAlign = c.message.align;
    ctx.textBaseline = 'middle';
    ctx.font = `${px}px ${font.family.replace('var(--font-cake-script)', family)}`;
    const lines = messageLines(c.message.text);
    const lh = px * font.lineHeight;
    const x = c.message.align === 'left' ? W * 0.1 : c.message.align === 'right' ? W * 0.9 : W / 2;
    ctx.save();
    ctx.translate(0, c.message.y * H);
    ctx.rotate((c.message.rotation * Math.PI) / 180);
    lines.forEach((line, i) => ctx.fillText(line, x, (i - (lines.length - 1) / 2) * lh));
    ctx.restore();
  }
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) return null;
  const id = newId('artwork');
  await putAsset({ id, kind: 'artwork', blob, width: W, height: H, createdAt: new Date().toISOString(), designId });
  return id;
}
