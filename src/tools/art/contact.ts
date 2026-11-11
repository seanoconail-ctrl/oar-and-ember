/**
 * Contact sheets of compiled art at 1x and 4x, for looking at new sheets (CLAUDE.md: art is rendered
 * at 1x and 4x and inspected). Each state is a row of its frames, on the strand's dry sand.
 *
 *   node src/tools/art/contact.ts <out dir> <sheet> [<sheet> ...]
 *   node src/tools/art/contact.ts docs/art/missiles fx_missile fx_glint prop_pickup
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NO_PIXEL, toRgba } from '../../render/indexedImage.ts';
import type { Sheet } from '../../render/sheet.ts';
import { loadPalette, loadSheets } from './artFiles.ts';
import { REPO_ROOT } from './loadTitleArt.ts';
import { encodePng } from './png.ts';
import type { RgbaImage } from './png.ts';

/** The ground behind the contact sheets: the strand's dry sand. */
const GROUND = [196, 176, 138] as const;

export function scaled(img: RgbaImage, k: number): RgbaImage {
  const data = new Uint8Array(img.width * k * img.height * k * 4);
  for (let y = 0; y < img.height * k; y++)
    for (let x = 0; x < img.width * k; x++)
      for (let c = 0; c < 4; c++)
        data[(y * img.width * k + x) * 4 + c] =
          img.data[(Math.floor(y / k) * img.width + Math.floor(x / k)) * 4 + c] ?? 0;
  return { width: img.width * k, height: img.height * k, data };
}

/** Every frame of a sheet, a row per state, 2 px apart, over the sand. */
export function contactSheet(sheet: Sheet): RgbaImage {
  const palette = loadPalette();
  const rows: string[][] = [];
  for (const [state, anim] of Object.entries(sheet.anims))
    for (const facing of sheet.facings)
      rows.push(Array.from({ length: anim.frames }, (_, i) => `${state}/${facing}/${i}`));
  const w = sheet.width;
  const h = sheet.height;
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const width = cols * (w + 2) + 2;
  const height = rows.length * (h + 2) + 2;
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([...GROUND, 255], i * 4);
  rows.forEach((row, j) => {
    row.forEach((key, i) => {
      const img = sheet.frames.get(key);
      if (img === undefined) return;
      const rgba = toRgba(img, palette);
      const ox = 2 + i * (w + 2);
      const oy = 2 + j * (h + 2);
      for (let p = 0; p < img.pixels.length; p++) {
        if ((img.pixels[p] ?? NO_PIXEL) === NO_PIXEL) continue;
        const x = ox + (p % w);
        const y = oy + Math.floor(p / w);
        data.set(rgba.subarray(p * 4, p * 4 + 3), (y * width + x) * 4);
      }
    });
  });
  return { width, height, data };
}

if (import.meta.filename === process.argv[1]) {
  const [out, ...names] = process.argv.slice(2);
  if (out === undefined || names.length === 0) {
    console.error('usage: node src/tools/art/contact.ts <out dir> <sheet> [<sheet> ...]');
    process.exit(1);
  }
  const sheets = new Map(loadSheets().map((s) => [s.name, s]));
  mkdirSync(join(REPO_ROOT, out), { recursive: true });
  for (const name of names) {
    const sheet = sheets.get(name);
    if (sheet === undefined) throw new Error(`no sheet ${name}`);
    const img = contactSheet(sheet);
    writeFileSync(join(REPO_ROOT, out, `${name}.png`), encodePng(img));
    writeFileSync(join(REPO_ROOT, out, `${name}@4x.png`), encodePng(scaled(img, 4)));
    console.log(`${out}/${name}.png (${img.width} x ${img.height}) and @4x`);
  }
}
