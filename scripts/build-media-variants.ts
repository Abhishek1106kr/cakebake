/**
 * Responsive variants for the local image folder: AVIF and WebP at 480 / 960 / 1600 px wide (never
 * upscaled), a 160 px square thumbnail for admin tables, and a tiny blurred placeholder, plus an
 * index (variants.json) the <Media> component reads.
 *
 *   npm run media:variants            (default folder: public/mock-assets)
 *   npm run media:variants -- public/media
 *
 * Output goes to <folder>/_v/. public/mock-assets is git-ignored (reference images with unknown
 * rights, local only); point this at a licensed photo folder to process real photography the same way.
 */
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(process.argv[2] ?? 'public/mock-assets');
const publicDir = path.resolve('public');
const out = path.join(root, '_v');
const WIDTHS = [480, 960, 1600];
const IMAGE = /\.(jpe?g|png|webp)$/i;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (name === '_v' || name.startsWith('.')) return [];
    return statSync(full).isDirectory() ? walk(full) : IMAGE.test(name) ? [full] : [];
  });
}

const url = (file: string) => '/' + path.relative(publicDir, file).split(path.sep).join('/');

type Entry = { width: number; height: number; avif: string[]; webp: string[]; thumb: string; placeholder: string };

async function main() {
  const files = walk(root);
  const index: Record<string, Entry> = {};
  for (const file of files) {
    const rel = path.relative(root, file).replace(/\.[^.]+$/, '');
    const dest = path.join(out, rel);
    mkdirSync(path.dirname(dest), { recursive: true });
    const img = sharp(file, { failOn: 'none' }).rotate();
    const meta = await img.metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    const widths = WIDTHS.filter((w) => w < width).concat(width && width <= WIDTHS[WIDTHS.length - 1] ? [width] : []);
    const avif: string[] = [];
    const webp: string[] = [];
    for (const w of [...new Set(widths)].sort((a, b) => a - b)) {
      const a = `${dest}-${w}.avif`;
      const b = `${dest}-${w}.webp`;
      await sharp(file).rotate().resize({ width: w }).avif({ quality: 52, effort: 4 }).toFile(a);
      await sharp(file).rotate().resize({ width: w }).webp({ quality: 74 }).toFile(b);
      avif.push(`${url(a)} ${w}w`);
      webp.push(`${url(b)} ${w}w`);
    }
    const thumb = `${dest}-thumb.webp`;
    await sharp(file).rotate().resize({ width: 160, height: 160, fit: 'cover', position: 'attention' }).webp({ quality: 70 }).toFile(thumb);
    const tiny = await sharp(file).rotate().resize({ width: 16 }).blur(1).webp({ quality: 40 }).toBuffer();
    index[url(file)] = { width, height, avif, webp, thumb: url(thumb), placeholder: `data:image/webp;base64,${tiny.toString('base64')}` };
  }
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, 'variants.json'), JSON.stringify(index));
  console.log(`${files.length} images → ${path.relative(process.cwd(), out)} (AVIF + WebP ${WIDTHS.join('/')} px, thumbnails, placeholders)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
